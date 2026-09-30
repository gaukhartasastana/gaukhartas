/* Админ-панель «Гаухартас». 
   Работает гибридно: через серверный API (Express /api/content), 
   а при отсутствии сервера — локально с localStorage['gh_content'] и GH_DEFAULT. */
var KC="gh_content",KS="gh_stats",KL="gh_leads";
function $(i){return document.getElementById(i)}
function deep(o){return JSON.parse(JSON.stringify(o))}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function money(n){return String(Math.round(+n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,"\u2009")+"\u00a0\u20b8"}
function jget(k,d){try{var r=localStorage.getItem(k);return r?JSON.parse(r):d}catch(e){return d}}
function loadData(cb) {
  fetch('/api/content').then(function(r){if(!r.ok)throw new Error();return r.json()}).then(function(override){
    var b = deep(window.GH_DEFAULT || {});
    if(override && typeof override === 'object') Object.keys(override).forEach(function(k){b[k]=override[k]});
    cb(b);
  }).catch(function(){
    var b = deep(window.GH_DEFAULT || {});
    var o = jget(KC, null);
    if(o) Object.keys(o).forEach(function(k){b[k]=o[k]});
    cb(b);
  });
}
var D = {};
var USER_PIN = '';

/* ============================================================
   ВАЛИДАЦИЯ ПЕРЕД ЗАПИСЬЮ
   Раньше в localStorage['gh_content'] улетало что угодно —
   пустой массив залов или цена «абв» роняли сайт у клиентов.
   ============================================================ */
function isObj(v){ return v !== null && typeof v === 'object' && !Array.isArray(v) }

function validate(d){
  var err = [];
  if(!isObj(d)) return ['Данные повреждены — сохранение отменено.'];

  if(!Array.isArray(d.halls) || !d.halls.length) err.push('Нужен хотя бы один зал.');
  else d.halls.forEach(function(h,i){
    var nm = (h && h.name) || ('зал №' + (i+1));
    if(!isObj(h)){ err.push('Зал №'+(i+1)+': повреждён.'); return }
    if(!String(h.name||'').trim()) err.push('Зал №'+(i+1)+': пустое название.');
    if(!h.id) err.push('Зал «'+nm+'»: потерян системный id.');
    if(!isFinite(+h.max) || +h.max < 1) err.push('«'+nm+'»: максимум гостей должен быть числом больше 0.');
    if(!isFinite(+h.min) || +h.min < 0) err.push('«'+nm+'»: минимум гостей должен быть числом от 0.');
    if(isFinite(+h.min) && isFinite(+h.max) && +h.min > +h.max)
      err.push('«'+nm+'»: минимум ('+h.min+') больше максимума ('+h.max+').');
    ['sound','decor'].forEach(function(k){
      if(!isFinite(+h[k]) || +h[k] < 0)
        err.push('«'+nm+'»: '+(k==='sound'?'аппаратура':'оформление')+' — некорректная сумма.');
    });
  });

  if(!Array.isArray(d.menus) || !d.menus.length) err.push('Нужно хотя бы одно меню.');
  else d.menus.forEach(function(m,i){
    var nm = (m && m.name) || ('меню №' + (i+1));
    if(!isObj(m)){ err.push('Меню №'+(i+1)+': повреждено.'); return }
    if(!String(m.name||'').trim()) err.push('Меню №'+(i+1)+': пустое название.');
    if(!m.id) err.push('Меню «'+nm+'»: потерян системный id.');
    if(!isFinite(+m.price) || +m.price <= 0) err.push('«'+nm+'»: цена должна быть числом больше нуля.');
    if(+m.price > 1000000) err.push('«'+nm+'»: цена '+m.price+' ₸ на персону — похоже на опечатку.');
    if(!Array.isArray(m.dishes) || !m.dishes.length) err.push('«'+nm+'»: не заполнен состав.');
  });

  /* дубли id ломают выбор зала и меню на сайте */
  ['halls','menus'].forEach(function(k){
    if(!Array.isArray(d[k])) return;
    var seen = {};
    d[k].forEach(function(x){
      if(!x || !x.id) return;
      if(seen[x.id]) err.push('Повторяющийся id «'+x.id+'» в разделе '+(k==='halls'?'залов':'меню')+'.');
      seen[x.id] = 1;
    });
  });

  var c = d.contacts;
  if(!isObj(c)) err.push('Потерян блок контактов.');
  else {
    if(!/^\d{10,15}$/.test(String(c.whatsapp||'')))
      err.push('WhatsApp: нужен номер только из цифр с кодом страны, например 77760077725.');
    if(!String(c.phone1||'').trim()) err.push('Не заполнен основной телефон.');
    if(c.lat !== undefined && (!isFinite(+c.lat) || Math.abs(+c.lat) > 90))
      err.push('Широта вне допустимого диапазона.');
    if(c.lon !== undefined && (!isFinite(+c.lon) || Math.abs(+c.lon) > 180))
      err.push('Долгота вне допустимого диапазона.');
  }

  /* PIN больше не хранится в контенте — он задаётся на сервере
     в ADMIN_PIN. Проверять здесь нечего. */

  ['faq','trust','timeline','gallery','formats','included'].forEach(function(k){
    if(d[k] !== undefined && !Array.isArray(d[k]))
      err.push('Раздел «'+k+'» повреждён — ожидается список.');
  });

  /* объём: localStorage обычно ~5 МБ на домен */
  try{
    var bytes = new Blob([JSON.stringify(d)]).size;
    if(bytes > 3 * 1024 * 1024)
      err.push('Данные весят '+Math.round(bytes/1024/1024*10)/10+' МБ — браузер столько не сохранит.');
  }catch(e){}

  return err;
}

/* Единая безопасная запись в localStorage */
function saveLocal(d){
  try{
    localStorage.setItem(KC, JSON.stringify(d));
    return null;
  }catch(e){
    return e && e.name === 'QuotaExceededError'
      ? 'Не хватило места в браузере. Уменьшите объём текста или используйте экспорт в файл.'
      : 'Браузер не разрешил сохранение: ' + (e && e.message || e);
  }
}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("on");setTimeout(function(){e.classList.remove("on")},2200)}
function dirty(){$("tag").textContent="Есть несохранённые правки";$("tag").className="pill w"}
function clean(){$("tag").textContent="Сохранено";$("tag").className="pill g"}
function dl(blob,name){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},4000)}

