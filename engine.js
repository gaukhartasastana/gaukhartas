/* ============================================================
   ГАУХАРТАС — движок сайта.
   Один файл на все четыре версии.
   Рисует блоки из content.js, считает смету,
   собирает статистику и отправляет заявки в WhatsApp.
   ============================================================ */
(function () {
"use strict";

var KEY_CONTENT = "gh_content";
var KEY_STATS = "gh_stats";
var KEY_LEADS = "gh_leads";

var GH = window.GH = {};

/* ---------- безопасный доступ к localStorage ----------
   Safari в приватном режиме и «блокировать cookies» кидают
   исключение на само обращение к localStorage, а не только на setItem.
   Поэтому обёрнут каждый вызов. */
var LS = GH.storage = {
	get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
	set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
	del: function (k) { try { localStorage.removeItem(k); return true; } catch (e) { return false; } }
};

/* ---------- данные ---------- */
function deep(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; } }
function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
GH.arr = arr;

/* Схема: какие поля обязаны быть массивами, а какие — объектами.
   Кривые данные из админки не должны валить сайт. */
var ARRAY_KEYS = ["halls", "menus", "gallery", "faq", "trust", "timeline", "formats", "included", "reviews"];
var OBJECT_KEYS = ["brand", "contacts", "hero", "about", "settings", "analytics", "reviewsMeta"];

GH.normalize = function (d) {
	d = isObj(d) ? d : {};
	var def = window.GH_DEFAULT || {};
	ARRAY_KEYS.forEach(function (k) {
		if (!Array.isArray(d[k])) d[k] = Array.isArray(def[k]) ? deep(def[k]) : [];
	});
	OBJECT_KEYS.forEach(function (k) {
		if (!isObj(d[k])) d[k] = isObj(def[k]) ? deep(def[k]) : {};
	});
	/* залы: без валидного зала калькулятор и SEO не соберутся */
	d.halls = d.halls.filter(isObj).map(function (h, i) {
		h.id = h.id || "hall" + i;
		h.name = h.name || "Зал " + (i + 1);
		h.num = h.num || ("0" + (i + 1)).slice(-2);
		h.min = Math.max(0, +h.min || 0);
		h.max = Math.max(h.min || 1, +h.max || 100);
		h.sound = Math.max(0, +h.sound || 0);
		h.decor = Math.max(0, +h.decor || 0);
		h.specs = arr(h.specs).filter(function (r) { return Array.isArray(r) && r.length >= 2; });
		h.text = h.text || "";
		h.photo = h.photo || "";
		return h;
	});
	if (!d.halls.length) d.halls = [{ id: "hall", num: "01", name: "Зал", min: 10, max: 100,
		sound: 0, decor: 0, specs: [], text: "", photo: "" }];
	/* меню */
	d.menus = d.menus.filter(isObj).map(function (m, i) {
		m.id = m.id || "menu" + i;
		m.name = m.name || "Меню " + (i + 1);
		var dflt = (((window.GH_DEFAULT || {}).menus || [])[i] || {}).price;
		var pr = Math.max(0, +m.price || 0);
		/* «0 ₸» на сайте банкетного зала выглядит как ошибка и отпугивает.
		   Если из админки пришёл мусор — показываем цену по умолчанию. */
		m.price = pr > 0 ? pr : (Math.max(0, +dflt || 0) || 0);
		m.note = m.note || "";
		m.meat = m.meat || "—";
		m.weekdayOnly = !!m.weekdayOnly;
		m.pick = !!m.pick;
		m.dishes = arr(m.dishes);
		m.gifts = arr(m.gifts);
		return m;
	});
	/* пары «вопрос-ответ» и таймлайн — только валидные строки */
	d.faq = d.faq.filter(function (f) { return Array.isArray(f) && f.length >= 2; });
	d.trust = d.trust.filter(function (t) { return Array.isArray(t) && t.length >= 2; });
	d.timeline = d.timeline.filter(function (t) { return Array.isArray(t) && t.length >= 3; });
	d.gallery = d.gallery.filter(isObj).filter(function (g) { return !!g.src; })
		.map(function (g) { g.cap = g.cap || ""; return g; });
	/* отзыв без имени или текста не показываем — пустая карточка хуже её отсутствия */
	d.reviews = d.reviews.filter(isObj).filter(function (r) {
		return String(r.name || "").trim() && String(r.text || "").trim();
	}).map(function (r) {
		r.name = String(r.name).trim();
		r.text = String(r.text).trim();
		r.date = String(r.date || "").trim();
		r.event = String(r.event || "").trim();
		r.source = ["2gis", "instagram", "whatsapp", "google", "other"].indexOf(r.source) >= 0 ? r.source : "other";
		var n = parseInt(r.rating, 10);
		r.rating = (isFinite(n) && n >= 1 && n <= 5) ? n : 5;
		return r;
	});
	d.formats = d.formats.filter(function (f) { return typeof f === "string" && f; });
	d.included = d.included.filter(function (f) { return typeof f === "string" && f; });
	/* контакты и бренд — подставляем безопасные заглушки */
	var c = d.contacts;
	c.phone1 = c.phone1 || ""; c.phone2 = c.phone2 || "";
	c.whatsapp = String(c.whatsapp || "").replace(/\D/g, "");
	c.address = c.address || ""; c.city = c.city || "";
	c.hours = c.hours || ""; c.hoursShort = c.hoursShort || "";
	c.map2gis = c.map2gis || ""; c.instagram = c.instagram || "";
	c.lat = +c.lat || 0; c.lon = +c.lon || 0;
	var b = d.brand;
	b.name = b.name || "Гаухартас";
	b.domain = b.domain || (location.origin + "/");
	if (b.domain.slice(-1) !== "/") b.domain += "/";
	b.logo = b.logo || "";
	["ga4", "gads", "ttq", "fbp", "metrika"].forEach(function (k) {
		if (typeof d.analytics[k] !== "string") d.analytics[k] = "";
	});
	if (typeof d.settings.showCalc !== "boolean") d.settings.showCalc = true;
	if (typeof d.settings.weekendUpsell !== "boolean") d.settings.weekendUpsell = true;
	return d;
};

GH.load = function () {
	var base = deep(window.GH_DEFAULT || {});
	var raw = LS.get(KEY_CONTENT);
	if (raw) {
		try {
			var over = JSON.parse(raw);
			/* принимаем только объект: массив/строка/null из битой админки игнорируются */
			if (isObj(over)) {
				Object.keys(over).forEach(function (k) {
					if (over[k] !== null && over[k] !== undefined) base[k] = over[k];
				});
			}
		} catch (e) {
			if (window.console) console.warn("GH: gh_content повреждён, взяты данные по умолчанию");
		}
	}
	return GH.normalize(base);
};
GH.save = function (d) { return LS.set(KEY_CONTENT, JSON.stringify(d)); };
GH.reset = function () { return LS.del(KEY_CONTENT); };
var D = GH.data = GH.load();

/* ============================================================
   ЗАГРУЗКА ДАННЫХ С СЕРВЕРА

   Без этого админка бесполезна: она сохраняет правки на сервер,
   а сайт читал только localStorage браузера. У любого посетителя
   этот localStorage пустой — значит новые цены видел лишь сам
   директор в своём браузере, и больше никто.

   Тянем /api/content и перерисовываем привязанные значения.
   Если сервера нет (открыли файл локально, статический хостинг) —
   молча остаёмся на данных из content.js.
   ============================================================ */
GH.syncFromServer = function () {
	if (typeof fetch !== "function") return Promise.resolve(false);
	return fetch("/api/content", { headers: { "Accept": "application/json" } })
		.then(function (r) {
			if (!r.ok) throw new Error("HTTP " + r.status);
			return r.json();
		})
		.then(function (over) {
			if (!isObj(over)) return false;
			var base = deep(window.GH_DEFAULT || {});
			Object.keys(over).forEach(function (k) {
				if (over[k] !== null && over[k] !== undefined) base[k] = over[k];
			});
			var fresh = GH.normalize(base);
			/* подменяем содержимое, не теряя саму ссылку GH.data */
			Object.keys(D).forEach(function (k) { delete D[k]; });
			Object.keys(fresh).forEach(function (k) { D[k] = fresh[k]; });
			try { GH.bindText(); } catch (e) {}
			try { GH.renderReviews(); } catch (e) {}
			try { GH.renderVideo(); } catch (e) {}
			try { GH.seo({ theme: "leather", themeColor: "#0B0A08" }); } catch (e) {}
			try { document.dispatchEvent(new CustomEvent("gh:data", { detail: D })); } catch (e) {}
			return true;
		})
		.catch(function () { return false; });
};

/* ---------- утилиты ---------- */
var NB = "\u2009"; // тонкий пробел
function money(n) {
	n = Math.round(+n || 0);
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + "\u00a0₸";
}
GH.money = money;
function esc(s) {
	return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
		return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
	});
}
GH.esc = esc;
function el(sel, root) { return (root || document).querySelector(sel); }
function els(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
function blocks(name) { return els('[data-block="' + name + '"]'); }

/* ---------- статистика ---------- */
function today() { return new Date().toISOString().slice(0, 10); }
function readStats() {
	try { var v = JSON.parse(LS.get(KEY_STATS)); return isObj(v) ? v : {}; }
	catch (e) { return {}; }
}
GH.stats = readStats;
/* Отправка события на сервер. Раньше статистика писалась только в
   localStorage браузера посетителя, а админка читала свой собственный —
   то есть показывала клики самого директора, а не гостей сайта. */
GH.sendTrack = function (event, extra) {
	if (typeof fetch !== "function" && !(navigator && navigator.sendBeacon)) return;
	var body;
	try {
		body = JSON.stringify({ event: String(event || "").slice(0, 60),
		                        meta: extra || null, ts: Date.now() });
	} catch (e) { return; }
	try {
		/* sendBeacon переживает уход со страницы, обычный fetch — нет */
		if (navigator && navigator.sendBeacon) {
			navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
		} else {
			fetch("/api/track", { method: "POST", keepalive: true,
				headers: { "Content-Type": "application/json" }, body: body })
				.catch(function () {});
		}
	} catch (e) {}
};

GH.track = function (event, extra) {
	try { GH.sendTrack(event, extra); } catch (e) {}
	var s = readStats();
	var d = today();
	s.total = s.total || {};
	s.total[event] = (s.total[event] || 0) + 1;
	s.days = s.days || {};
	s.days[d] = s.days[d] || {};
	s.days[d][event] = (s.days[d][event] || 0) + 1;
	if (extra && extra.tier) {
		s.tiers = s.tiers || {};
		s.tiers[extra.tier] = (s.tiers[extra.tier] || 0) + 1;
	}
	if (extra && extra.theme) {
		s.themes = s.themes || {};
		s.themes[extra.theme] = (s.themes[extra.theme] || 0) + 1;
	}
	LS.set(KEY_STATS, JSON.stringify(s));
	/* если подключён Google Analytics — дублируем туда же */
	if (typeof window.gtag === "function") window.gtag("event", event, extra || {});
	if (GH.trackAll) GH.trackAll(event, extra);
};
GH.leads = function () {
	try { var v = JSON.parse(LS.get(KEY_LEADS)); return Array.isArray(v) ? v : []; }
	catch (e) { return []; }
};
GH.addLead = function (lead) {
	var all = GH.leads();
	lead.at = new Date().toISOString();
	all.unshift(lead);
	LS.set(KEY_LEADS, JSON.stringify(all.slice(0, 300)));
};

/* ---------- текстовые привязки [data-gh="path"] ---------- */
function pick(path) {
	if (path === "wa") {
		/* ═══ АТРИБУЦИЯ ═══
		   Менеджер видит первое сообщение клиента — и в нём уже написано,
		   откуда человек пришёл. Без этого источник теряется навсегда,
		   потому что переписка уходит в WhatsApp мимо любой аналитики. */
		var wa = "https://wa.me/" + (D.contacts.whatsapp || "");
		try {
			var q = new URLSearchParams(location.search);
			var utm = q.get("utm_source") || "";
			var src = utm ? utm
				: /[?&](gclid|gbraid|wbraid)=/.test(location.search) ? "google-ads"
				: /[?&]yclid=/.test(location.search) ? "yandex-direct"
				: /[?&]fbclid=/.test(location.search) ? "instagram"
				: (document.referrer || "").indexOf("2gis") >= 0 ? "2gis"
				: (document.referrer || "").indexOf("instagram") >= 0 ? "instagram"
				: (document.referrer || "").indexOf("google.") >= 0 ? "google-organic"
				: (document.referrer || "").indexOf("yandex.") >= 0 ? "yandex-organic"
				: "site";
			/* Код короткий и незаметный — человека он не смущает,
			   а менеджеру сразу говорит канал. */
			var code = { "google-ads": "GA", "yandex-direct": "YD", "instagram": "IG",
			             "2gis": "2G", "google-organic": "GO", "yandex-organic": "YO",
			             "site": "WEB" }[src] || "WEB";
			var page = location.pathname.indexOf("/small") === 0 ? " (малый зал)" : "";
			wa += "?text=" + encodeURIComponent(
				"Здравствуйте! Хочу узнать свободные даты" + page + ". [" + code + "]");
		} catch (e) {}
		return wa;
	}
	if (path === "tel1") return "tel:" + String(D.contacts.phone1 || "").replace(/\s/g, "");
	return path.split(".").reduce(function (o, k) {
		if (o == null) return null;
		return o[/^\d+$/.test(k) ? +k : k];
	}, D);
}
GH.bindText = function () {
	els("[data-gh]").forEach(function (n) {
		var v = pick(n.getAttribute("data-gh"));
		if (v == null) return;
		if (n.hasAttribute("data-money")) v = money(v);
		n.textContent = v;
	});
	els("[data-gh-href]").forEach(function (n) {
		var v = pick(n.getAttribute("data-gh-href"));
		if (v != null) n.setAttribute("href", v);
	});
};

/* ---------- шапка: SEO + микроразметка ---------- */
GH.seo = function (opts) {
	opts = opts || {};
	var c = D.contacts, b = D.brand;
	var big = D.halls[0] || {}, small = D.halls[1] || big;
	var prices = D.menus.map(function (m) { return +m.price || 0; }).filter(function (n) { return n > 0; });
	var minPrice = prices.length ? Math.min.apply(null, prices) : 0;
	var maxPrice = prices.length ? Math.max.apply(null, prices) : 0;
	var title = opts.title || (b.name + " — банкетный зал в Астане" +
		(big.max ? " на " + big.max + " гостей" : "") + " | Той, свадьба, ұзату");
	/* Адрес информативнее района: по нему человек сразу понимает, куда ехать. */
	var desc = "Банкетный зал «" + b.name + "» в Астане" +
		(c.address ? " на " + c.address : "") +
		(big.max ? ": большой зал " + (big.min ? big.min + "—" : "до ") + big.max + " гостей" : "") +
		(small !== big && small.max ? " и малый " + (small.min ? small.min + "—" : "до ") + small.max : "") +
		(minPrice ? ". Пакеты от " + minPrice.toLocaleString("ru-RU") + " ₸ на гостя" : "") +
		(c.phone1 ? ". Бронь: " + c.phone1 : "");
	document.title = title;
	function meta(attr, key, val) {
		var m = document.head.querySelector("meta[" + attr + '="' + key + '"]');
		if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
		m.setAttribute("content", val);
	}
	meta("name", "description", desc);
	meta("property", "og:title", title);
	meta("property", "og:description", desc);
	meta("property", "og:type", "website");
	meta("property", "og:url", b.domain);
	meta("property", "og:image", b.domain + "assets/og.jpg?v=2");
	meta("property", "og:locale", "ru_KZ");
	meta("name", "twitter:card", "summary_large_image");
	meta("name", "theme-color", opts.themeColor || "#0B0B0D");
	var link = document.head.querySelector('link[rel="canonical"]');
	if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
	link.href = b.domain;
	if (b.logo) {
		var ic = document.head.querySelector('link[rel="icon"]');
		if (!ic) { ic = document.createElement("link"); ic.rel = "icon"; document.head.appendChild(ic); }
		ic.href = b.logo;
	}

	var ld = {
		"@context": "https://schema.org",
		"@type": ["Restaurant", "EventVenue"],
		"@id": b.domain + "#business",
		name: b.name,
		alternateName: ["Gaukhartas", "Гауһартас", "Gauhartas", "Гаухартас Астана",
		                "Gaukhartas Astana", "Гаухартас той хана"],
		description: desc,
		servesCuisine: ["Казахская", "Европейская"],
		acceptsReservations: true,
		currenciesAccepted: "KZT",
		areaServed: { "@type": "City", name: "Астана" },
		availableLanguage: ["ru", "kk"],
		url: b.domain,
		image: b.domain + "assets/hall-big.webp",
		telephone: c.phone1,
		priceRange: minPrice ? minPrice.toLocaleString("ru-RU") + " ₸ – " +
			maxPrice.toLocaleString("ru-RU") + " ₸ на персону" : undefined,
		maximumAttendeeCapacity: big.max || undefined,
		address: {
			"@type": "PostalAddress",
			streetAddress: c.address,
			addressLocality: "Астана",
			addressCountry: "KZ"
		},
		geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lon },
		openingHoursSpecification: (function () {
			/* время берём из админки, а не хардкодим */
			var m = String(c.hoursShort || c.hours || "").match(/(\d{1,2}[:.]\d{2})\D+(\d{1,2}[:.]\d{2})/);
			return {
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
				opens: m ? m[1].replace(".", ":") : "10:00",
				closes: m ? m[2].replace(".", ":") : "23:00"
			};
		})(),
		hasMenu: D.menus.length ? {
			"@type": "Menu",
			name: "Банкетные пакеты",
			hasMenuSection: D.menus.map(function (m) {
				return {
					"@type": "MenuSection",
					name: m.name,
					offers: { "@type": "Offer", price: m.price, priceCurrency: "KZT",
						description: "На одного гостя" },
					hasMenuItem: arr(m.dishes).slice(0, 12).map(function (dish) {
						return { "@type": "MenuItem", name: String(dish).slice(0, 120) };
					})
				};
			})
		} : undefined,
		review: GH.reviewsLd() || undefined,
		amenityFeature: D.halls.map(function (h) {
			return { "@type": "LocationFeatureSpecification",
				name: h.name, value: "до " + h.max + " гостей" };
		}),
		sameAs: [c.instagram ? "https://instagram.com/" + c.instagram : "", c.map2gis].filter(Boolean)
	};
	var siteLd = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": b.domain + "#website",
		url: b.domain,
		name: b.name,
		alternateName: ["Gaukhartas", "Гауһартас", "Gaukhartas Astana", "Гаухартас Астана"],
		inLanguage: ["ru-KZ", "kk-KZ"],
		publisher: { "@id": b.domain + "#org" }
	};

	var orgLd = {
		"@context": "https://schema.org",
		"@type": "Organization",
		"@id": b.domain + "#org",
		name: b.name,
		alternateName: ["Gaukhartas", "Гауһартас", "Gaukhartas Astana"],
		url: b.domain,
		logo: { "@type": "ImageObject", url: b.domain + "assets/logo.webp" },
		image: b.domain + "assets/og.jpg?v=2",
		telephone: c.phone1 || undefined,
		address: {
			"@type": "PostalAddress",
			streetAddress: c.address || undefined,
			addressLocality: "Астана",
			addressCountry: "KZ"
		},
		/* Все площадки бренда в одном месте: так Google связывает их
		   в одну сущность и перестаёт путать с однофамильцами. */
		sameAs: [
			c.instagram ? "https://instagram.com/" + c.instagram : "",
			c.map2gis || "",
			"https://yandex.kz/maps/org/gaukhartas/",
			"https://www.google.com/maps/search/?api=1&query=" +
				encodeURIComponent((c.address || "") + " Астана")
		].filter(Boolean)
	};

	var faqLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: (D.faq || []).map(function (f) {
			return { "@type": "Question", name: f[0], acceptedAnswer: { "@type": "Answer", text: f[1] } };
		})
	};
	els('script[type="application/ld+json"][data-gh-ld]').forEach(function (n) { n.remove(); });
	[ld, siteLd, orgLd, faqLd].forEach(function (obj) {
		if (obj["@type"] === "FAQPage" && !obj.mainEntity.length) return;
		var sc = document.createElement("script");
		sc.type = "application/ld+json";
		sc.setAttribute("data-gh-ld", "1");
		sc.textContent = JSON.stringify(obj);
		document.head.appendChild(sc);
	});
};

