(function(){
  'use strict';

  /* Защита от повторного подключения файла: без неё обработчик
     переключателя вешался дважды и язык менялся туда-обратно. */
  if (window.GH_LANG) return;
  
  var T = {
    kz: {
      // Navigation
      'nav.menu': 'Мәзір',
      'nav.halls': 'Залдар',
      'nav.about': 'Біз туралы',
      'nav.gallery': 'Галерея',
      'nav.map': 'Карта',
      'nav.small': 'Кіші зал',
      'nav.big': 'Үлкен зал',
      'drawer.small': 'Кіші зал — бөлек бет',
      'drawer.big': 'Үлкен зал — бөлек бет',
      'footer.nav.small': 'Кіші зал',
      'footer.nav.big': 'Үлкен зал',
      'halls.cta.smallpage': 'Кіші залды ашу →',
      'halls.cta.bigpage': 'Үлкен залды ашу →',
      'nav.book': 'Күнді брондау',
      'nav.book.short': 'Брондау',

      // Drawer Menu
      'drawer.menu': 'Мәзір және бағалар',
      'drawer.halls': 'Залдар',
      'drawer.about': 'Біз туралы',
      'drawer.gallery': 'Галерея',
      'drawer.map': 'Карта және байланыс',
      'drawer.whatsapp': 'WhatsApp-қа жазу',
      'drawer.lang': 'Сайт тілі',

      // Hero Section
      'hero.address': 'Ермек Серкебаев к-сі, 11 · 300 қонаққа дейін',
      'hero.title': 'Гаухартас',
      'hero.subtitle': 'Сіздің тойыңыз — бұл бір кеш және одан кейінгі тұтас өмір',
      'hero.desc': 'Екі зал, жеке ас үй және алғашқы кездесуден бастап соңғы қонаққа дейін мерекені жүргізетін бір команда. Сметаны шартта бекітеміз — кешке қарай ол өспейді.',
      'hero.btn.menu': 'Мәзірді ашу',
      'hero.btn.date': 'Күнді тексеру',

      // Marquee
      'marquee.wedding': 'Үйлену тойы',
      'marquee.uzatu1': 'Қыз ұзату',
      'marquee.sundet': 'Сүндет той',
      'marquee.uzatu2': 'Қыз ұзату',
      'marquee.jubilee': 'Мерейтой',
      'marquee.tusau': 'Тұсау кесу',
      'marquee.corp': 'Корпоратив',
      'marquee.besik': 'Бесік той',
      'marquee.birthday': 'Туған күн',
      'marquee.kudalyk': 'Құдалық',

      // Menu Book Section
      'menu.title': 'Мәзірімізді парақтаңыз',
      'menu.book.title': 'Гаухартастың былғары мәзірі',
      'menu.book.desc': 'Әр пакетке толық дастархан жаю, ыдыс-аяқ және қызмет көрсету кіреді.',
      
      'menu.p1.title': '01 Пакет · жұмыс күндері',
      'menu.p1.name': 'Стандарт',
      'menu.guest': '/ қонақ',
      'menu.p1.cold': 'Суық тіскебасарлар',
      'menu.p1.hot': 'Ыстық тағам',
      'menu.p1.garnish': 'Гарнир',
      'menu.p1.tea': 'Шай және пісірілген өнімдер',
      'menu.p1.meat': 'Бешбармаққа арналған ет',
      'menu.p1.service': 'Дастархан жаю және қызмет көрсету',
      'menu.p1.note': 'Ескерту: тек дүйсенбі–жұма күндері қолжетімді.',
      
      'menu.types': 'түрі',
      'menu.dish': 'тағам',
      'menu.incl': 'қосылған',
      'menu.from100': '100 қонақтан бастап',
      
      'menu.p2.title': '02 Пакет · жиі таңдалады',
      'menu.p2.name': 'Премиум',
      'menu.p2.cold': 'Суық тіскебасарлар мен салаттар',
      'menu.p2.hot': 'Премиум ыстық тағам',
      'menu.p2.fruit': 'Жеміс ассортиі',
      'menu.p2.desert': 'Десерттер',
      'menu.p2.gifts': 'Мекемеден үш сыйлық',
      'menu.p2.service': 'Дастархан жаю және қызмет көрсету',
      'menu.p2.note': 'Сыйлықтар: бешбармақ, шай үстелі, қарсы алу фуршеті.',
      
      'menu.p3.title': '03 Пакет',
      'menu.p3.name': 'Корольдік',
      'menu.p3.cold': 'Элиталық тіскебасарлар мен деликатестер',
      'menu.p3.hot': 'Ет тағамдарын шеф-аспаздың ұсынуы',
      'menu.p3.welcome': 'Қарсы алу фуршеті',
      'menu.p3.tea': 'Шай үстелі',
      'menu.p3.gifts': 'Барлық үш сыйлық',
      'menu.p3.service': 'Даяшылардың кеңейтілген құрамы',
      'menu.p3.note': 'Пакет ішіндегі мәзір санат шеңберінде қосымша ақысыз өзгереді.',
      
      'menu.table': 'Дастарқан',
      'menu.gifts.title': 'Мекеме сыйлықтары',
      'menu.gifts.besh': 'Бешбармақ — сыйлық тағамы',
      'menu.gifts.tea': 'Тәттілер қойылған шай үстелі',
      'menu.gifts.welcome': 'Қарсы алу фуршеті',
      
      'menu.extra.title': 'Бөлек төленетін қызметтер',
      'menu.extra.big': 'Үлкен зал',
      'menu.extra.small': 'Кіші зал',
      'menu.extra.app': 'Аппаратура',
      'menu.extra.decor': 'Рәсімдеу',
      
      'menu.book.btn': 'Брондау',
      'menu.book.date': 'Сіздің күніңізді сақтап қоямыз',
      'menu.address': 'Ермек Серкебаев көшесі, 11',
      'menu.time': 'Астана · күн сайын 10:00 — 02:00',

      // Halls Section
      'halls.title': 'Залдар',
      'halls.subtitle': 'Түрлі ауқымға арналған екі зал',
      'halls.desc': 'Екі зал да Ермек Серкебаев көшесі, 11 мекенжайындағы бір ғимаратта орналасқан. Дастархан жаю, ыдыс-аяқ, текстиль және даяшылардың жұмысы пакет құнына кіреді — ыдыс-аяқты бөлек жалға алу жоқ.',
      
      'halls.big.title': 'Үлкен зал',
      'halls.big.upto': '350 қонаққа дейін',
      'halls.big.from': '150 қонақтан бастап',
      
      'halls.small.title': 'Кіші зал',
      'halls.small.upto': '160 қонаққа дейін',
      'halls.small.from': '50 қонақтан бастап',
      
      'halls.music': 'Музыкалық аппаратура',
      'halls.decor': 'Залды безендіру',
      'halls.btn': 'Күнді нақтылау',

      // About Section
      'about.title': 'Біз туралы',
      'about.subtitle': 'Бір ас үй, бір команда, сметада тосын сыйлар жоқ',

      // Gallery Section
      'gallery.title': 'Бәрі шын өмірде қалай көрінеді',
      'gallery.subtitle': 'Кеш атмосферасы',

      // Contacts Section
      'contact.title': 'Карта және байланыс',
      'contact.addr.title': 'Мекенжай',
      'contact.phone.title': 'Телефон',
      'contact.req.title': 'Өтінімдерді қабылдау',
      'contact.time': 'күн сайын 10:00-ден 02:00-ге дейін',
      'contact.reply': 'Хабарласқан күні жауап береміз',
      'contact.mark.title': 'Бағдар',
      'contact.mark.desc': 'Ғимараттың шетіндегі жарықтандырылған маңдайша',
      'contact.route.2gis': '2ГИС арқылы бағыт',
      'contact.route.yandex': 'Яндекс.Карта арқылы бағыт',
      'contact.route.google': 'Google Maps арқылы бағыт',
      'contact.btn.2gis': '2ГИС-те ашу',

      // Footer
      'footer.desc': 'Үйлену тойларына, Қыз ұзату, Сүндет той, мерейтойларға және корпоративтік мерекелерге арналған банкет залы. Екі зал, жеке ас үй және толық қызмет көрсету.',
      'footer.menu': 'Мәзір',
      'footer.halls': 'Залдар',
      'footer.about': 'Біз туралы',
      'footer.gallery': 'Галерея',
      'footer.map': 'Карта және байланыс',
      'footer.whatsapp': 'WhatsApp-қа жазу',

      // Book flip hint
      'book.hint': 'Бетті тартыңыз немесе көрсеткіні басыңыз',
      // ── Прощальная страница книги ──
      'bk.bye.tag': 'Кездескенше',
      'bk.bye.t1': 'Сізді',
      'bk.bye.t2': 'күтеміз',
      'bk.bye.p': 'Залдарды көруге келіңіз — екеуін де көрсетеміз, сұрақтарыңызға жауап береміз және сметаны сіздің көзіңізше есептейміз. Міндеттемесіз.',
      'bk.bye.city': 'Астана · Сарыарқа',

      // ── Доразметка: контакты, галерея, «О нас» ──
      'about.p1': '«Гаухартас» — Астанадағы Ермек Серкебаев көшесі, 11 мекенжайындағы банкет залы. Бір шаңырақ астында екі зал: 350 қонаққа дейінгі үлкен зал би алаңы мен сахнасы бар, және 100—160 қонаққа арналған кіші зал — жинақы отбасылық кештерге.',
      'about.p2': 'Бізде өз ас үйіміз бар: қазақ дастарханы және еуропалық ұсыну. Бешбармақ, ет тағамдары, суық тіскебасарлар — бәрі орнында дайындалады.',
      'about.p3': 'Сметаны шартта бекітеміз. Дастархан жаю, ыдыс-аяқ, текстиль және даяшылардың жұмысы пакет құнына кіреді — кеш соңында сома өзгермейді.',
      'ct.intro': 'Астана, Сарыарқа ауданы — автотұрағы бар бөлек тұрған ғимарат. Хан Шатырдан машинамен шамамен 15 минут.',

      'about.em': 'той',
      'about.h1': 'Біз тойды',
      'about.h2': 'үйде қалай қабылдасақ,',
      'about.h3': 'солай қабылдаймыз',
      'bk.book.t1': 'Күніңізді',
      'bk.book.t2': 'сақтап қоямыз',
      'bk.cover.p': 'Қазақ дастарханының дәстүрі мен еуропалық ұсыну. Тағамдар құрамын шарт жасалғанға дейін келісеміз.',
      'bk.gift.welcome2': 'Қарсы алу фуршеті',
      'bk.gifts.t1': 'Мекеме',
      'bk.gifts.t2': 'сыйлықтары',
      'bk.n2': '2 тағам',
      'bk.p3.note2': 'Пакет ішіндегі мәзір санат аясында қосымша ақысыз өзгереді.',
      'ct.addr': 'Мекенжай',
      'ct.district': 'Сарыарқа ауданы',
      'ct.hours': 'Жұмыс уақыты',
      'ct.how': 'Қалай жетуге болады',
      'ct.land': 'Бағдар —',
      'ct.land2': 'бөлек тұрған екі қабатты ғимарат',
      'ct.maploading': 'Карта жүктелуде…',
      'ct.open': 'ашу →',
      'ct.open2gis': '2ГИС-те ашу →',
      'ct.phone': 'Телефон',
      'ct.r2gis': '2ГИС-те бағыт',
      'ct.r2gis2': '2ГИС-те бағыт →',
      'ct.rgoogle': 'Google Maps-те бағыт',
      'ct.ryandex': 'Яндекс.Карталарда бағыт',
      'ct.view': 'Залды қарау',
      'ct.view2': 'Тегін, келісім бойынша — екі залды да көрсетеміз және сметаны сіздің көзіңізше есептейміз.',
      'ft.card2gis': '2ГИС-тегі карточка →',
      'ft.hallsword': 'Банкет залдары',
      'ft.hours': 'Күн сайын 10:00 — 02:00',
      'ft.rights': '«Гаухартас» банкет залы. Барлық құқықтар қорғалған.',
      'gal.c1': 'Үлкен зал · дастархан',
      'gal.c2': 'Фотоаймақ',
      'gal.c3': 'Кіші зал · панорамалық терезелер',
      // ── Форма заявки ──
      'lead.title': 'Күн бос па екенін тексеру',
      'lead.sub': 'Жұмыс күні ішінде жауап беріп, есептеу жібереміз. Сату бөлімі 11:00-ден 21:00-ге дейін жұмыс істейді.',
      'lead.name': 'Атыңыз кім',
      'lead.phone': 'Телефон',
      'lead.date': 'Той күні',
      'lead.guests': 'Қонақ саны',
      'lead.hall': 'Зал',
      'lead.hall.any': 'Қайсысы қолайлы екенін айтыңыз',
      'lead.hall.big': 'Үлкен · 350 қонаққа дейін',
      'lead.hall.small': 'Кіші · 100—160 қонақ',
      'lead.send': 'Өтінім жіберу',
      'lead.note': 'Түймені басу арқылы сіз өтінішке жауап беру үшін көрсетілген деректерді өңдеуге келісім бересіз.',
      'lead.ok': 'Өтінім қабылданды',
      'lead.ok2': 'Жұмыс уақытында хабарласамыз. Тезірек керек болса — WhatsApp-қа жазыңыз, онда бірден жауап береміз.',
      'lead.wa': 'WhatsApp-қа жазу',

      // ── Видео ──
      'vd.meta': 'Бейне',
      'vd.title': 'Бұл қалай өтеді',
      'vd.sub': '«Гаухартаста» бір кеш — қонақтарды қарсы алудан соңғы биге дейін.',

      // ── Отзывы и плавающая кнопка ──
      'rv.meta': 'Пікірлер',
      'rv.title': 'Қонақтар не дейді',
      'rv.sub': 'Бағалар нақты, 2ГИС карточкасынан. Санды басыңыз — бастапқы дереккөз ашылады, бәрін тексеруге болады.',
      'rv.cta': '2ГИС-тегі пікірлер →',
      'wa.fab': 'Күн туралы сұрау',

      // ── Обзор 360° ──
      'pano.meta': 'Шолу',
      'pano.title': 'Айналаңызға қараңыз',
      'pano.drag': 'Тартыңыз',
      'pano.hint': '· немесе көрсеткілерді басыңыз',
      'pano.v1': 'Үлкен зал · дастархан',
      'pano.v2': 'Үлкен зал · жалпы көрініс',
      'pano.v3': 'Кіші зал · панорамалық терезелер',
      'pano.v4': 'Кіші зал · демалыс аймағы',
      'pano.v5': 'Фотоаймақ',
      'pano.v6': 'Гүлдер мен шамдар',
      'pano.v7': 'Дастархан жаю',
      'pano.v8': 'Отырғызу',
      'gal.c5': 'Үлкен зал · жалпы көрініс',
      'gal.c6': 'Кіші зал · демалыс аймағы',
      'gal.c7': 'Гүлдер мен шамдар',
      'gal.c8': 'Отырғызу',
      'gal.c9': 'Үстел бөлшектері',
      'gal.c4': 'Дастархан жаю',
      'halls.guests2': 'қонақ',

      // ── Книга: страницы «Подарки» и «Пространство» ──
      'bk.gifts.t1': 'Мекеме',
      'bk.gifts.t2': 'сыйлықтары',
      'gal.entrance': 'Кіреберіс · Ермек Серкебаев көшесі, 11',
      'bk.gift.besh2': 'Бешбармақ — сыйлық тағам',
      'bk.gift.tea2': 'Тәтті тағамдармен шай дастарханы',
      'bk.gift.welcome2': 'Қарсы алу фуршеті',
      'bk.gifts.note2': '100 қонақтан бастап банкет тапсырғанда жарамды.',
      'bk.space.tag2': 'Кеңістік',
      'bk.space.title2': 'Екі зал',
      'bk.space.big2': 'Үлкен зал',
      'bk.space.small2': 'Кіші зал',
      'bk.space.stage2': 'Сахна, жарық, дыбыс',
      'bk.space.floor2': 'Би алаңы',
      'bk.yes': 'бар',
      'bk.book.tag2': 'Брондау',
      'bk.book.t1': 'Күніңізді',
      'bk.book.t2': 'сақтап қоямыз',
      'bk.book.addr': 'Ермек Серкебаев көшесі, 11',
      'bk.book.city': 'Астана · күн сайын 10:00 — 02:00',
      'bk.cover.tag': 'Банкет мәзірі',
      'bk.cover.h3': 'Дәстүр мен дәм',
      'bk.cover.p': 'Қазақ дастарханының дәстүрі мен еуропалық ұсыну. Тағамдар құрамын шарт жасалғанға дейін келісеміз.',
      'bk.cover.h': 'Астана · Est. Мәзір',
      'bk.cover.m': 'ГАУХАРТАС',
      'bk.cover.s': 'Банкет залдары',
      'bk.n5': '5 түрі',
      'bk.n2': '2 тағам',
      'bk.n8': '8 түрі',
      'bk.n12': '12 түрі',
      'bk.incl2': 'кіреді',
      'bk.from100b': '100 қонақтан',
      'bk.p2.note2': 'Сыйлықтар: бешбармақ, шай дастарханы, қарсы алу фуршеті.',
      'bk.p3.note2': 'Пакет ішіндегі мәзір санат аясында қосымша ақысыз өзгереді.',
      'bk.p1.note': 'Ең аз тапсырыс — 50 қонақ.',

      // ── Секция «О нас» ──
      'about.h1': 'Біз тойды',
      'about.em': 'той',
      'about.h2': 'үйде қалай қабылдасақ,',
      'about.h3': 'солай қабылдаймыз',
      'about.p1': '«Гаухартас» — Астанадағы Ермек Серкебаев көшесі, 11 мекенжайындағы банкет залы. Бір шаңырақ астында екі зал: 350 қонаққа дейінгі үлкен зал би алаңы мен сахнасы бар, және 100—160 қонаққа арналған кіші зал — жинақы отбасылық кештерге.',
      'about.p2': 'Бізде өз ас үйіміз бар: қазақ дастарханы және еуропалық тағамдар. Бешбармақ, ет тағамдары, суық тіскебасарлар — бәрі орнында дайындалады.',
      'about.p3': 'Сметаны шартта бекітеміз. Дастархан жаю, ыдыс-аяқ, текстиль және даяшылардың жұмысы пакет құнына кіреді — кеш соңында сома өзгермейді.',

      // ── Цифры под первым экраном ──
      'nums.guests': 'үлкен залдағы қонақ',
      'ct.saleshours': 'Сату бөлімі: 11:00 — 21:00',
      'nums.halls': 'ғимаратта зал',
      'nums.hours': 'сату бөлімі',
      'nums.price': 'бір қонаққа пакет',

      // ── Прочее ──
      'hero.sb': 'Банкет залдары · Астана',
      'hero.skip': 'Кіру үшін басыңыз',
      'halls.guests2': 'қонақ',
      'halls.ev1': 'Үйлену той · Ұзату той · корпоратив',
      'halls.ev2': 'Мерейтой · Сүндет той · 1 жас',
      'gallery.p': 'Залдардың, безендірудің және тағам ұсынудың нақты фотолары. Үлкейту үшін суретті басыңыз.',
      'ft.tag': 'Банкет залдары · Астана',

      // ── Книга меню: фактическое содержимое страниц ──
      'bk.cover.title': 'Банкет мәзірі',
      'bk.p1.tag': '01 Пакет',
      'bk.p1.name': 'Стандарт',
      'bk.p2.tag': '02 Пакет · ең жиі таңдалады',
      'bk.p2.name': 'Премиум',
      'bk.p3.tag': '03 Пакет',
      'bk.p3.name': 'Корольдік',
      'bk.guest': '/ қонақ',

      'bk.cold': 'Суық тіскебасарлар мен салаттар',
      'bk.hot': 'Таңдау бойынша ыстық тағам',
      'bk.bread': 'Нан себеті, тұздықтар',
      'bk.drinks': 'Алкогольсіз сусындар',
      'bk.serve': 'Дастархан жаю, ыдыс-аяқ, текстиль',
      'bk.staff': 'Даяшылар және жинау',
      'bk.min50': 'Ең аз тапсырыс — 50 қонақ.',

      'bk.hot.prem': 'Премиум ыстық тағам',
      'bk.fruit': 'Жеміс-жидек ассортиі',
      'bk.dessert': 'Десерттер',
      'bk.gifts3': 'Мекемеден үш сыйлық',
      'bk.serve2': 'Дастархан жаю және қызмет көрсету',
      'bk.p2.note': 'Сыйлықтар: бешбармақ, шай дастарханы, қарсы алу фуршеті.',

      'bk.elite': 'Элиталық тіскебасарлар мен ерекше тағамдар',
      'bk.chef': 'Ет тағамдарын шеф ұсынуы',
      'bk.welcome': 'Қарсы алу фуршеті',
      'bk.tea': 'Шай дастарханы',
      'bk.allgifts': 'Барлық үш сыйлық',
      'bk.staff.ext': 'Кеңейтілген даяшылар құрамы',
      'bk.p3.note': 'Пакет ішіндегі мәзір санат аясында қосымша ақысыз өзгереді.',

      'bk.gifts.tag': 'Дастархан',
      'bk.gifts.title': 'Мекеме сыйлықтары',
      'bk.gift.besh': 'Бешбармақ — сыйлық тағам',
      'bk.gift.tea': 'Тәтті тағамдармен шай дастарханы',
      'bk.gift.welcome': 'Қарсы алу фуршеті',
      'bk.gifts.note': '100 қонақтан бастап банкет тапсырғанда жарамды.',

      'bk.space.tag': 'Кеңістік',
      'bk.space.title': 'Екі зал',
      'bk.space.big': 'Үлкен зал',
      'bk.space.small': 'Кіші зал',
      'bk.space.stage': 'Сахна, жарық, дыбыс',
      'bk.space.floor': 'Би алаңы',
      'bk.book.tag': 'Брондау',
      'bk.incl': 'кіреді',
      'bk.kinds': 'түрі',
      'bk.dishes': 'тағам',
      'bk.from100': '100 қонақтан',

      // ── Дописано: элементы, которые оставались на русском ──
      'menu.meta': 'Мәзір және пакеттер',
      'menu.desc': 'Бетті тінтуірмен немесе саусақпен нағыз мәзір сияқты аударыңыз. Бағалар бір қонаққа есептелген.',
      'about.meta': 'Біз туралы',
      'gallery.meta': 'Галерея',
      'contacts.meta': 'Орналасқан жері',
      'contacts.title': '«Гаухартас» қайда орналасқан',
      'contacts.btn.wa': 'WhatsApp',
      'contacts.btn.call': 'Қоңырау шалу',
      'footer.title.nav': 'Бөлімдер',
      'footer.title.events': 'Мерекелер',
      'footer.title.contacts': 'Байланыс',
      'footer.nav.menu': 'Мәзір және бағалар',
      'footer.nav.halls': 'Залдар',
      'footer.nav.about': 'Біз туралы',
      'footer.nav.gallery': 'Галерея',
      'footer.nav.contacts': 'Карта және байланыс',
      'footer.events.wedding': 'Үйлену тойы',
      'footer.events.uzatu': 'Ұзату той',
      'footer.events.sundet': 'Сүндет той',
      'footer.events.jubilee': 'Мерейтой',
      'footer.events.corp': 'Корпоратив',
      'footer.contacts.wa': 'WhatsApp-қа жазу',
      'footer.legal': 'Сайттағы бағалар жария оферта болып табылмайды',

      // ── Секция залов ──
      'halls.meta': 'Залдар',
      'halls.title': 'Залдар',
      'halls.desc': 'Екі зал да Ермек Серкебаев көшесі, 11 мекенжайындағы бір ғимаратта орналасқан. Дастархан жаю, ыдыс-аяқ, текстиль және даяшылардың жұмысы пакет құнына кіреді — ыдысты бөлек жалға алу жоқ.',
      'halls.big.name': 'Үлкен зал',
      'halls.big.desc': 'Хрусталь люстралар, зүмірет-алтын безендіру және ортасында кең би алаңы. Мұнда жүргізуші мен әртістерге арналған сахна қойылады — зал тірі музыканы да, бірнеше жүз адамдық үлкен тойды да көтереді.',
      'halls.small.name': 'Кіші зал',
      'halls.small.desc': 'Ашық мәрмәр, ою-өрнек және сабырлы жарық. Қонақтарды атымен білетін жинақы формат: мерейтой, сүндет той, тұсаукесер, 1 жас және шусыз отбасылық кештер.',
      'halls.spec.capacity': 'Сыйымдылығы',
      'halls.spec.seating': 'Отырғызу',
      'halls.spec.stage': 'Сахна, жарық, дыбыс',
      'halls.spec.floor': 'Би алаңы',
      'halls.spec.format': 'Формат',
      'halls.spec.sound': 'Дыбыс',
      'halls.spec.projector': 'Проектор',
      'halls.spec.for': 'Қолайлы',
      'halls.val.tables': 'дөңгелек үстелдер',
      'halls.val.yes': 'бар',
      'halls.val.request': 'сұраныс бойынша',
      'halls.val.banquet': 'банкет / фуршет',
      'halls.guests': 'қонақ',
      'halls.upto': 'дейін',
      'halls.cta.big': 'Күнді нақтылау',
      'halls.cta.small': 'Күнді нақтылау',

      'book.prev.aria': 'Алдыңғы бет',
      'book.next.aria': 'Келесі бет'
    }
  };
  
  var LANG_KEY = 'gh_lang';
  var memory = null;                    /* запасное хранилище в памяти */

  function getLang() {
    /* ?lang=kz в адресе имеет приоритет: по такой ссылке заходят из поиска */
    try {
      var q = (location.search.match(/[?&]lang=(kz|kk|ru)/) || [])[1];
      if (q) return q === 'ru' ? 'ru' : 'kz';
    } catch (e) {}
    try { return localStorage.getItem(LANG_KEY) || memory || 'ru'; }
    catch (e) { return memory || 'ru'; }
  }

  function setLang(lang) {
    if (lang !== 'kz' && lang !== 'ru') lang = 'ru';
    memory = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.setAttribute('lang', lang === 'kz' ? 'kk' : 'ru');
    
    /* Перевод атрибутов (aria-label, placeholder, title).
       В textContent их класть нельзя — символьные кнопки превращаются в текст. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-attr]'), function(el){
      el.getAttribute('data-i18n-attr').split(';').forEach(function(pair){
        var parts = pair.split(':');
        if (parts.length !== 2) return;
        var attr = parts[0].trim(), key = parts[1].trim();
        var store = 'data-i18n-ru-' + attr.replace(/[^a-z]/gi, '');
        if (el.getAttribute(store) === null) el.setAttribute(store, el.getAttribute(attr) || '');
        el.setAttribute(attr, (lang === 'kz' && T.kz[key]) ? T.kz[key] : el.getAttribute(store));
      });
    });

    var els = document.querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(els, function(el) {
      var key = el.getAttribute('data-i18n');
      /* оригинал запоминаем всегда, до первой замены */
      if (el.getAttribute('data-i18n-ru') === null) {
        el.setAttribute('data-i18n-ru', el.textContent);
      }
      if (lang === 'kz' && T.kz[key]) {
        el.textContent = T.kz[key];
      } else {
        el.textContent = el.getAttribute('data-i18n-ru');
      }
    });

    try {
      var u = new URL(location.href);
      if (lang === 'kz') u.searchParams.set('lang', 'kz');
      else u.searchParams.delete('lang');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) {}

    try { document.dispatchEvent(new CustomEvent('gh:lang', { detail: lang })); } catch (e) {}

    var pill = document.querySelector('.pill');
    if (pill) {
      var segs = pill.querySelectorAll('.sg');
      if (segs.length) {
        Array.prototype.forEach.call(segs, function (sg) {
          sg.classList.toggle('on', sg.getAttribute('data-l') === lang);
        });
      } else {
        pill.textContent = lang === 'kz' ? 'РУС' : 'ҚАЗ';
      }
      pill.setAttribute('lang', lang === 'kz' ? 'ru' : 'kk');
      pill.setAttribute('aria-label',
        lang === 'kz' ? 'Переключить на русский' : 'Қазақ тіліне ауысу');
    }
  }
  
  window.GH_LANG = { 
    get: getLang, 
    set: setLang, 
    toggle: function() {
      setLang(getLang() === 'ru' ? 'kz' : 'ru');
    }
  };
  
  function init() {
    var pill = document.querySelector('.pill');
    if (pill && !pill.dataset.langBound) {
      pill.dataset.langBound = '1';        /* один обработчик, не больше */
      pill.addEventListener('click', function(e) {
        e.preventDefault();
        /* если ткнули точно в сегмент — ставим именно его язык,
           если мимо — просто переключаем */
        var sg = e.target.closest ? e.target.closest('.sg') : null;
        if (sg && sg.getAttribute('data-l')) window.GH_LANG.set(sg.getAttribute('data-l'));
        else window.GH_LANG.toggle();
      });
    }
    /* вызываем всегда: иначе при русском тумблер оставался без подсветки */
    setLang(getLang());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