/* ---------- вход ---------- */
function login(){
  var pin = String($("pin").value || "").trim();
  var err = $("gerr");
  if (!pin) { err.textContent = "Введите PIN"; $("pin").focus(); return; }
  err.textContent = "Проверяем…";

  fetch('/api/stats', { headers: { 'X-Pin': pin } }).then(function(r) {
    if (r.ok) {
      sessionStorage.setItem("gh_pin", pin);
      USER_PIN = pin;
      err.textContent = "";
      $("gate").style.display = "none";
      boot();
      return;
    }
    /* Раньше любой не-200 показывался как «Неверный PIN». Из-за этого
       недоступный API выглядел как ошибка ввода, и человек по кругу
       перебирал правильный пароль. Теперь причины разделены. */
    if (r.status === 403) {
      err.innerHTML = "Неверный PIN.<br><small>Если уверены, что верный — " +
        "откройте админку в режиме инкогнито (браузер мог сохранить старую версию). " +
        "Не помогло — на сервере: <code>sudo bash deploy/aws/check.sh</code></small>";
      $("pin").value = ""; $("pin").focus();
    } else if (r.status === 404) {
      err.innerHTML = "PIN не проверен: сервер не отвечает на <code>/api/stats</code> (404).<br>" +
        "nginx не проксирует <code>/api/</code> в Node. На сервере:<br>" +
        "<code>sudo nginx -T | grep -A3 'location /api'</code>";
    } else if (r.status === 429) {
      err.textContent = "Слишком много попыток. Подождите минуту.";
    } else if (r.status >= 500) {
      err.innerHTML = "Ошибка сервера (" + r.status + "). Логи:<br>" +
        "<code>journalctl -u gaukhartas -n 30</code>";
    } else {
      err.textContent = "Сервер ответил " + r.status + " — PIN не проверен.";
    }
  }).catch(function(e){
    /* сюда попадаем только при обрыве сети, а не при неверном PIN */
    err.innerHTML = "Нет связи с сервером. Проверьте, что служба запущена:<br>" +
      "<code>sudo systemctl status gaukhartas</code>";
  });
}
$("gbtn").addEventListener("click",login);
document.addEventListener("click",function(e){ if(e.target && e.target.id==="notifyBtn") askNotify(); });
$("pin").addEventListener("keydown",function(e){if(e.key==="Enter")login()});

/* ---------- табы ---------- */
document.querySelectorAll(".tab").forEach(function(t){t.addEventListener("click",function(){
  document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("on")});
  document.querySelectorAll(".pane").forEach(function(x){x.classList.remove("on")});
  t.classList.add("on");$("p-"+t.getAttribute("data-p")).classList.add("on");window.scrollTo(0,0);
})});
$("open").addEventListener("click",function(){window.open("../index.html","_blank")});

/* ---------- статистика ---------- */
var EVN={view:"Просмотры сайта",whatsapp_click:"Переходы в WhatsApp",phone_click:"Клики по телефону",form_submit:"Заявки из формы",calc_send:"Сметы из калькулятора",tier_pick:"Выбор меню",hall_cta:"Интерес к залу",gallery_open:"Открытия фото",faq_open:"Открытия вопросов",format_tab:"Выбор формата",scroll_50:"Дочитали до половины",scroll_90:"Дочитали до конца",stay_20s:"Пробыли >20 сек",route_2gis:"Маршрут в 2ГИС",route_yandex:"Маршрут в Яндексе",route_google:"Маршрут в Google",instagram_click:"Переходы в Instagram"};

function renderStats(){
  fetch('/api/stats', {headers:{'X-Pin':USER_PIN}}).then(function(r){return r.json()}).then(function(s){
    fetch('/api/leads', {headers:{'X-Pin':USER_PIN}}).then(function(r){return r.json()}).then(function(L){
      drawStatsUI(s, L);
    });
  }).catch(function(){
    var s = jget(KS, {}), L = jget(KL, []);
    drawStatsUI(s, L);
  });
}

var ST_DAYS = 30;          /* выбранный период */
var ST_CACHE = null;       /* последние данные — чтобы не дёргать сервер при смене периода */