/* ---------- блок: цифры ---------- */
GH.renderFacts = function () {
	blocks("facts").forEach(function (host) {
		var big = D.halls[0] || {}, small = D.halls[1] || {};
		var prices = D.menus.map(function (m) { return +m.price || 0; }).filter(function (n) { return n > 0; });
		var minP = prices.length ? Math.min.apply(null, prices) : 0;
		var items = [
			[big.max, "гостей в большом зале", 1],
			[small.max, "гостей в малом зале", 1],
			[minP ? money(minP) : null, "меню на персону, будни", 0],
			[D.contacts.hoursShort, "приём заявок ежедневно", 0]
		].filter(function (it) { return it[0] !== null && it[0] !== undefined && it[0] !== ""; });
		if (!items.length) { host.innerHTML = ""; return; }
		host.innerHTML = items.map(function (it, i) {
			return '<div class="gh-fact rv d' + i + '">' +
				"<b" + (it[2] ? ' data-count="' + it[0] + '">0' : ">" + esc(it[0])) + "</b>" +
				"<span>" + esc(it[1]) + "</span></div>";
		}).join("");
	});
};

/* ---------- блок: залы ---------- */
GH.renderHalls = function () {
	blocks("halls").forEach(function (host) {
		host.innerHTML = D.halls.map(function (h) {
			var rows = [["Вместимость", h.min + " — " + h.max + " гостей"]]
				.concat(arr(h.specs))
				.concat([["Музыкальная аппаратура", money(h.sound)], ["Оформление зала", money(h.decor)]]);
			return '<article class="gh-hall rv" id="hall-' + h.id + '">' +
				'<div class="gh-hall-txt">' +
				'<div class="gh-num">' + esc(h.num) + "</div>" +
				"<h3>" + esc(h.name) + "</h3>" +
				"<p>" + esc(h.text) + "</p>" +
				'<div class="gh-specs">' + rows.map(function (r) {
					return '<div class="gh-r"><span>' + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>";
				}).join("") + "</div>" +
				'<a class="gh-go" href="#book" data-hall="' + esc(h.id) + '">Уточнить дату для ' +
				esc(h.name.toLowerCase()) + " →</a>" +
				"</div>" +
				'<div class="gh-hall-ph"><div class="gh-cap">до ' + h.max + ' гостей</div>' +
				'<img src="' + esc(h.photo) + '" alt="' + esc(h.name + " Гаухартас") + '" loading="lazy" width="900" height="600"></div>' +
				"</article>";
		}).join("");
		els(".gh-go", host).forEach(function (a) {
			a.addEventListener("click", function () {
				var sel = el("#f-hall");
				if (sel) sel.value = a.getAttribute("data-hall");
				var c = el("#c-hall");
				if (c) { c.value = a.getAttribute("data-hall"); GH.calc(); }
				GH.track("hall_cta", { hall: a.getAttribute("data-hall") });
			});
		});
	});
};

