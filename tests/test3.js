const fs=require('fs'),{JSDOM}=require('jsdom'),DIR='../';
/* Разметку проверяем без содержимого <script>: там встречаются
   строки вида assets/' + v[0] + '.webp, и это не битый путь. */
function stripScripts(h){ return h.replace(/<script[\s\S]*?<\/script>/gi, ''); }

let pass=0,fail=0; const ok=m=>{console.log('  ✅ '+m);pass++}, no=m=>{console.log('  ❌ '+m);fail++};

function boot(mutate){
  const html=fs.readFileSync(DIR+'index.html','utf8');
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/'});
  const w=dom.window,store={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in store?store[k]:null,
    setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},configurable:true});
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=cb=>{setTimeout(()=>cb(Date.now()),0);return 1};
  w.cancelAnimationFrame=()=>{}; w.scrollTo=()=>{};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},
    fill(){},fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:''});
  const errs=[];
  const run=(f,src)=>{try{w.eval(src)}catch(e){errs.push(f+': '+e.message)}};
  const idx=html.indexOf('<script>'), inline=html.slice(idx+8,html.indexOf('</script>',idx));
  run('inline',inline);
  run('content',fs.readFileSync(DIR+'content.js','utf8'));
  if(mutate) mutate(w,store);
  run('engine',fs.readFileSync(DIR+'engine.js','utf8'));
  // инициализация слоя данных (тот блок, что добавлен в страницу)
  run('bind','(function(){ if(!window.GH) return; GH.bindText(); GH.seo({theme:"leather"}); GH.autoTrack("leather"); })()');
  run('lang',fs.readFileSync(DIR+'lang.js','utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {w,errs};
}

console.log('\n=== ВАРИАНТ А: страница на слое данных ===');
let r=boot();
r.errs.length?no('загрузка: '+r.errs.join(' | ')):ok('страница грузится, ошибок нет');

const d=r.w.document;
const txt=sel=>{const n=d.querySelector(sel);return n?n.textContent.trim():'(нет)'};
const norm=s=>s.replace(/[\u2009\u00a0]/g,' ');
ok('цена пакета 1: '+norm(txt('[data-gh="menus.0.price"]')));
ok('вместимость большого: '+txt('[data-gh="halls.0.min"]')+' — '+txt('[data-gh="halls.0.max"]'));
ok('вместимость малого: '+txt('[data-gh="halls.1.min"]')+' — '+txt('[data-gh="halls.1.max"]'));
ok('телефон: '+txt('[data-gh="contacts.phone1"]'));
ok('title: '+d.title.slice(0,70));
const ld=d.querySelectorAll('script[type="application/ld+json"]');
ld.length?ok('микроразметка добавлена ('+ld.length+' блока)'):no('нет ld+json');

console.log('\n=== ПРАВКИ ИЗ АДМИНКИ ДОХОДЯТ ДО САЙТА ===');
r=boot((w,store)=>{
  store['gh_content']=JSON.stringify({
    menus:[{id:'standart',name:'Стандарт',price:17900,dishes:['x'],gifts:[],note:'',meat:'—',weekdayOnly:true,pick:false},
           {id:'premium',name:'Премиум',price:21000,dishes:['x'],gifts:[],note:'',meat:'—',weekdayOnly:false,pick:true},
           {id:'royal',name:'Королевский',price:26000,dishes:['x'],gifts:[],note:'',meat:'—',weekdayOnly:false,pick:false}],
    halls:[{id:'big',name:'Большой зал',min:180,max:400,sound:0,decor:0,specs:[]},
           {id:'small',name:'Малый зал',min:60,max:170,sound:0,decor:0,specs:[]}],
    contacts:{phone1:'+7 707 111 22 33',phone2:'',whatsapp:'77071112233',
              address:'пр. Тәуелсіздік, 42',city:'Астана',hours:'Ежедневно, 11:00 — 23:00',hoursShort:'11:00—23:00'}
  });
});
r.errs.length&&no('ошибки: '+r.errs.join(' | '));
const d2=r.w.document, t2=sel=>{const n=d2.querySelector(sel);return n?n.textContent.trim():'(нет)'};
const checks=[
  ['цена пакета 1','[data-gh="menus.0.price"]','17 900 ₸'],
  ['цена пакета 3','[data-gh="menus.2.price"]','26 000 ₸'],
  ['максимум большого','[data-gh="halls.0.max"]','400'],
  ['минимум малого','[data-gh="halls.1.min"]','60'],
  ['телефон','[data-gh="contacts.phone1"]','+7 707 111 22 33'],
  ['адрес','[data-gh="contacts.address"]','пр. Тәуелсіздік, 42'],
  ['часы','[data-gh="contacts.hours"]','Ежедневно, 11:00 — 23:00'],
];
checks.forEach(([name,sel,want])=>{
  const got=norm(t2(sel));
  got===want?ok(name+' → '+got):no(name+': ожидали "'+want+'", получили "'+got+'"');
});
const waHref=d2.querySelector('[data-gh-href="wa"]');
waHref&&waHref.getAttribute('href').includes('77071112233')?ok('WhatsApp-ссылка обновилась на новый номер')
  :no('WhatsApp-ссылка: '+(waHref?waHref.getAttribute('href'):'нет'));
const telHref=d2.querySelector('[data-gh-href="tel1"]');
telHref&&telHref.getAttribute('href')==='tel:+77071112233'?ok('tel:-ссылка обновилась')
  :no('tel: '+(telHref?telHref.getAttribute('href'):'нет'));

console.log('\n=== АДМИНКА ПРИСЛАЛА МУСОР — САЙТ ЖИВ ===');
[['halls: []',{halls:[]}],['menus: null',{menus:null}],['contacts удалены',{contacts:null}],
 ['цена строкой',{menus:[{id:'a',name:'A',price:'абв',dishes:[]}]}],['битый JSON','{сломано']
].forEach(([name,payload])=>{
  const r=boot((w,store)=>{store['gh_content']=typeof payload==='string'?payload:JSON.stringify(payload)});
  r.errs.length?no(name+' → '+r.errs.join(' | ')):ok(name+' → страница жива');
});




console.log('\n=== ПЕРЕВОДЫ ===');
{
  const html=fs.readFileSync(DIR+'index.html','utf8'), lang=fs.readFileSync(DIR+'lang.js','utf8');
  const kh=[...new Set([...stripScripts(html).matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]))];
  const kz=new Set([...lang.matchAll(/'([a-z0-9._]+)':\s*'/g)].map(m=>m[1]));
  const miss=kh.filter(k=>!kz.has(k));
  miss.length?no('без перевода: '+miss.join(', ')):ok(`все ${kh.length} ключей переведены`);

  // реальное переключение на странице
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/'});
  const w=dom.window,store={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in store?store[k]:null,
    setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},configurable:true});
  w.eval(lang);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const before=[...w.document.querySelectorAll('[data-i18n]')].map(n=>n.textContent);
  w.GH_LANG.set('kz');
  const after=[...w.document.querySelectorAll('[data-i18n]')].map(n=>n.textContent);
  // слова, которые в казахском пишутся так же — менять их не нужно
  const SAME=new Set(['bk.p1.name','bk.p2.name','bk.p3.name','contacts.btn.wa','drawer.gallery',
    'footer.events.corp','footer.events.sundet','footer.events.uzatu','footer.nav.gallery',
    'gallery.meta','halls.spec.format','halls.spec.projector','halls.val.banquet','nav.gallery','nav.map',
    'hero.title',
    // одинаковые в обоих языках: бренд, заимствования, уже казахские слова
    'bk.cover.m','bk.cover.h3','bk.gifts.tag','bk.bye.city','halls.ev1','halls.ev2',
    'about.em','ct.phone','lead.phone','lead.hall','ct.open','bk.space.stage2','ft.hallsword']);
  const nodes=[...w.document.querySelectorAll('[data-i18n]')];
  const stuck=nodes.filter((n,i)=>before[i]===after[i]&&!SAME.has(n.getAttribute('data-i18n')));
  stuck.length?no('остались на русском: '+stuck.map(n=>n.getAttribute('data-i18n')).join(', '))
    :ok(`переводятся все ${before.length-SAME.size} элементов, требующих перевода`);
  w.GH_LANG.set('ru');
  const back=[...w.document.querySelectorAll('[data-i18n]')].map(n=>n.textContent);
  JSON.stringify(back)===JSON.stringify(before)?ok('возврат на русский полный, текст не теряется')
    :no('после возврата текст отличается');
  // кириллица не должна остаться в казахской версии там, где ждём казахский
  const ru=after.filter(t=>/\b(Меню|Залы|Галерея|Позвонить|Контакты|Разделы|гость)\b/.test(t));
  ru.length?no('на казахском остались русские слова: '+ru.slice(0,3).join(' | ')):ok('русских остатков в казахской версии нет');
}

console.log('\n=== SEO ===');
{
  const html=fs.readFileSync(DIR+'index.html','utf8');
  const title=(html.match(/<title>([^<]+)</)||[])[1]||'';
  /Вариант|Кожаное|leather/i.test(title)?no('в заголовке черновик: '+title):ok('заголовок: '+title);
  title.length>=45&&title.length<=75?ok(`длина заголовка ${title.length} символов — влезает в выдачу`)
    :no(`длина заголовка ${title.length} — Google обрежет`);
  const d=(html.match(/name="description" content="([^"]+)"/)||[])[1]||'';
  d.length>=120&&d.length<=200?ok(`описание ${d.length} символов`):no(`описание ${d.length} символов`);
  [['canonical',/rel="canonical"/],['og:image',/og:image"/],['hreflang kk',/hreflang="kk-KZ"/],
   ['geo.position',/geo\.position/],['robots',/name="robots"/],['preload hero',/rel="preload" as="image"/]
  ].forEach(([n,re])=>re.test(html)?ok(n+' есть'):no(n+' нет'));
  fs.existsSync(DIR+'robots.txt')?ok('robots.txt'):no('robots.txt нет');
  fs.existsSync(DIR+'sitemap.xml')?ok('sitemap.xml'):no('sitemap.xml нет');
  // микроразметка валидна как JSON
  const r=boot(); const lds=[...r.w.document.querySelectorAll('script[type="application/ld+json"]')];
  let bad=0; lds.forEach(n=>{try{JSON.parse(n.textContent)}catch(e){bad++}});
  bad?no(bad+' блок микроразметки с битым JSON'):ok(`микроразметка: ${lds.length} блока, JSON валиден`);
  const ld=JSON.parse(lds[0].textContent);
  ld['@type'].includes('Restaurant')?ok('тип Restaurant + EventVenue'):no('тип: '+ld['@type']);
  ld.hasMenu?ok('меню в микроразметке ('+ld.hasMenu.hasMenuSection.length+' пакета)'):no('меню не размечено');
  ld.openingHoursSpecification.opens==='10:00'?ok('часы работы из данных: '+ld.openingHoursSpecification.opens+'—'+ld.openingHoursSpecification.closes)
    :no('часы: '+JSON.stringify(ld.openingHoursSpecification));
}
console.log('\n══════ ФИНАЛ: '+pass+' прошло, '+fail+' упало ══════\n');