function dayKeys(n, offset) {
  var out = [], d = new Date();
  d.setDate(d.getDate() - (offset || 0));
  for (var i = n - 1; i >= 0; i--) {
    var x = new Date(d); x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}
function sumDays(s, keys, ev) {
  return keys.reduce(function (a, k) { return a + (((s.days || {})[k] || {})[ev] || 0); }, 0);
}
/* Стрелка «стало лучше / хуже» относительно прошлого такого же периода */
function delta(now, was) {
  if (!was && !now) return '<span class="dlt eq">—</span>';
  if (!was) return '<span class="dlt up">новое</span>';
  var p = Math.round((now - was) / was * 100);
  if (p === 0) return '<span class="dlt eq">без изменений</span>';
  return '<span class="dlt ' + (p > 0 ? 'up">+' : 'dn">') + p + '%</span>';
}
function plural(n, a, b, c) {
  var d = n % 100; if (d > 10 && d < 20) return c;
  d = n % 10; return d === 1 ? a : (d > 1 && d < 5 ? b : c);
}

function drawStatsUI(s, L) {
  ST_CACHE = { s: s, L: L };
  var now = dayKeys(ST_DAYS), prev = dayKeys(ST_DAYS, ST_DAYS);

  var v    = sumDays(s, now, 'view');
  var wa   = sumDays(s, now, 'whatsapp_click');
  var call = sumDays(s, now, 'call_click');
  var lead = sumDays(s, now, 'lead_submit') + sumDays(s, now, 'form_submit') + sumDays(s, now, 'calc_send');
  var deep = sumDays(s, now, 'scroll_90');
  var half = sumDays(s, now, 'scroll_50');
  var stay = sumDays(s, now, 'stay20');

  var pv    = sumDays(s, prev, 'view');
  var pwa   = sumDays(s, prev, 'whatsapp_click');
  var pcall = sumDays(s, prev, 'call_click');
  var plead = sumDays(s, prev, 'lead_submit') + sumDays(s, prev, 'form_submit') + sumDays(s, prev, 'calc_send');

  var touch = wa + call + lead, ptouch = pwa + pcall + plead;
  var conv  = v ? (touch / v * 100) : 0;
  var pconv = pv ? (ptouch / pv * 100) : 0;

  $('st-period').textContent = 'За последние ' + ST_DAYS + ' ' +
    plural(ST_DAYS, 'день', 'дня', 'дней') + ' · сравнение с предыдущими ' + ST_DAYS;

  /* Подсказка простым языком: что делать с этими цифрами */
  var note = '';
  if (v < 30) {
    note = '<b>Данных пока мало.</b> ' + v + ' ' + plural(v, 'посещение', 'посещения', 'посещений') +
           ' — по такой выборке выводы делать рано. Ориентир: 500 посещений в месяц, ' +
           'тогда проценты станут honest.';
  } else if (touch === 0) {
    note = '<b>Люди заходят, но не пишут.</b> Посещений ' + v + ', обращений ноль. ' +
           'Проверьте, видно ли кнопку WhatsApp и работает ли форма.';
  } else if (conv >= 4) {
    note = '<b>Конверсия ' + conv.toFixed(1) + '% — это хорошо.</b> ' +
           'Норма для сайта услуг 1—3%. Сайт свою работу делает, теперь нужен трафик: ' +
           'при нынешних ' + v + ' посещениях больше ' + touch + ' обращений не выжать.';
  } else {
    note = '<b>Конверсия ' + conv.toFixed(1) + '%.</b> Норма 1—3%, так что вы в рынке. ' +
           'Чтобы поднять — сделайте кнопку WhatsApp заметнее и добавьте отзывы на сайт.';
  }
  $('st-alert').innerHTML = '<div class="st-note">' + note.replace('honest', 'честными') + '</div>';

  function kpi(cls, val, label, exp, d) {
    return '<div class="kpi ' + cls + '">' + (d || '') +
           '<b>' + val + '</b><span class="lbl">' + label + '</span>' +
           '<span class="exp">' + exp + '</span></div>';
  }
  $('kpis').innerHTML =
    kpi('hero', v, 'посещений сайта',
        'Сколько раз открыли сайт за период', delta(v, pv)) +
    kpi('good', touch, 'обращений',
        'Написали в WhatsApp, позвонили или оставили заявку', delta(touch, ptouch)) +
    kpi('', conv.toFixed(1) + '%', 'конверсия',
        'Какая доля посетителей обратилась. Норма 1—3%', delta(Math.round(conv * 10), Math.round(pconv * 10))) +
    kpi('', wa, 'в WhatsApp',
        'Нажали кнопку WhatsApp', delta(wa, pwa)) +
    kpi('', call, 'нажали телефон',
        'Нажали на номер, чтобы позвонить', delta(call, pcall)) +
    kpi('', L.length, 'заявок в списке',
        'Отправлено через форму на сайте', '');

  /* ── График по дням ── */
  var span = ST_DAYS > 45 ? 45 : ST_DAYS;
  var days = dayKeys(span);
  var vals = days.map(function (k) { return ((s.days || {})[k] || {}).view || 0; });
  var mx = Math.max.apply(null, vals.concat([1]));
  var today = new Date().toISOString().slice(0, 10);
  $('chart').innerHTML = days.map(function (k, i) {
    return '<div class="bar' + (k === today ? ' today' : '') +
      '" style="height:' + Math.max(3, vals[i] / mx * 100) + '%" title="' +
      k.slice(8) + '.' + k.slice(5, 7) + ' — ' + vals[i] + '"></div>';
  }).join('');
  var step = Math.ceil(span / 7);
  $('xax').innerHTML = days.map(function (k, i) {
    return '<span>' + (i % step ? '' : k.slice(8) + '.' + k.slice(5, 7)) + '</span>';
  }).join('');
  $('ch-legend').textContent = 'максимум за день: ' + mx + ' · зелёным сегодня';

  /* ── Воронка: где теряются люди ── */
  var steps = [
    ['Открыли сайт', v, 'Зашли на страницу'],
    ['Задержались', stay, 'Пробыли больше 20 секунд'],
    ['Долистали до середины', half, 'Дошли до залов и меню'],
    ['Дочитали до конца', deep, 'Досмотрели до контактов'],
    ['Обратились', touch, 'WhatsApp, звонок или заявка']
  ];
  var base = v || 1, fh = '<div class="fn">';
  steps.forEach(function (st, i) {
    var pct = Math.round(st[1] / base * 100);
    fh += '<div class="fn-row">' +
      '<div class="fn-bar"><i style="width:' + Math.max(2, pct) + '%"></i>' +
      '<span>' + st[0] + '</span></div>' +
      '<div class="fn-n">' + st[1] + '<small>' + pct + '%</small></div></div>';
    if (i < steps.length - 1) {
      var lost = st[1] - steps[i + 1][1];
      if (lost > 0 && st[1] > 0) {
        fh += '<div class="fn-drop">↓ ушло ' + lost + ' ' +
              plural(lost, 'человек', 'человека', 'человек') +
              ' (' + Math.round(lost / st[1] * 100) + '%)</div>';
      }
    }
  });
  fh += '</div>';
  if (!v) fh = '<p class="sub" style="margin:0">Пока нет данных. Откройте сайт — счётчики начнут писать.</p>';
  $('funnel').innerHTML = fh;

  /* ── Меню ── */
  var tr = s.tiers || {}, tot = 0;
  Object.keys(tr).forEach(function (k) { tot += tr[k]; });
  $('tiers').innerHTML = (D.menus || []).map(function (m) {
    var n = tr[m.id] || 0, p = tot ? Math.round(n / tot * 100) : 0;
    return '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between">' +
      '<span>' + esc(m.name) + ' · ' + money(m.price) + '</span><b>' + n + ' · ' + p + '%</b></div>' +
      '<div class="mini"><i style="width:' + p + '%"></i></div></div>';
  }).join('') + (tot ? '' : '<p class="sub" style="margin:0">Пока никто не листал меню.</p>');

  /* ── Все события ── */
  var T = s.total || {};
  var rows = Object.keys(EVN).filter(function (k) { return T[k]; }).map(function (k) {
    return '<tr><td>' + EVN[k] + '</td><td style="text-align:right"><b>' + T[k] + '</b></td></tr>';
  }).join('');
  $('evt').innerHTML = '<thead><tr><th>Событие</th><th style="text-align:right">Всего за всё время</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="2" class="sub">Данных пока нет.</td></tr>') + '</tbody>';

  /* ── Отчёт одной кнопкой ── */
  $('st-report').onclick = function () {
    var arrow = function (n, p) { return !p ? '' : (n >= p ? ' (+' : ' (') + Math.round((n - p) / p * 100) + '%)'; };
    var txt = 'Отчёт по сайту за ' + ST_DAYS + ' ' + plural(ST_DAYS, 'день', 'дня', 'дней') + '\n\n' +
      'Посещений: ' + v + arrow(v, pv) + '\n' +
      'Обращений: ' + touch + arrow(touch, ptouch) + '\n' +
      '  · WhatsApp: ' + wa + '\n  · Звонки: ' + call + '\n  · Заявки с формы: ' + lead + '\n' +
      'Конверсия: ' + conv.toFixed(1) + '% (норма для сайта услуг 1—3%)\n' +
      'Дочитали страницу до конца: ' + deep + '\n\n' +
      'Период: последние ' + ST_DAYS + ' дн., в скобках — сравнение с предыдущими ' + ST_DAYS + '.';
    try { navigator.clipboard.writeText(txt); toast('Отчёт скопирован'); }
    catch (e) { toast('Не удалось скопировать'); }
  };
}

/* переключатель периода */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('#st-rng button');
  if (!b) return;
  ST_DAYS = +b.dataset.d;
  Array.prototype.forEach.call(document.querySelectorAll('#st-rng button'), function (x) {
    x.classList.toggle('on', x === b);
  });
  if (ST_CACHE) drawStatsUI(ST_CACHE.s, ST_CACHE.L); else renderStats();
});


/* ═══ УВЕДОМЛЕНИЯ О НОВЫХ ЗАЯВКАХ ═══
   Проверяем раз в минуту, пока вкладка открыта. Метка на вкладке «Заявки»
   и системное уведомление, если разрешили. Без опроса сервера каждую
   секунду — заявки не настолько частые, чтобы жечь батарею. */
var LEADS_SEEN = 'gh_leads_seen';
function seenCount() { try { return +localStorage.getItem(LEADS_SEEN) || 0; } catch (e) { return 0; } }
function markSeen(n) { try { localStorage.setItem(LEADS_SEEN, String(n)); } catch (e) {} }

function paintLeadBadge(total) {
  var fresh = Math.max(0, total - seenCount());
  var tab = document.querySelector('.tab[data-p="leads"]');
  if (!tab) return;
  var b = tab.querySelector('.badge');
  if (!fresh) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('i'); b.className = 'badge'; tab.appendChild(b); }
  b.textContent = fresh > 99 ? '99+' : fresh;
}

function notifyNew(n, last) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('Новая заявка — Гаухартас', {
      body: (last && last.name ? last.name : 'Клиент') +
            (last && last.phone ? ', ' + last.phone : '') +
            (n > 1 ? ' (и ещё ' + (n - 1) + ')' : ''),
      icon: '../assets/logo.webp',
      tag: 'gh-lead'
    });
  } catch (e) {}
}