/* ---------- блок: доверие ---------- */
GH.renderTrust = function () {
	blocks("trust").forEach(function (host) {
		host.innerHTML = D.trust.map(function (t, i) {
			return '<div class="gh-trust rv d' + (i % 3) + '"><b>' + esc(t[0]) + "</b><span>" + esc(t[1]) + "</span></div>";
		}).join("");
	});
};

/* ---------- блок: меню ---------- */
GH.renderMenus = function () {
	blocks("menus").forEach(function (host) {
		host.innerHTML = D.menus.map(function (m, i) {
			return '<article class="gh-tier rv d' + i + (m.pick ? " gh-pick" : "") + '">' +
				(m.pick ? '<div class="gh-badge">Берут чаще</div>' : "") +
				'<div class="gh-nm">' + esc(m.name) + "</div>" +
				'<div class="gh-pr">' + money(m.price) + "</div>" +
				'<div class="gh-pp">на персону · ' + esc(m.note) + "</div>" +
				"<ul>" + arr(m.dishes).map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" +
				(arr(m.gifts).length ? '<div class="gh-gifts"><span>В подарок</span>' +
				arr(m.gifts).map(function (g) { return "<i>" + esc(g) + "</i>"; }).join("") + "</div>" : "") +
				'<button class="gh-btn' + (m.pick ? " gh-solid" : "") + '" data-tier="' + esc(m.id) + '">Выбрать и посчитать</button>' +
				"</article>";
		}).join("");
		els("[data-tier]", host).forEach(function (b) {
			b.addEventListener("click", function () {
				var id = b.getAttribute("data-tier");
				GH.track("tier_pick", { tier: id });
				var c = el("#c-menu"); if (c) { c.value = id; GH.calc(); }
				var f = el("#f-menu"); if (f) f.value = id;
				var target = el("#calc") || el("#book");
				if (target) target.scrollIntoView({ behavior: "smooth" });
			});
		});
	});
};

/* ---------- блок: что входит / доплаты ---------- */
GH.renderExtras = function () {
	blocks("extras").forEach(function (host) {
		var big = D.halls[0], small = D.halls[1];
		if (!big || !small) { host.innerHTML = ""; return; }
		host.innerHTML =
			'<div class="gh-tbl"><table><thead><tr><th>Что оплачивается отдельно</th><th>' +
			esc(big.name) + "</th><th>" + esc(small.name) + "</th></tr></thead><tbody>" +
			"<tr><td>Музыкальная аппаратура</td><td>" + money(big.sound) + "</td><td>" + money(small.sound) + "</td></tr>" +
			"<tr><td>Оформление зала</td><td>" + money(big.decor) + "</td><td>" + money(small.decor) + "</td></tr>" +
			D.included.map(function (t) {
				return "<tr><td>" + esc(t) + '</td><td class="gh-inc">входит в меню</td><td class="gh-inc">входит в меню</td></tr>';
			}).join("") +
			"</tbody></table></div>";
	});
};

/* ---------- блок: сравнение меню ---------- */
GH.renderCompare = function () {
	blocks("compare").forEach(function (host) {
		var M = D.menus;
		if (!M.length) { host.innerHTML = ""; return; }
		var allGifts = [];
		M.forEach(function (m) {
			arr(m.gifts).forEach(function (g) { if (allGifts.indexOf(g) < 0) allGifts.push(g); });
		});
		var rows = [
			["Цена на персону", M.map(function (m) { return money(m.price); })],
			["Доступно в выходные", M.map(function (m) { return m.weekdayOnly ? '<span class="gh-no">— только будни</span>' : '<span class="gh-yes">Да</span>'; })],
			["Мясо для бешбармака", M.map(function (m) { return esc(m.meat); })]
		].concat(allGifts.map(function (g) {
			return [g, M.map(function (m) {
				return arr(m.gifts).indexOf(g) >= 0 ? '<span class="gh-yes">В подарок</span>' : '<span class="gh-no">—</span>';
			})];
		}));
		host.innerHTML = '<div class="gh-tbl gh-cmp"><table><thead><tr><th>Что входит</th>' +
			M.map(function (m) { return "<th" + (m.pick ? ' class="gh-best"' : "") + ">" + esc(m.name) + "</th>"; }).join("") +
			"</tr></thead><tbody>" +
			rows.map(function (r) {
				return "<tr><td>" + esc(r[0]) + "</td>" + r[1].map(function (v, i) {
					return "<td" + (M[i].pick ? ' class="gh-best"' : "") + ">" + v + "</td>";
				}).join("") + "</tr>";
			}).join("") + "</tbody></table></div>";
	});
};

/* ---------- блок: галерея + лайтбокс ---------- */
GH.renderGallery = function () {
	if (!D.gallery.length) return;
	blocks("gallery").forEach(function (host) {
		host.innerHTML = D.gallery.map(function (g, i) {
			return '<figure class="gh-gi rv d' + (i % 3) + '" data-i="' + i + '">' +
				'<span class="gh-zoom">+</span>' +
				'<img src="' + esc(g.src) + '" alt="' + esc(g.cap) + '" loading="lazy" width="900" height="600">' +
				"<figcaption>" + esc(g.cap) + "</figcaption></figure>";
		}).join("");
	});
	if (!el("#gh-lb") && D.gallery.length) {
		var lb = document.createElement("div");
		lb.id = "gh-lb";
		lb.innerHTML = '<button class="gh-x">✕</button><button class="gh-ar gh-prev">‹</button>' +
			'<button class="gh-ar gh-next">›</button><div><img alt=""><div class="gh-lbcap"></div>' +
			'<div class="gh-lbn"></div></div>';
		document.body.appendChild(lb);
		var img = el("img", lb), cap = el(".gh-lbcap", lb), nn = el(".gh-lbn", lb), cur = 0;
		function show(i) {
			cur = (i + D.gallery.length) % D.gallery.length;
			img.src = D.gallery[cur].src;
			img.alt = D.gallery[cur].cap;
			cap.textContent = D.gallery[cur].cap;
			nn.textContent = cur + 1 + " / " + D.gallery.length;
			lb.classList.add("on");
		}
		els("[data-block=gallery] .gh-gi").forEach(function (f) {
			f.addEventListener("click", function () { show(+f.getAttribute("data-i")); GH.track("gallery_open"); });
		});
		el(".gh-x", lb).addEventListener("click", function () { lb.classList.remove("on"); });
		el(".gh-prev", lb).addEventListener("click", function (e) { e.stopPropagation(); show(cur - 1); });
		el(".gh-next", lb).addEventListener("click", function (e) { e.stopPropagation(); show(cur + 1); });
		lb.addEventListener("click", function (e) { if (e.target === lb) lb.classList.remove("on"); });
		addEventListener("keydown", function (e) {
			if (!lb.classList.contains("on")) return;
			if (e.key === "Escape") lb.classList.remove("on");
			if (e.key === "ArrowLeft") show(cur - 1);
			if (e.key === "ArrowRight") show(cur + 1);
		});
	}
};

/* ---------- блок: отзывы ---------- */
var SRC_LABEL = { "2gis": "2ГИС", instagram: "Instagram", whatsapp: "WhatsApp",
	google: "Google", other: "" };


/* ═══ ВИДЕО С МЕРОПРИЯТИЯ ═══
   Плеер YouTube весит около мегабайта и ставит куки на каждой загрузке
   страницы — даже если видео никто не включил. Поэтому до нажатия
   показываем только обложку, а iframe создаём в момент клика. */