var lastKnown = null;
function pollLeads() {
  if (!USER_PIN || document.hidden) return;
  fetch('/api/leads', { headers: { 'X-Pin': USER_PIN } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (L) {
      if (!Array.isArray(L)) return;
      if (lastKnown !== null && L.length > lastKnown) {
        notifyNew(L.length - lastKnown, L[0]);
        toast('Новая заявка: ' + ((L[0] && L[0].name) || 'клиент'));
        renderLeads();
      }
      lastKnown = L.length;
      paintLeadBadge(L.length);
    })
    .catch(function () {});
}

function askNotify() {
  if (!('Notification' in window)) { toast('Браузер не умеет уведомления'); return; }
  Notification.requestPermission().then(function (p) {
    toast(p === 'granted' ? 'Уведомления включены' : 'Уведомления отключены');
    var btn = document.getElementById('notifyBtn');
    if (btn && p === 'granted') btn.textContent = 'Уведомления включены';
  });
}

setInterval(pollLeads, 60000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) pollLeads(); });

/* ---------- заявки ---------- */
function renderLeads(){
  fetch('/api/leads', {headers:{'X-Pin':USER_PIN}}).then(function(r){return r.json()}).then(function(L){
    drawLeadsUI(L);
  }).catch(function(){
    var L = jget(KL, []);
    drawLeadsUI(L);
  });
}

function drawLeadsUI(L) {
  markSeen(L.length); paintLeadBadge(L.length); lastKnown = L.length;
  if(!L.length){$("lt").innerHTML='<tbody><tr><td class="sub">Заявок пока нет.</td></tr></tbody>';return}
  $("lt").innerHTML="<thead><tr><th>Когда</th><th>Имя</th><th>Телефон</th><th>Формат</th><th>Дата</th><th>Гости</th><th>Зал</th><th>Меню</th><th>Смета</th><th>Комментарий</th></tr></thead><tbody>"+
  L.map(function(l){return "<tr><td>"+new Date(l.at).toLocaleString("ru-RU")+"</td><td><b>"+esc(l.name||"—")+"</b></td><td>"+esc(l.phone||"—")+"</td><td>"+esc(l.event||(l.source==="calc"?"калькулятор":"—"))+"</td><td>"+esc(l.date||"—")+"</td><td>"+(l.guests||"—")+"</td><td>"+esc(l.hall||"—")+"</td><td>"+esc(l.menu||"—")+"</td><td>"+(l.total?money(l.total):"—")+"</td><td>"+esc(l.note||"")+"</td></tr>"}).join("")+"</tbody>";
}

$("csv").addEventListener("click",function(){
  fetch('/api/leads', {headers:{'X-Pin':USER_PIN}}).then(function(r){return r.json()}).then(function(L){
    exportCSV(L);
  }).catch(function(){
    var L = jget(KL, []);
    exportCSV(L);
  });
});