GH.renderVideo = function () {
	var sec = el("#video");
	if (!sec) return;
	var v = D.video || {};
	var id = String(v.id || "").trim();
	/* Принимаем и полную ссылку, и голый ID — так меньше шансов ошибиться */
	var m = id.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
	if (m) id = m[1];
	if (!/^[A-Za-z0-9_-]{11}$/.test(id)) { sec.style.display = "none"; return; }
	sec.style.display = "";

	/* Shorts снимают вертикально. В рамке 16:9 такой ролик утонул бы
	   между двух чёрных полос, поэтому для него отдельная раскладка. */
	var vertical = v.vertical === true ||
		(v.vertical !== false && /\/shorts\//.test(String(v.id || "")));
	sec.classList.toggle("vd-vertical", vertical);

	var t = el("#video-title"), st = el("#video-sub"), cap = el("#video-cap");
	if (t && v.title) t.textContent = v.title;
	if (st && v.subtitle) st.textContent = v.subtitle;
	if (cap) { cap.textContent = v.caption || ""; cap.style.display = v.caption ? "" : "none"; }

	var box = el("#video-box");
	if (!box) return;
	var poster = v.poster || "assets/og.jpg?v=2";
	box.innerHTML =
		'<img class="vd-poster" src="' + poster + '" alt="' + (v.title || "Видео") + '" ' +
			'loading="lazy" decoding="async" width="1600" height="900">' +
		'<button class="vd-play" type="button" aria-label="Смотреть видео">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>' +
		'</button>';

	box.querySelector(".vd-play").addEventListener("click", function () {
		var f = document.createElement("iframe");
		/* nocookie: YouTube не ставит рекламные куки до просмотра */
		f.src = "https://www.youtube-nocookie.com/embed/" + id +
			"?autoplay=1&rel=0&modestbranding=1&playsinline=1";
		f.title = v.title || "Видео с мероприятия";
		f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture; web-share";
		f.setAttribute("allowfullscreen", "");
		f.setAttribute("frameborder", "0");
		box.innerHTML = "";
		box.appendChild(f);
		box.classList.add("playing");
		try { if (window.ghConv) ghConv("video_play", { id: id }); } catch (e) {}
	});
};

GH.renderReviews = function () {
	var host = el("#reviews-grid");
	var sec = el("#reviews");
	if (!host || !sec) return;
	var meta = D.reviewsMeta || {};
	var list = D.reviews || [];
	/* Пустой блок отзывов вредит: посетитель видит заголовок и ничего под ним.
	   Пока отзывов нет — секции на сайте нет. */
	/* Блок живёт и без текстовых отзывов: главная ценность — рейтинг
	   и число оценок с 2ГИС, это проверяемый факт. Тексты добавятся позже. */
	var hasNums = meta.rating && meta.ratingsCount;
	if ((!list.length && !hasNums) || meta.show === false) { sec.style.display = "none"; return; }
	sec.style.display = "";

	/* ── Сводка: рейтинг, звёзды, количество ── */
	var sum = el("#reviews-sum");
	if (sum) {
		if (!hasNums) { sum.innerHTML = ""; }
		else {
			/* Заливаем звёзды пропорционально, а не «полная / половинка».
			   Старая логика при 4.9 давала 4 полных + половину — визуально
			   это читается как 4.5, то есть сайт занижал собственный рейтинг
			   на четыре десятых. Теперь пятая звезда залита ровно на 90%. */
			var r = Math.max(0, Math.min(5, +meta.rating || 0));
			var st = "";
			for (var i = 0; i < 5; i++) {
				var fill = Math.max(0, Math.min(1, r - i));   /* 0…1 для каждой звезды */
				var cls = fill >= 0.995 ? "on" : (fill <= 0.005 ? "" : "hf");
				st += '<i class="' + cls + '"' +
					(cls === "hf" ? ' style="--fill:' + (fill * 100).toFixed(1) + '%"' : "") +
					'>★</i>';
			}
			var link = D.contacts.map2gis || "#";
			sum.innerHTML =
				'<a class="rv-score" href="' + link + '" target="_blank" rel="noopener">' +
					'<b>' + r.toFixed(1).replace(".", ",") + '</b>' +
					'<span class="rv-stars">' + st + '</span>' +
					'<span class="rv-src">на 2ГИС</span>' +
				'</a>' +
				'<div class="rv-nums">' +
					'<div><b>' + meta.ratingsCount.toLocaleString("ru-RU") + '</b><span>оценок</span></div>' +
					(meta.reviewsCount ? '<div><b>' + meta.reviewsCount.toLocaleString("ru-RU") +
						'</b><span>отзывов</span></div>' : "") +
					(meta.photosCount ? '<div><b>' + meta.photosCount +
						'</b><span>фото гостей</span></div>' : "") +
				'</div>' +
				(meta.edge ? '<p class="rv-edge">' + meta.edge + '</p>' : "");
		}
	}
	if (!list.length) { var g = el("#reviews-grid"); if (g) g.innerHTML = ""; return; }

	host.innerHTML = list.map(function (r, i) {
		var stars = "";
		for (var k = 0; k < 5; k++) stars += k < r.rating ? "★" : "☆";
		var src = SRC_LABEL[r.source] || "";
		return '<figure class="rev rv d' + (i % 3) + '">' +
			'<div class="rev-top"><span class="rev-st" aria-label="' + r.rating + ' из 5">' +
			stars + "</span>" +
			(src ? '<span class="rev-src">' + esc(src) + "</span>" : "") + "</div>" +
			"<blockquote>" + esc(r.text) + "</blockquote>" +
			'<figcaption><b>' + esc(r.name) + "</b>" +
			(r.event ? "<span>" + esc(r.event) + "</span>" : "") +
			(r.date ? "<time>" + esc(r.date) + "</time>" : "") +
			"</figcaption></figure>";
	}).join("");

	var t = el("#reviews-title"), st = el("#reviews-sub"), cta = el("#reviews-cta");
	if (t && meta.title) t.textContent = meta.title;
	if (st && meta.subtitle) st.textContent = meta.subtitle;
	if (cta) {
		if (D.contacts.map2gis) {
			cta.href = D.contacts.map2gis;
			cta.textContent = meta.ctaText || "Все отзывы в 2ГИС →";
			cta.style.display = "";
		} else cta.style.display = "none";
	}
};

/* Микроразметка отзывов. Настоящие отзывы — настоящий Review.
   aggregateRating намеренно НЕ добавляем: Google не показывает
   «звёзды» для отзывов, размещённых компанией о самой себе,
   а за выдуманный рейтинг снимает расширенный сниппет целиком. */
GH.reviewsLd = function () {
	var list = D.reviews || [];
	if (!list.length) return null;
	return list.slice(0, 20).map(function (r) {
		return {
			"@type": "Review",
			author: { "@type": "Person", name: r.name },
			reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
			reviewBody: r.text,
			datePublished: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : undefined
		};
	});
};

/* ---------- блок: FAQ ---------- */
GH.renderFaq = function () {
	blocks("faq").forEach(function (host) {
		host.innerHTML = D.faq.map(function (f, i) {
			return '<details class="gh-faq rv d' + (i % 3) + '"><summary>' + esc(f[0]) + "</summary><p>" + esc(f[1]) + "</p></details>";
		}).join("");
		els("details", host).forEach(function (d) {
			d.addEventListener("toggle", function () { if (d.open) GH.track("faq_open"); });
		});
	});
};

/* ---------- блок: таймлайн ---------- */
GH.renderTimeline = function () {
	blocks("timeline").forEach(function (host) {
		host.innerHTML = D.timeline.map(function (t, i) {
			return '<div class="gh-tl rv d' + (i % 3) + '"><b>' + esc(t[0]) + "</b><div><strong>" +
				esc(t[1]) + "</strong><span>" + esc(t[2]) + "</span></div></div>";
		}).join("");
	});
};

/* ---------- блок: бегущая строка форматов ---------- */
GH.renderMarquee = function () {
	blocks("marquee").forEach(function (host) {
		var one = D.formats.map(function (f) { return "<span>" + esc(f) + "</span><s>·</s>"; }).join("");
		host.innerHTML = "<div>" + one + one + "</div>";
	});
};

/* ---------- калькулятор: общий выключатель ----------
   Если settings.showCalc = false, калькулятор и все ссылки на смету
   убираются со всех версий сайта. Включается одной галкой в админке. */
GH.calcOn = function () {
	return !!(D.settings && D.settings.showCalc) && D.halls.length > 0 && D.menus.length > 0;
};
GH.calcGate = function () {
	if (GH.calcOn()) return;
	/* прячем секции с калькулятором целиком */
	blocks("calc").forEach(function (host) {
		var sec = host.closest("section") || host.closest(".hcalc") || host;
		sec.style.display = "none";
	});
	/* ссылки "смета" переводим на форму заявки */
	var map = {
		"Посчитать смету": "Оставить заявку",
		"Рассчитать смету": "Оставить заявку",
		"К расчёту сметы": "К форме заявки",
		"Смета": "Заявка",
		"Отправить смету в WhatsApp": "Написать в WhatsApp"
	};
	Array.prototype.forEach.call(document.querySelectorAll('a[href="#calc"]'), function (a) {
		a.setAttribute("href", "#book");
		var t = (a.textContent || "").trim();
		if (map[t]) {
			var sp = a.querySelector("span");
			if (sp) sp.textContent = map[t]; else a.textContent = map[t];
		}
	});
};

/* ---------- блок: калькулятор ---------- */
GH.renderCalc = function () {
	if (!GH.calcOn()) return;
	blocks("calc").forEach(function (host) {
		var big = D.halls[0];
		var lim = GH.guestLimits(big);
		var start = Math.min(Math.max(250, lim.min), lim.max);
		host.innerHTML =
			'<div class="gh-calc"><div class="gh-fields">' +
			'<label class="gh-f gh-f-range"><span>Гостей</span>' +
			'<div class="gh-rw"><input type="range" id="c-guests" min="' + lim.min + '" max="' + lim.max +
			'" step="10" value="' + start + '" aria-label="Количество гостей">' +
			'<input type="number" id="c-guests-n" class="gh-gnum" inputmode="numeric" pattern="[0-9]*" ' +
			'min="' + lim.min + '" max="' + lim.max + '" step="1" value="' + start + '" aria-label="Количество гостей, ввод числом">' +
			'<output id="c-guests-o" aria-hidden="true">' + start + '</output></div></label>' +
			'<label class="gh-f"><span>Зал</span><select id="c-hall">' +
			D.halls.map(function (h) { return '<option value="' + esc(h.id) + '">' + esc(h.name) + " — до " + h.max + "</option>"; }).join("") +
			"</select></label>" +
			'<label class="gh-f"><span>Меню</span><select id="c-menu">' +
			D.menus.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.pick ? " selected" : "") + ">" + esc(m.name) + " — " + money(m.price) + "</option>"; }).join("") +
			"</select></label>" +
			'<label class="gh-f"><span>День</span><select id="c-day">' +
			'<option value="wd">Понедельник — пятница</option><option value="we">Суббота или воскресенье</option>' +
			"</select></label>" +
			'<label class="gh-f gh-chk"><input type="checkbox" id="c-sound" checked><span>Музыкальная аппаратура</span></label>' +
			'<label class="gh-f gh-chk"><input type="checkbox" id="c-decor" checked><span>Оформление зала</span></label>' +
			'<p class="gh-hint" id="c-hint"></p>' +
			"</div>" +
			'<div class="gh-total"><div class="gh-tk">Итого</div>' +
			'<div class="gh-tv" id="c-total">0 ₸</div>' +
			'<div class="gh-tb" id="c-break"></div>' +
			'<a class="gh-btn gh-solid gh-wa" id="c-send" href="#">Отправить смету в WhatsApp</a>' +
			'<p class="gh-fine">Ответим в день обращения. Смета фиксируется в договоре.</p></div>' +
			"</div>";
		["c-guests", "c-hall", "c-menu", "c-day", "c-sound", "c-decor"].forEach(function (id) {
			var n = el("#" + id);
			if (n) n.addEventListener("input", function () {
				GH.calcState.lastInput = "range"; GH.calc();
			});
		});
		var gnum = el("#c-guests-n");
		if (gnum) {
			/* пока человек печатает — не перебиваем ему поле, считаем по факту ввода */
			gnum.addEventListener("input", function () { GH.calcState.lastInput = "num"; GH.calc(); });
			/* по уходу из поля дожимаем значение в границы и показываем результат */
			gnum.addEventListener("blur", function () {
				GH.calcState.lastInput = "num"; GH.calc();
				gnum.value = GH.calcState.guests;
			});
			gnum.addEventListener("keydown", function (e) {
				if (e.key === "Enter") { e.preventDefault(); gnum.blur(); }
			});
		}
		var send = el("#c-send");
		if (send) send.addEventListener("click", function (e) {
			if (e) e.preventDefault();
			if (!GH.calcState.menu) GH.calc();
			var s = GH.calcState;
			if (!s.menu || !s.hall) return;
			GH.track("calc_send", { tier: s.menu.id });
			GH.addLead({ source: "calc", guests: s.guests, hall: s.hall.name, menu: s.menu.name, day: s.day, total: s.total });
			var txt = "Здравствуйте! Рассчитал на сайте:\nЗал: " + s.hall.name +
				"\nГостей: " + s.guests + "\nМеню: " + s.menu.name + " (" + money(s.menu.price) + " / чел)" +
				"\nДень: " + (s.day === "we" ? "выходной" : "будни") +
				"\nИтого: " + money(s.total) + "\nПодскажите, свободна ли дата?";
			var url = "https://wa.me/" + D.contacts.whatsapp + "?text=" + encodeURIComponent(txt);
			send.setAttribute("href", url);
			window.open(url, "_blank");
		});
		GH.calc();
	});
};

GH.calcState = {};
GH.calcAnimId = null;

/* Приводит любой ввод к целому числу в границах [min, max].
   Отсекает NaN, минус, e-нотацию, пробелы и всё нечисловое —
   именно из-за них в смете появлялось «NaN ₸». */
GH.toGuests = function (raw, min, max) {
	var digits = String(raw == null ? "" : raw).replace(/[^\d]/g, "");
	var n = parseInt(digits, 10);
	if (!isFinite(n) || n <= 0) n = min;
	return Math.min(Math.max(n, min), max);
};

GH.MIN_GUESTS = 10;
GH.guestLimits = function (hall) {
	var max = Math.max(GH.MIN_GUESTS, +(hall && hall.max) || GH.MIN_GUESTS);
	/* soft — рекомендованный минимум зала, показываем подсказкой, но не запрещаем */
	var soft = Math.min(Math.max(0, +(hall && hall.min) || 0), max);
	return { min: GH.MIN_GUESTS, max: max, soft: soft };
};

GH.calc = function () {
	var g = el("#c-guests");
	if (!g || !GH.calcOn()) return;
	var hallSel = el("#c-hall"), menuSel = el("#c-menu"), daySel = el("#c-day");
	var hall = D.halls.filter(function (h) { return h.id === (hallSel && hallSel.value); })[0] || D.halls[0];
	var menu = D.menus.filter(function (m) { return m.id === (menuSel && menuSel.value); })[0] || D.menus[0];
	if (!hall || !menu) return;

	var lim = GH.guestLimits(hall);
	g.min = lim.min; g.max = lim.max;
	var num = el("#c-guests-n");
	if (num) { num.min = lim.min; num.max = lim.max; }

	/* источник правды — то поле, которого коснулись последним */
	var raw = (GH.calcState.lastInput === "num" && num) ? num.value : g.value;
	var guests = GH.toGuests(raw, lim.min, lim.max);
	g.value = guests;
	if (num && document.activeElement !== num) num.value = guests;
	var out = el("#c-guests-o");
	if (out) out.textContent = guests;

	var day = daySel ? daySel.value : "wd";
	var notes = [];
	/* подсказка, если гостей упёрлось в границу зала */
	var wanted = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
	if (isFinite(wanted) && wanted > lim.max) {
		notes.push("В зале «" + hall.name + "» максимум " + lim.max + " гостей — поставили " + lim.max + ".");
	} else if (isFinite(wanted) && wanted > 0 && wanted < lim.min) {
		notes.push("Минимум для расчёта — " + lim.min + " гостей.");
	} else if (lim.soft && guests < lim.soft) {
		var smaller = D.halls.filter(function (h) { return h.max < hall.max && h.max >= guests; })
			.sort(function (a, b) { return a.max - b.max; })[0];
		notes.push("«" + hall.name + "» рассчитан от " + lim.soft + " гостей" +
			(smaller ? " — на " + guests + " удобнее «" + smaller.name + "»." : "."));
	}

	if (day === "we" && menu.weekdayOnly && D.settings.weekendUpsell) {
		var alt = D.menus.filter(function (m) { return !m.weekdayOnly; })
			.sort(function (a, b) { return a.price - b.price; })[0];
		if (alt) {
			notes.push("Меню «" + menu.name + "» за " + money(menu.price) +
				" доступно только в будни — на выходные считаем от " + money(alt.price) + ".");
			menu = alt;
		}
	}

	var sndBox = el("#c-sound"), decBox = el("#c-decor");
	var food = guests * (+menu.price || 0);
	var sound = (sndBox && sndBox.checked) ? (+hall.sound || 0) : 0;
	var decor = (decBox && decBox.checked) ? (+hall.decor || 0) : 0;
	var total = food + sound + decor;
	if (!isFinite(total)) total = 0;

	var hintN = el("#c-hint");
	if (hintN) hintN.textContent = notes.join(" ");
	var br = [guests + " × " + money(menu.price) + " = " + money(food)];
	if (sound) br.push("аппаратура " + money(sound));
	if (decor) br.push("оформление " + money(decor));
	var breakN = el("#c-break");
	if (breakN) breakN.textContent = br.join(" · ");

	var outT = el("#c-total"), from = +GH.calcState.total || 0, t0 = null;
	if (GH.calcAnimId) cancelAnimationFrame(GH.calcAnimId);
	var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (outT) {
		if (reduce) { outT.textContent = money(total); }
		else {
			(function () {
				function step(t) {
					if (!t0) t0 = t;
					var pr = Math.min((t - t0) / 550, 1);
					outT.textContent = money(from + (total - from) * (1 - Math.pow(1 - pr, 3)));
					if (pr < 1) GH.calcAnimId = requestAnimationFrame(step);
				}
				GH.calcAnimId = requestAnimationFrame(step);
			})();
		}
	}
	GH.calcState = { guests: guests, hall: hall, menu: menu, day: day, total: total,
		lastInput: GH.calcState.lastInput };
};