function exportCSV(L) {
  if(!L.length){toast("Заявок нет");return}
  var h=["Дата","Имя","Телефон","Формат","Дата торжества","Гостей","Зал","Меню","Смета","Комментарий"];
  var rows=L.map(function(l){return[new Date(l.at).toLocaleString("ru-RU"),l.name||"",l.phone||"",l.event||l.source||"",l.date||"",l.guests||"",l.hall||"",l.menu||"",l.total||"",l.note||""]});
  var csv="\ufeff"+[h].concat(rows).map(function(r){return r.map(function(c){return'"'+String(c).replace(/"/g,'""')+'"'}).join(";")}).join("\r\n");
  dl(new Blob([csv],{type:"text/csv;charset=utf-8"}),"gaukhartas-zayavki.csv");
}

$("clrL").addEventListener("click",function(){
  if(confirm("Удалить все заявки?")){
    fetch('/api/leads', {method:'DELETE',headers:{'X-Pin':USER_PIN}}).then(function(){
      renderLeads();renderStats();toast("Список очищен");
    }).catch(function(){
      localStorage.removeItem(KL);renderLeads();renderStats();toast("Список очищен");
    });
  }
});

/* ---------- редакторы ---------- */
function yn(v){return '<option value="1"'+(v?" selected":"")+">Да</option><option value=\"0\""+(v?"":" selected")+">Нет</option>"}
function renderMenu(){
  $("med").innerHTML=(D.menus||[]).map(function(m,i){return '<div class="card"><h3>'+esc(m.name)+' · '+money(m.price)+'</h3><div class="grid">'+
   '<label class="f"><span>Название</span><input data-m="'+i+'" data-k="name" value="'+esc(m.name)+'"></label>'+
   '<label class="f"><span>Цена на персону, ₸</span><input type="number" data-m="'+i+'" data-k="price" value="'+m.price+'"></label>'+
   '<label class="f"><span>Подпись под ценой</span><input data-m="'+i+'" data-k="note" value="'+esc(m.note)+'"></label>'+
   '<label class="f"><span>Мясо для бешбармака</span><input data-m="'+i+'" data-k="meat" value="'+esc(m.meat)+'"></label>'+
   '<label class="f"><span>Только в будни</span><select data-m="'+i+'" data-k="weekdayOnly">'+yn(m.weekdayOnly)+"</select></label>"+
   '<label class="f"><span>Отметка «Берут чаще»</span><select data-m="'+i+'" data-k="pick">'+yn(m.pick)+"</select></label>"+
   '</div><div class="hr"></div><label class="f"><span>Состав — каждое блюдо с новой строки</span><textarea rows="7" data-m="'+i+'" data-k="dishes">'+esc((m.dishes||[]).join("\n"))+"</textarea></label>"+
   '<div style="margin-top:12px"><label class="f"><span>Подарки — каждый с новой строки</span><textarea rows="4" data-m="'+i+'" data-k="gifts">'+esc((m.gifts||[]).join("\n"))+"</textarea></label></div></div>"}).join("");
}
function renderHalls(){
  $("hed").innerHTML=(D.halls||[]).map(function(h,i){return '<div class="card"><h3>'+esc(h.name)+'</h3><div class="grid">'+
   '<label class="f"><span>Название</span><input data-h="'+i+'" data-k="name" value="'+esc(h.name)+'"></label>'+
   '<label class="f"><span>Минимум гостей</span><input type="number" data-h="'+i+'" data-k="min" value="'+h.min+'"></label>'+
   '<label class="f"><span>Максимум гостей</span><input type="number" data-h="'+i+'" data-k="max" value="'+h.max+'"></label>'+
   '<label class="f"><span>Аппаратура, ₸</span><input type="number" data-h="'+i+'" data-k="sound" value="'+h.sound+'"></label>'+
   '<label class="f"><span>Оформление, ₸</span><input type="number" data-h="'+i+'" data-k="decor" value="'+h.decor+'"></label>'+
   '</div><div style="margin-top:12px"><label class="f"><span>Описание</span><textarea rows="3" data-h="'+i+'" data-k="text">'+esc(h.text)+"</textarea></label></div></div>"}).join("");
}
function renderFaq(){
  $("fed").innerHTML=(D.faq||[]).map(function(f,i){return '<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #2A313B"><div class="dish"><input data-q="'+i+'" value="'+esc(f[0])+'" placeholder="Вопрос"><button class="x" data-del="'+i+'">✕</button></div><textarea rows="2" data-a="'+i+'" placeholder="Ответ">'+esc(f[1])+"</textarea></div>"}).join("");
  document.querySelectorAll("[data-del]").forEach(function(b){b.addEventListener("click",function(){collect();D.faq.splice(+b.getAttribute("data-del"),1);renderFaq();dirty()})});
}
$("addF").addEventListener("click",function(){collect();if(!D.faq)D.faq=[];D.faq.push(["Новый вопрос","Ответ"]);renderFaq();dirty()});
function fillSimple(){
  var h=D.hero||{},a=D.about||{},c=D.contacts||{},s=D.settings||{},an=D.analytics||{};
  $("h-k").value=h.kicker||"";$("h-1").value=h.title1||"";$("h-2").value=h.title2||"";$("h-3").value=h.title3||"";$("h-l").value=h.lead||"";
  $("a-t").value=a.title||"";$("a-1").value=a.p1||"";$("a-2").value=a.p2||"";$("a-3").value=a.p3||"";
  $("c-p1").value=c.phone1||"";$("c-p2").value=c.phone2||"";$("c-wa").value=c.whatsapp||"";$("c-ig").value=c.instagram||"";
  $("c-ad").value=c.address||"";$("c-ct").value=c.city||"";$("c-hr").value=c.hours||"";$("c-hs").value=c.hoursShort||"";
  $("c-la").value=c.lat||"";$("c-lo").value=c.lon||"";$("c-2g").value=c.map2gis||"";$("c-lm").value=c.landmark||"";$("c-dm").value=(D.brand&&D.brand.domain)||"";
  $("s-we").value=s.weekendUpsell?"1":"0";$("s-calc").value=s.showCalc?"1":"0";
  $("ga4").value=an.ga4||"";$("gads").value=an.gads||"";$("ttq").value=an.ttq||"";$("fbp").value=an.fbp||"";
  if($("metrika"))$("metrika").value=an.metrika||"";
}

/* ---------- сбор и сохранение ---------- */
function val(id){var n=$(id);return n?n.value:""}
function collect(){
  if(!Array.isArray(D.menus))D.menus=[];
  if(!Array.isArray(D.halls))D.halls=[];
  if(!Array.isArray(D.faq))D.faq=[];
  document.querySelectorAll("[data-m]").forEach(function(n){var m=D.menus[+n.getAttribute("data-m")],k=n.getAttribute("data-k");
    if(!m)return;
    if(k==="price")m.price=+n.value||0;
    else if(k==="dishes"||k==="gifts")m[k]=n.value.split("\n").map(function(s){return s.trim()}).filter(Boolean);
    else if(k==="weekdayOnly"||k==="pick")m[k]=n.value==="1";
    else m[k]=n.value});
  document.querySelectorAll("[data-h]").forEach(function(n){var h=D.halls[+n.getAttribute("data-h")],k=n.getAttribute("data-k");
    if(!h)return;
    h[k]=(k==="min"||k==="max"||k==="sound"||k==="decor")?(+n.value||0):n.value});
  document.querySelectorAll("[data-q]").forEach(function(n){var f=D.faq[+n.getAttribute("data-q")];if(f)f[0]=n.value});
  document.querySelectorAll("[data-a]").forEach(function(n){var f=D.faq[+n.getAttribute("data-a")];if(f)f[1]=n.value});
  D.hero={kicker:$("h-k").value,title1:$("h-1").value,title2:$("h-2").value,title3:$("h-3").value,lead:$("h-l").value};
  D.about={title:$("a-t").value,p1:$("a-1").value,p2:$("a-2").value,p3:$("a-3").value};
  var c=D.contacts||{};
  c.phone1=$("c-p1").value;c.phone2=$("c-p2").value;c.whatsapp=$("c-wa").value.replace(/\D/g,"");
  c.instagram=$("c-ig").value.replace(/^@/,"");c.address=$("c-ad").value;c.city=$("c-ct").value;
  c.hours=$("c-hr").value;c.hoursShort=$("c-hs").value;c.lat=+$("c-la").value;c.lon=+$("c-lo").value;
  c.map2gis=$("c-2g").value;c.landmark=$("c-lm").value;
  var dm=$("c-dm").value.trim();if(!D.brand)D.brand={};D.brand.domain=dm+(dm&&dm.slice(-1)!=="/"?"/":"");
  if(!D.settings)D.settings={};
  D.settings.weekendUpsell=$("s-we").value==="1";
  D.settings.showCalc=$("s-calc").value==="1";
  D.analytics={ga4:val("ga4").trim(),gads:val("gads").trim(),ttq:val("ttq").trim(),
    fbp:val("fbp").trim(),metrika:val("metrika").replace(/\D/g,"")};
}
document.addEventListener("input",function(e){if(e.target.closest("main"))dirty()});
$("save").addEventListener("click",function(){
  collect();
  var problems = validate(D);
  if(problems.length){
    alert('Сохранение отменено — иначе сайт сломается:\n\n· ' +
          problems.slice(0,10).join('\n· ') +
          (problems.length>10 ? '\n\n…и ещё '+(problems.length-10) : ''));
    toast('Не сохранено: ' + problems.length + ' ' +
          (problems.length===1?'ошибка':'ошибок'));
    return;
  }
  fetch('/api/content', {
    method:'POST',
    headers:{'Content-Type':'application/json','X-Pin':USER_PIN},
    body:JSON.stringify(D)
  }).then(function(r){
    if(r.ok){
      saveLocal(D);clean();renderStats();toast("Сохранено — обновите страницу сайта");
    } else {
      throw new Error();
    }
  }).catch(function(){
    var e = saveLocal(D);
    if(e){ alert("Не удалось сохранить.\n\n"+e); toast("Ошибка сохранения"); }
    else { clean();renderStats();toast("Сохранено локально в браузере"); }
  });
});
window.addEventListener("beforeunload",function(e){if($("tag").className.indexOf("w")>-1){e.preventDefault();e.returnValue=""}});

/* ---------- экспорт / импорт ---------- */
$("exp").addEventListener("click",function(){collect();dl(new Blob([JSON.stringify(D,null,2)],{type:"application/json"}),"gaukhartas-content.json")});
$("expJs").addEventListener("click",function(){collect();
  dl(new Blob(["/* Содержание сайта «Гаухартас». Выгружено из админ-панели "+new Date().toLocaleString("ru-RU")+" */\nwindow.GH_DEFAULT="+JSON.stringify(D,null,2)+";\n"],{type:"application/javascript"}),"content.js")});
$("impB").addEventListener("click",function(){$("imp").click()});
$("imp").addEventListener("change",function(e){
  var f=e.target.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){try{
    var o=JSON.parse(r.result);
    if(!isObj(o)) throw new Error("это не файл настроек");
    var problems=validate(o);
    if(problems.length) throw new Error("\n\n· "+problems.slice(0,10).join("\n· "));
    D=o;
    fetch('/api/content', {method:'POST',headers:{'Content-Type':'application/json','X-Pin':USER_PIN},body:JSON.stringify(D)}).then(function(){
      saveLocal(D);boot(true);clean();toast("Данные загружены");
    }).catch(function(){
      var e=saveLocal(D);
      if(e){alert("Загружено, но не сохранилось.\n\n"+e)}
      else{boot(true);clean();toast("Данные загружены локально")}
    });
  }catch(err){alert("Файл не подходит: "+err.message)}};
  r.onerror=function(){alert("Не удалось прочитать файл.")};
  e.target.value='';
  r.readAsText(f)});
$("rst").addEventListener("click",function(){
  if(!window.GH_DEFAULT){alert("Файл content.js не загрузился — сбрасывать не к чему.");return}
  if(confirm("Вернуть всё содержание к исходному?\nВсе правки текстов, цен и залов будут потеряны.\nЗаявки и статистика останутся.")){
  D=deep(window.GH_DEFAULT||{});
  fetch('/api/content', {method:'POST',headers:{'Content-Type':'application/json','X-Pin':USER_PIN},body:JSON.stringify(D)}).then(function(){
    try{localStorage.removeItem(KC)}catch(e){}
    boot(true);clean();toast("Сброшено");
  }).catch(function(){
    try{localStorage.removeItem(KC)}catch(e){}
    boot(true);clean();toast("Сброшено локально");
  });
}});
$("clrS").addEventListener("click",function(){if(confirm("Обнулить всю статистику?")){
  fetch('/api/stats', {method:'DELETE',headers:{'X-Pin':USER_PIN}}).then(function(){
    renderStats();toast("Статистика обнулена");
  }).catch(function(){
    localStorage.removeItem(KS);renderStats();toast("Статистика обнулена");
  });
}});

/* ---------- старт ---------- */
function boot(skipLoad){
  if(skipLoad){
    renderStats();renderLeads();renderMenu();renderHalls();renderFaq();fillSimple();bootRep();
  } else {
    loadData(function(data) {
      D = data;
      renderStats();renderLeads();renderMenu();renderHalls();renderFaq();fillSimple();bootRep();
    });
  }
}
if(sessionStorage.getItem("gh_pin")){
  USER_PIN=sessionStorage.getItem("gh_pin");$("gate").style.display="none";boot();
}else if(sessionStorage.getItem("gh_auth")==="1"){
  $("gate").style.display="none";boot();
}else{
  setTimeout(function(){$("pin").focus()},200);
}

/* ============================================================
   РЕПУТАЦИЯ И РОСТ
   ============================================================ */
var KR = "gh_ratings", KP = "gh_plan";

/* ---------- калькулятор рейтинга ----------
   Площадки округляют рейтинг по-разному, это влияет на ответ:
   2ГИС и Яндекс — до одного знака, Google — тоже, но считает
   средневзвешенно с учётом свежести. Берём честное среднее. */
function reviewsNeeded(cur, n, target, share) {
  cur = +cur; n = +n; target = +target; share = (+share || 100) / 100;
  if (!isFinite(cur) || !isFinite(n) || !isFinite(target)) return null;
  /* рейтинг живёт в диапазоне 1–5, число отзывов не бывает отрицательным */
  cur = Math.min(5, Math.max(1, cur));
  target = Math.min(5, Math.max(1, target));
  n = Math.max(0, Math.floor(n));
  share = Math.min(1, Math.max(0, share));
  /* Заведение без отзывов: формула даёт 0, но пустая карточка не продаёт.
     Ниже 10 отзывов площадки часто вообще не показывают рейтинг. */
  if (n === 0) return { fresh: true, need: 10 };
  if (cur >= target) return { done: true };
  /* Средняя оценка новых отзывов: доля пятёрок + остальные считаем как четвёрки */
  var avgNew = 5 * share + 4 * (1 - share);
  /* Ровно 5,0 недостижимо арифметически: пока есть хоть одна оценка ниже пяти,
     среднее только приближается к пятёрке. Но площадки округляют до десятой,
     поэтому «пятёрка на карточке» — это фактические 4,95. */
  if (target >= 5) return { unreachable5: true, avgNew: avgNew };
  if (avgNew <= target) return { impossible: true, avgNew: avgNew };
  /* (cur*n + avgNew*x) / (n+x) >= target  →  x >= n*(target-cur)/(avgNew-target) */
  var x = Math.ceil((n * (target - cur)) / (avgNew - target));
  return { need: Math.max(0, x), avgNew: avgNew };
}

/* Площадка показывает рейтинг с округлением до десятой. «4,6» на карточке —
   это что угодно от 4,55 до 4,649, и разница решает всё: до показа «4,7»
   в лучшем случае хватит десятка отзывов, в худшем нужны сотни. */
function roundingRange(shown, n, target, share) {
  share = (+share || 100) / 100;
  var avgNew = 5 * share + 4 * (1 - share);
  var tReal = target - 0.05;                 /* показ target = факт >= target-0.05 */
  if (avgNew <= tReal) return null;
  function need(real) {
    if (real >= tReal) return 0;
    return Math.max(0, Math.ceil((n * (tReal - real)) / (avgNew - tReal)));
  }
  return {
    best: need(shown + 0.049),               /* повезло: фактически почти shown+0.05 */
    mid: need(shown),
    worst: need(shown - 0.05)                /* не повезло: фактически на нижней границе */
  };
}

function renderRatingCalc() {
  var out = $("rp-out"); if (!out) return;
  var site = $("rp-site").value;
  var cur = +$("rp-cur").value, n = +$("rp-n").value;
  var target = +$("rp-target").value, share = +$("rp-share").value;
  var ev = Math.max(1, +$("rp-events").value || 1);

  if (target > 5) { $("rp-target").value = 5; target = 5; }
  if (cur > 5) { $("rp-cur").value = 5; cur = 5; }

  var r = reviewsNeeded(cur, n, target, share);
  if (!r) { out.innerHTML = '<div class="rp-note rp-warn">Заполните все поля числами.</div>'; return; }

  if (r.fresh) {
    out.innerHTML = '<div class="rp-note"><b>Отзывов пока нет.</b><br>' +
      'Площадки обычно не показывают рейтинг, пока отзывов меньше десяти — карточка ' +
      'выглядит пустой и не продаёт. Первая цель — <b>10 отзывов</b>, дальше считайте здесь же.<br><br>' +
      'Быстрее всего они приходят с ближайших тоев: попросите заказчика в конце вечера, ' +
      'пока впечатление свежее.</div>';
    return;
  }
  if (r.done) {
    out.innerHTML = '<div class="rp-note">Рейтинг уже ' + cur.toFixed(1) +
      ' — цель достигнута. Дальше важно не поднимать цифру, а <b>не давать ей падать</b>: ' +
      'один отзыв на 1 звезду при ' + n + ' отзывах опускает рейтинг на ' +
      ((cur - (cur * n + 1) / (n + 1))).toFixed(2) + '. Держите поток свежих отзывов.</div>';
    return;
  }
  if (r.unreachable5) {
    var r95 = reviewsNeeded(cur, n, 4.95, share);
    var cnt = r95 && r95.need ? r95.need.toLocaleString('ru-RU') : '—';
    out.innerHTML = '<div class="rp-note rp-warn"><b>Ровно 5,0 недостижимо арифметически.</b><br>' +
      'Пока в истории есть хоть одна оценка ниже пятёрки, среднее может только ' +
      'приближаться к 5, но никогда её не достигнет — сколько бы пятёрок ни пришло.<br><br>' +
      'На карточке «5,0» показывается начиная с фактических <b>4,95</b>. ' +
      'При ' + cur.toFixed(1) + ' и ' + n.toLocaleString('ru-RU') + ' оценках до этого нужно ' +
      '<b>' + cnt + '</b> новых пятёрок подряд — это в ' +
      (r95 && r95.need ? Math.round(r95.need / n * 10) / 10 : '?') +
      ' раза больше, чем у вас накопилось за всё время работы.<br><br>' +
      'Поставьте реальную цель — <b>4,7</b>, и посчитайте её здесь.</div>';
    return;
  }
  if (r.impossible) {
    out.innerHTML = '<div class="rp-note rp-warn"><b>Цель недостижима при такой доле пятёрок.</b><br>' +
      'Если только ' + share + '% гостей ставят 5, средняя оценка новых отзывов — ' +
      r.avgNew.toFixed(2) + '. Она ниже цели ' + target.toFixed(1) +
      ', значит рейтинг к ней не подойдёт никогда, сколько отзывов ни собирай.<br><br>' +
      'Либо поднимите цель до ' + (Math.floor(r.avgNew * 10) / 10).toFixed(1) +
      ', либо работайте над качеством — доля пятёрок должна вырасти.</div>';
    return;
  }

  var months = Math.ceil(r.need / Math.max(1, ev * 0.25));
  var perEvent = (r.need / Math.max(1, ev)).toFixed(1);
  var siteName = { "2gis": "2ГИС", google: "Google", yandex: "Яндексе" }[site] || site;
  var drop = (cur * n + 1) / (n + 1);

  out.innerHTML =
    '<div class="rp-big">' +
      '<div class="rp-k"><b>' + r.need + '</b><span>отзывов нужно собрать</span></div>' +
      '<div class="rp-k"><b>' + (n + r.need) + '</b><span>станет всего на ' + siteName + '</span></div>' +
      '<div class="rp-k"><b>≈' + months + '</b><span>месяцев такими темпами</span></div>' +
      '<div class="rp-k"><b>' + perEvent + '</b><span>отзыва с одного тоя</span></div>' +
    '</div>' +
    '<div class="rp-note">Расчёт: при ' + share + '% пятёрок средняя новых отзывов выходит ' +
      r.avgNew.toFixed(2) + '. Чтобы средневзвешенная поднялась с ' + cur.toFixed(1) +
      ' до ' + target.toFixed(1) + ' при ' + n + ' уже имеющихся, нужно ' + r.need + ' новых.<br><br>' +
      'Оценка срока исходит из того, что <b>отзыв оставляет примерно каждый четвёртый гость</b>, ' +
      'которого попросили лично. Без просьбы пишут 3–5%, и тогда срок вырастет вчетверо.</div>' +
    (target >= 4.95 ? '<div class="rp-note rp-warn"><b>Ровно 5,0 держать почти невозможно.</b> ' +
      'Одна четвёрка при 100 отзывах роняет рейтинг до 4,99, а площадки округляют. ' +
      'Реальная цель для банкетного зала — <b>4,8–4,9</b>. Выше 4,9 клиенты начинают ' +
      'подозревать накрутку, и это работает против вас.</div>' : '') +
    (function () {
      var rr = roundingRange(cur, n, target, share);
      if (!rr) return '';
      return '<div class="rp-note"><b>Важно: площадка округляет.</b><br>' +
        'На карточке написано ' + cur.toFixed(1) + ', но фактическое значение — ' +
        'любое от ' + (cur - 0.05).toFixed(2) + ' до ' + (cur + 0.049).toFixed(2) +
        '. От того, где вы на самом деле, ответ меняется в разы:<br><br>' +
        '<b>' + rr.best.toLocaleString('ru-RU') + '</b> отзывов — если вы у верхней границы<br>' +
        '<b>' + rr.mid.toLocaleString('ru-RU') + '</b> — если ровно ' + cur.toFixed(2) + '<br>' +
        '<b>' + rr.worst.toLocaleString('ru-RU') + '</b> — если у нижней<br><br>' +
        'Точную цифру площадка не показывает. Практический вывод: собирайте отзывы ' +
        'и смотрите, когда цифра перещёлкнет — возможно, до неё ближе, чем кажется.</div>';
    })() +
    '<div class="rp-note">Один отзыв на 1 звезду сейчас опустит рейтинг до ' + drop.toFixed(2) +
      '. Чем больше у вас отзывов, тем меньше вредит каждый плохой — это ещё одна причина ' +
      'набирать объём, а не только среднее.</div>';
}

/* ---------- дневник рейтинга ---------- */
function ratings() { var v = jget(KR, []); return Array.isArray(v) ? v : []; }
function renderRatingLog() {
  var host = $("rl-tbl"); if (!host) return;
  var L = ratings();
  if (!L.length) { host.innerHTML = '<p class="sub">Записей пока нет.</p>'; return; }
  function delta(i, k) {
    if (i + 1 >= L.length) return "";
    var a = L[i][k], b = L[i + 1][k];
    if (a == null || b == null) return "";
    var d = (a - b).toFixed(1);
    if (+d === 0) return ' <span style="color:#8B949E">=</span>';
    return +d > 0 ? ' <span style="color:#5BC97F">+' + d + "</span>"
                  : ' <span style="color:#E06C6C">' + d + "</span>";
  }
  host.innerHTML = '<table class="t"><thead><tr><th>Дата</th><th>2ГИС</th><th>Отз.</th>' +
    "<th>Google</th><th>Отз.</th><th>Яндекс</th><th></th></tr></thead><tbody>" +
    L.map(function (r, i) {
      return "<tr><td>" + esc(r.date) + "</td>" +
        "<td>" + (r["2gis"] != null ? r["2gis"].toFixed(1) + delta(i, "2gis") : "—") + "</td>" +
        "<td>" + (r["2gisn"] != null ? r["2gisn"] : "—") + "</td>" +
        "<td>" + (r.google != null ? r.google.toFixed(1) + delta(i, "google") : "—") + "</td>" +
        "<td>" + (r.googlen != null ? r.googlen : "—") + "</td>" +
        "<td>" + (r.yandex != null ? r.yandex.toFixed(1) + delta(i, "yandex") : "—") + "</td>" +
        '<td><button class="x" data-rdel="' + i + '">✕</button></td></tr>';
    }).join("") + "</tbody></table>";
  host.querySelectorAll("[data-rdel]").forEach(function (b) {
    b.addEventListener("click", function () {
      var L2 = ratings(); L2.splice(+b.getAttribute("data-rdel"), 1);
      try { localStorage.setItem(KR, JSON.stringify(L2)); } catch (e) {}
      renderRatingLog();
    });
  });
}

/* ---------- план роста ---------- */
var PLAN = [
  ["Забрать карточку в 2ГИС", "В Казахстане её смотрят чаще Google Карт. Подтвердить владение, добавить 15+ фото залов, меню, часы, цены. Бесплатно."],
  ["Завести Google Business Profile", "По запросу «gaukhartas» карточка показывается выше сайта. Фото, категория «Банкетный зал», ответы на отзывы."],
  ["Карточка в Яндекс Бизнесе", "Третий источник трафика. Заполняется за час, дальше работает сама."],
  ["Просить отзыв в день тоя", "Ключевое. Через день никто не напишет. Менеджер подходит к заказчику в конце вечера и просит лично — конверсия примерно каждый четвёртый вместо 3–5%."],
  ["QR-код на стол заказчика", "Печатная карточка со ссылкой прямо на форму отзыва 2ГИС. Убирает трение «искать вас в приложении»."],
  ["Отвечать на все отзывы за сутки", "Особенно на плохие. Площадки поднимают в выдаче активные карточки, а гости читают именно ответы на негатив."],
  ["Просить отметку в Instagram", "Каждый той — это 100–300 гостей с телефонами. Отметка @restaurant.gaukhartas в сторис даёт охват дешевле любой рекламы."],
  ["Снимать видео с тоев", "30-секундный рилс с реального вечера конвертит лучше любого текста. Разрешение у заказчика спрашивать заранее."],
  ["Партнёрство с тамада и ведущими", "Они выбирают площадку вместе с клиентом. 5–10 ведущих в Астане закрывают заметную долю рынка."],
  ["Фотографы и видеографы", "Тот же принцип: их рекомендация приходит раньше вашей рекламы."],
  ["Свадебные салоны и ателье", "Невеста заходит туда за 3–6 месяцев до тоя — раньше, чем начинает искать зал."],
  ["Календарь занятости на сайте", "Показать свободные субботы. Снимает главный вопрос «а есть ли дата» до звонка."],
  ["Уведомления заявок в Telegram", "Сейчас заявки не доходят до менеджера — лежат в браузере клиента. Самая дорогая дыра в воронке."],
  ["Собрать базу прошедших тоев", "Через год у семьи следующий повод: сүндет той, мерейтой, тұсаукесер. Напоминание за 2 месяца стоит ноль."],
  ["Отдельные страницы под тип тоя", "«Ұзату той Астана», «Сүндет той зал» — люди ищут именно так, а не «банкетный зал»."],
  ["Google Ads по брендовым запросам", "Дёшево, если кто-то из конкурентов откручивает рекламу по слову «гаухартас»."]
];

function renderPlan() {
  var host = $("rp-plan"); if (!host) return;
  var done = jget(KP, {}); if (!done || typeof done !== "object") done = {};
  host.innerHTML = PLAN.map(function (p, i) {
    var on = !!done[i];
    return '<div class="rp-step' + (on ? " done" : "") + '">' +
      '<input type="checkbox" id="pl' + i + '"' + (on ? " checked" : "") + ' data-pl="' + i + '">' +
      '<label for="pl' + i + '"><b>' + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></label></div>";
  }).join("");
  var n = Object.keys(done).filter(function (k) { return done[k]; }).length;
  host.insertAdjacentHTML("afterbegin",
    '<p class="sub" style="margin:0 0 12px">Сделано ' + n + " из " + PLAN.length + "</p>");
  host.querySelectorAll("[data-pl]").forEach(function (c) {
    c.addEventListener("change", function () {
      var d = jget(KP, {}); if (!d || typeof d !== "object") d = {};
      d[c.getAttribute("data-pl")] = c.checked;
      try { localStorage.setItem(KP, JSON.stringify(d)); } catch (e) {}
      renderPlan();
    });
  });
}

function renderRepLinks() {
  var host = $("rp-links"); if (!host) return;
  var c = (D && D.contacts) || {};
  var name = encodeURIComponent(((D && D.brand && D.brand.name) || "Гаухартас") + " Астана");
  var links = [
    ["Карточка в 2ГИС", c.map2gis || "https://2gis.kz/astana", "Рейтинг, отзывы, просмотры карточки"],
    ["Google Business Profile", "https://business.google.com/dashboard", "Звонки, маршруты, поисковые запросы"],
    ["Яндекс Бизнес", "https://yandex.ru/sprav/", "Показы и переходы с Яндекс Карт"],
    ["Google Search Console", "https://search.google.com/search-console", "По каким запросам находят сайт"],
    ["Яндекс.Метрика", "https://metrika.yandex.kz/", "Карта кликов, запись сессий"],
    ["Google Analytics", "https://analytics.google.com/", "Источники трафика и поведение"],
    ["Поиск себя в Google", "https://www.google.com/search?q=" + name, "Что видит клиент по вашему названию"],
    ["Поиск в Яндексе", "https://yandex.kz/search/?text=" + name, "То же самое в Яндексе"]
  ];
  host.innerHTML = links.map(function (l) {
    return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener"><b>' + esc(l[0]) +
      "</b><small>" + esc(l[2]) + "</small></a>";
  }).join("");
}

function bootRep() {
  ["rp-site", "rp-cur", "rp-n", "rp-target", "rp-share", "rp-events"].forEach(function (id) {
    var n = $(id); if (n) n.addEventListener("input", renderRatingCalc);
  });
  var d = $("rl-date"); if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  var add = $("rl-add");
  if (add) add.addEventListener("click", function () {
    var num = function (id) { var v = $(id).value.trim(); return v === "" ? null : +v; };
    var rec = { date: $("rl-date").value || new Date().toISOString().slice(0, 10),
      "2gis": num("rl-2gis"), "2gisn": num("rl-2gisn"),
      google: num("rl-google"), googlen: num("rl-googlen"), yandex: num("rl-yandex") };
    var bad = ["2gis", "google", "yandex"].filter(function (k) {
      return rec[k] != null && (rec[k] < 1 || rec[k] > 5);
    });
    if (bad.length) { toast("Рейтинг должен быть от 1 до 5"); return; }
    if (rec["2gis"] == null && rec.google == null && rec.yandex == null) {
      toast("Заполните хотя бы один рейтинг"); return;
    }
    var L = ratings();
    L = L.filter(function (r) { return r.date !== rec.date; });
    L.unshift(rec);
    L.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    try { localStorage.setItem(KR, JSON.stringify(L.slice(0, 200))); } catch (e) { toast("Не сохранилось"); return; }
    renderRatingLog(); toast("Записано");
    /* подставляем свежие цифры в калькулятор */
    if (rec["2gis"] != null) { $("rp-cur").value = rec["2gis"]; }
    if (rec["2gisn"] != null) { $("rp-n").value = rec["2gisn"]; }
    renderRatingCalc();
  });
  var csv = $("rl-csv");
  if (csv) csv.addEventListener("click", function () {
    var L = ratings(); if (!L.length) { toast("Записей нет"); return; }
    var h = ["Дата", "2ГИС", "Отзывов 2ГИС", "Google", "Отзывов Google", "Яндекс"];
    var rows = L.map(function (r) {
      return [r.date, r["2gis"] ?? "", r["2gisn"] ?? "", r.google ?? "", r.googlen ?? "", r.yandex ?? ""];
    });
    var out = "\ufeff" + [h].concat(rows).map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(";");
    }).join("\r\n");
    dl(new Blob([out], { type: "text/csv;charset=utf-8" }), "gaukhartas-reyting.csv");
  });
  var clr = $("rl-clr");
  if (clr) clr.addEventListener("click", function () {
    if (!confirm("Удалить весь дневник рейтинга?")) return;
    try { localStorage.removeItem(KR); } catch (e) {}
    renderRatingLog(); toast("Очищено");
  });
  renderRatingCalc(); renderRatingLog(); renderPlan(); renderRepLinks();
}