/* ---------- блок: форма заявки ---------- */
GH.renderForm = function () {
	blocks("form").forEach(function (host) {
		var fmax = Math.max.apply(null, D.halls.map(function (h) { return +h.max || 0; }).concat([10]));
		var fstart = Math.min(150, fmax);
		host.innerHTML =
			'<form class="gh-form" id="gh-form" novalidate>' +
			'<div class="gh-fg"><label for="f-name">Имя</label><input id="f-name" name="name" required placeholder="Как к вам обращаться"></div>' +
			'<div class="gh-fg"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" required placeholder="+7 (___) ___-__-__" inputmode="tel"></div>' +
			'<div class="gh-fg"><label for="f-event">Формат</label><select id="f-event" name="event">' +
			D.formats.map(function (f) { return '<option>' + esc(f) + "</option>"; }).join("") +
			"<option>Другое торжество</option></select></div>" +
			'<div class="gh-fg"><label for="f-date">Дата</label><input id="f-date" name="date" type="date"></div>' +
			'<div class="gh-fg"><label for="f-guests">Гостей</label><input id="f-guests" name="guests" type="number" inputmode="numeric" min="10" max="' + fmax + '" step="1" value="' + fstart + '"></div>' +
			'<div class="gh-fg"><label for="f-hall">Зал</label><select id="f-hall" name="hall">' +
			D.halls.map(function (h) { return '<option value="' + esc(h.id) + '">' + esc(h.name) + "</option>"; }).join("") +
			"</select></div>" +
			'<div class="gh-fg"><label for="f-menu">Меню</label><select id="f-menu" name="menu">' +
			D.menus.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + " — " + money(m.price) + "</option>"; }).join("") +
			"</select></div>" +
			'<div class="gh-fg gh-full"><label for="f-note">Комментарий</label><textarea id="f-note" name="note" rows="3" placeholder="Живая музыка, особое оформление, аллергии…"></textarea></div>' +
			'<div class="gh-fg gh-full"><button class="gh-btn gh-solid" type="submit">Отправить заявку</button>' +
			'<p class="gh-fine" id="gh-fmsg">Нажимая кнопку, вы отправляете заявку менеджеру. Можно также просто написать в WhatsApp.</p></div>' +
			"</form>";

		var phone = el("#f-phone");
		phone.addEventListener("input", function () {
			var v = phone.value.replace(/\D/g, "");
			if (v[0] === "8") v = "7" + v.slice(1);
			if (v[0] !== "7") v = "7" + v;
			v = v.slice(0, 11);
			var out = "+7";
			if (v.length > 1) out += " (" + v.slice(1, 4);
			if (v.length >= 5) out += ") " + v.slice(4, 7);
			if (v.length >= 8) out += "-" + v.slice(7, 9);
			if (v.length >= 10) out += "-" + v.slice(9, 11);
			phone.value = out;
		});

		el("#gh-form").addEventListener("submit", function (e) {
			e.preventDefault();
			var f = e.target, msg = el("#gh-fmsg");
			/* f.name у <form> — это атрибут name самой формы, а не поле «Имя».
			   Обращаемся строго через f.elements, иначе TypeError. */
			var F = f.elements;
			var fld = function (k) { return F[k] || { value: "" }; };
			var name = String(fld("name").value || "").trim();
			var tel = String(fld("phone").value || "").replace(/\D/g, "");
			if (name.length < 2) { msg.textContent = "Укажите имя."; msg.className = "gh-fine gh-err"; return; }
			if (tel.length < 11) { msg.textContent = "Укажите телефон полностью."; msg.className = "gh-fine gh-err"; return; }
			var hall = D.halls.filter(function (h) { return h.id === fld("hall").value; })[0] || D.halls[0];
			var menu = D.menus.filter(function (m) { return m.id === fld("menu").value; })[0] || D.menus[0];
			if (!hall || !menu) { msg.textContent = "Данные залов не загрузились — напишите в WhatsApp."; msg.className = "gh-fine gh-err"; return; }
			var lim = GH.guestLimits(hall);
			var guests = GH.toGuests(fld("guests").value, lim.min, lim.max);
			if (String(fld("guests").value).replace(/[^\d]/g, "") !== String(guests)) {
				fld("guests").value = guests;
				msg.textContent = "Число гостей — от " + lim.min + " до " + lim.max +
					" для зала «" + hall.name + "». Поправили на " + guests +
					". Нажмите ещё раз, если всё верно.";
				msg.className = "gh-fine gh-err";
				return;
			}
			/* дата в прошлом — частая опечатка, ловим до отправки */
			if (fld("date").value) {
				var picked = new Date(fld("date").value + "T00:00:00");
				var todayD = new Date(); todayD.setHours(0, 0, 0, 0);
				if (picked < todayD) {
					msg.textContent = "Дата уже прошла — проверьте, пожалуйста.";
					msg.className = "gh-fine gh-err"; return;
				}
			}
			var btn = f.querySelector('button[type="submit"]');
			if (btn) { if (btn.disabled) return; btn.disabled = true; setTimeout(function () { btn.disabled = false; }, 4000); }
			var lead = {
				source: "form", name: name, phone: "+" + tel, event: fld("event").value,
				date: fld("date").value, guests: guests, hall: hall.name, menu: menu.name,
				note: String(fld("note").value || "").trim(),
				total: guests * (+menu.price || 0) + (+hall.sound || 0) + (+hall.decor || 0)
			};
			GH.addLead(lead);
			GH.track("form_submit", { tier: menu.id });
			var txt = "Заявка с сайта\nИмя: " + lead.name + "\nТелефон: " + lead.phone +
				"\nФормат: " + lead.event + (lead.date ? "\nДата: " + lead.date : "") +
				"\nГостей: " + lead.guests + "\nЗал: " + lead.hall + "\nМеню: " + lead.menu +
				"\nПредварительная смета: " + money(lead.total) +
				(lead.note ? "\nКомментарий: " + lead.note : "");
			var waUrl = "https://wa.me/" + D.contacts.whatsapp + "?text=" + encodeURIComponent(txt);
			msg.className = "gh-fine gh-ok";
			var win = window.open(waUrl, "_blank", "noopener");
			if (!win) {
				/* Safari на iOS блокирует window.open вне прямого клика — подставляем ссылку */
				msg.innerHTML = 'Заявка собрана. <a href="' + esc(waUrl) +
					'" target="_blank" rel="noopener">Открыть WhatsApp →</a>';
			} else {
				msg.textContent = "Заявка собрана. Открываем WhatsApp — осталось нажать «отправить».";
			}
		});
	});
};

/* ---------- блок: контакты ---------- */
GH.renderContacts = function () {
	blocks("contacts").forEach(function (host) {
		var c = D.contacts;
		var tel = function (v) { return String(v || "").replace(/\s/g, ""); };
		host.innerHTML =
			'<div class="gh-cell rv"><div class="gh-lb">Адрес</div><b>' + esc(c.address) + "</b><span>" + esc(c.city) + "</span></div>" +
			'<div class="gh-cell rv d1"><div class="gh-lb">Телефон</div><b><a href="tel:' + tel(c.phone1) + '">' + esc(c.phone1) + "</a></b>" +
			(c.phone2 ? '<span><a href="tel:' + tel(c.phone2) + '">' + esc(c.phone2) + "</a></span>" : "") + "</div>" +
			'<div class="gh-cell rv d2"><div class="gh-lb">Приём заявок</div><b>' + esc(c.hours) + "</b><span>Отвечаем в день обращения</span></div>" +
			'<div class="gh-cell rv d3"><div class="gh-lb">Ориентир</div><b>Подсвеченная вывеска</b><span>' + c.lat + ", " + c.lon + "</span></div>";
	});
	blocks("routes").forEach(function (host) {
		var c = D.contacts, p = c.lat + "," + c.lon;
		host.innerHTML =
			'<a class="gh-route" href="' + esc(c.map2gis) + '" target="_blank" rel="noopener" data-ev="route_2gis">Маршрут в 2ГИС →</a>' +
			'<a class="gh-route" href="https://yandex.kz/maps/?rtext=~' + p + '" target="_blank" rel="noopener" data-ev="route_yandex">Маршрут в Яндекс.Картах →</a>' +
			'<a class="gh-route" href="https://www.google.com/maps/dir/?api=1&destination=' + p + '" target="_blank" rel="noopener" data-ev="route_google">Маршрут в Google Maps →</a>';
	});
};

/* ---------- анимации ---------- */
GH.reveal = function (fallbackMs) {
	var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduce || !("IntersectionObserver" in window)) {
		els(".rv").forEach(function (e) { e.classList.add("in"); });
		return;
	}
	var io = new IntersectionObserver(function (es) {
		es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
	}, { threshold: 0.1 });
	els(".rv").forEach(function (e) { io.observe(e); });
	setTimeout(function () { els(".rv").forEach(function (e) { e.classList.add("in"); }); }, fallbackMs || 2200);
};
GH.counters = function (delay) {
	var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	setTimeout(function () {
		els("[data-count]").forEach(function (n) {
			var to = +n.getAttribute("data-count") || 0, t0 = null;
			if (reduce) { n.textContent = to; return; }
			function step(t) {
				if (!t0) t0 = t;
				var p = Math.min((t - t0) / 1300, 1);
				n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
				if (p < 1) requestAnimationFrame(step);
			}
			requestAnimationFrame(step);
		});
	}, delay || 300);
};

/* ---------- подключение счётчиков из админки ----------
   Поля GA4 / Ads / TikTok / Meta в админке были, но код счётчика
   на сайт не вставлялся — статистика никуда не шла. */
GH.analytics = function () {
	var a = D.analytics || {};
	function inject(src, init) {
		var sc = document.createElement("script");
		sc.async = true; sc.src = src;
		document.head.appendChild(sc);
		if (init) { var i = document.createElement("script"); i.textContent = init; document.head.appendChild(i); }
	}
	var id = String(a.ga4 || "").trim();
	if (/^G-[A-Z0-9]{6,}$/i.test(id)) {
		window.dataLayer = window.dataLayer || [];
		window.gtag = function () { window.dataLayer.push(arguments); };
		window.gtag("js", new Date());
		window.gtag("config", id, { anonymize_ip: true });
		inject("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id));
		var ads = String(a.gads || "").trim();
		if (/^AW-[0-9]{6,}$/i.test(ads)) window.gtag("config", ads);
	}
	var ym = String(a.metrika || "").trim();
	if (/^\d{6,9}$/.test(ym)) {
		/* Яндекс.Метрика — в Казахстане её данные полнее, чем у GA */
		(function (m, e, t, r, i, k) {
			m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
			m[i].l = 1 * new Date();
			k = e.createElement(t); k.async = 1; k.src = r;
			e.head.appendChild(k);
		})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
		window.ym(+ym, "init", { clickmap: true, trackLinks: true,
			accurateTrackBounce: true, webvisor: true });
	}
	var tt = String(a.ttq || "").trim();
	if (/^[A-Z0-9]{10,}$/i.test(tt)) {
		window.TiktokAnalyticsObject = "ttq";
		var ttq = window.ttq = window.ttq || [];
		ttq.methods = ["page", "track", "identify"];
		ttq.methods.forEach(function (mth) { ttq[mth] = function () { ttq.push([mth].concat([].slice.call(arguments))); }; });
		inject("https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + encodeURIComponent(tt) + "&lib=ttq");
		ttq.page();
	}
	var fb = String(a.fbp || "").trim();
	if (/^\d{10,}$/.test(fb)) {
		!function (f, b, e, v, n, t, sc) {
			if (f.fbq) return; n = f.fbq = function () {
				n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
			};
			if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
			t = b.createElement(e); t.async = !0; t.src = v;
			sc = b.getElementsByTagName(e)[0]; sc.parentNode.insertBefore(t, sc);
		}(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
		window.fbq("init", fb); window.fbq("track", "PageView");
	}
};

/* Дублируем события во все подключённые счётчики */
GH.trackAll = function (event, extra) {
	if (typeof window.ym === "function" && D.analytics && D.analytics.metrika) {
		try { window.ym(+D.analytics.metrika, "reachGoal", event, extra || {}); } catch (e) {}
	}
	if (typeof window.ttq === "object" && window.ttq.track) {
		try { window.ttq.track("ClickButton", { content_name: event }); } catch (e) {}
	}
	if (typeof window.fbq === "function") {
		try { window.fbq("trackCustom", event, extra || {}); } catch (e) {}
	}
};

/* ---------- трекинг кликов ---------- */
GH.autoTrack = function (theme) {
	GH.track("view", { theme: theme });
	document.addEventListener("click", function (e) {
		var a = e.target.closest("a");
		if (!a) return;
		var href = a.getAttribute("href") || "";
		if (a.hasAttribute("data-ev")) GH.track(a.getAttribute("data-ev"));
		else if (href.indexOf("wa.me") > -1) GH.track("whatsapp_click");
		else if (href.indexOf("tel:") === 0) GH.track("phone_click");
		else if (href.indexOf("instagram") > -1) GH.track("instagram_click");
	});
	var t0 = Date.now(), sent = {}, ticking = false;
	addEventListener("scroll", function () {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(function () {
			ticking = false;
			var h = document.body.scrollHeight - innerHeight;
			var p = h > 0 ? Math.round((scrollY / h) * 100) : 100;
			[50, 90].forEach(function (m) {
				if (p >= m && !sent[m]) { sent[m] = 1; GH.track("scroll_" + m); }
			});
		});
	}, { passive: true });
	/* beforeunload на iOS Safari часто не срабатывает — pagehide надёжнее */
	var stayed = false;
	function markStay() {
		if (stayed) return;
		var sec = Math.round((Date.now() - t0) / 1000);
		if (sec > 20) { stayed = true; GH.track("stay_20s"); }
	}
	addEventListener("pagehide", markStay);
	addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") markStay(); });
};

/* ---------- старт ---------- */
GH.boot = function (opts) {
	opts = opts || {};
	/* каждый шаг изолирован: сломанный блок не должен уносить всю страницу */
	function safe(name, fn) {
		try { fn(); }
		catch (e) { if (window.console) console.error("GH." + name + " упал:", e); }
	}
	GH._safe = safe;
	safe("seo", function () { GH.seo(opts); });
	["bindText", "renderMarquee", "renderFacts", "renderHalls", "renderTrust",
	 "renderMenus", "renderExtras", "renderCompare", "renderGallery", "renderTimeline",
	 "renderFaq", "renderReviews", "renderCalc", "calcGate", "renderForm", "renderContacts"
	].forEach(function (n) { safe(n, GH[n]); });
	safe("reveal", function () { GH.reveal(opts.revealFallback); });
	safe("counters", function () { GH.counters(opts.counterDelay); });
	safe("analytics", GH.analytics);
	safe("autoTrack", function () { GH.autoTrack(opts.theme || "?"); });
};
})();
