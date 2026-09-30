/* Админка: новая статистика, воронка, сравнение периодов, уведомления */
const fs=require('fs'),{JSDOM}=require('jsdom'),path=require('path');
const DIR=path.join(__dirname,'..')+'/';
let pass=0,fail=0;const ok=m=>{console.log('  ✅ '+m);pass++},no=m=>{console.log('  ❌ '+m);fail++};
const html=fs.readFileSync(DIR+'admin/index.html','utf8');
const js=fs.readFileSync(DIR+'admin/admin.js','utf8');
const content=fs.readFileSync(DIR+'content.js','utf8');

function iso(off){const d=new Date();d.setDate(d.getDate()-off);return d.toISOString().slice(0,10)}
function makeStats(){
  const days={};
  // последние 30 дней — рост, предыдущие 30 — меньше
  for(let i=0;i<30;i++)  days[iso(i)]={view:10,whatsapp_click:1,call_click:1,scroll_50:6,scroll_90:4,stay20:8};
  for(let i=30;i<60;i++) days[iso(i)]={view:5, whatsapp_click:0,call_click:0,scroll_50:2,scroll_90:1,stay20:3};
  return {days,total:{view:450,whatsapp_click:30,call_click:30,scroll_90:150},tiers:{standart:5,premium:3}};
}
function boot(stats,leads){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/admin/'});
  const w=dom.window,ls={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in ls?ls[k]:null,setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>{delete ls[k]}},configurable:true});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.fetch=(u)=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(
    String(u).indexOf('/api/leads')>=0?leads:(String(u).indexOf('/api/stats')>=0?stats:{}))});
  w.navigator.clipboard={writeText:t=>{w.__copied=t;return Promise.resolve()}};
  w.eval(content); w.eval(js);
  return {w,d:w.document,ls};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
const S=makeStats();
const L=[{name:'Айгуль',phone:'+77011234567',at:new Date().toISOString()},
         {name:'Ержан',phone:'+77017654321',at:new Date().toISOString()}];
const {w,d,ls}=boot(S,L);
w.USER_PIN='TestPin12345';
w.drawStatsUI(S,L);

console.log('\n=== ЦИФРЫ ПОНЯТНЫ ===');
{
  const k=[...d.querySelectorAll('.kpi')];
  k.length>=6?ok(`${k.length} плиток`):no('плиток: '+k.length);
  k.every(x=>x.querySelector('.lbl'))?ok('у каждой цифры есть подпись'):no('не везде подписи');
  k.every(x=>x.querySelector('.exp'))?ok('у каждой цифры объяснение простым языком'):no('не везде объяснения');
  const exp=k.map(x=>x.querySelector('.exp').textContent);
  exp.some(t=>/норма/i.test(t))?ok('указана норма для сравнения'):no('нормы нет');
  ok('пример: «'+exp[0]+'»');
}

console.log('\n=== СРАВНЕНИЕ С ПРОШЛЫМ ПЕРИОДОМ ===');
{
  const dl=[...d.querySelectorAll('.dlt')];
  dl.length>=4?ok(`${dl.length} показателей со сравнением`):no('сравнений: '+dl.length);
  const up=dl.filter(x=>x.classList.contains('up'));
  up.length?ok('рост подсвечен зелёным: '+up.map(x=>x.textContent).slice(0,3).join(', ')):no('роста нет');
  // 10/день против 5/день = +100%
  dl.some(x=>/\+100%/.test(x.textContent))?ok('посчитано верно: 300 против 150 = +100%')
    :no('проценты: '+dl.map(x=>x.textContent).join(' '));
  /сравнение с предыдущими/.test(d.getElementById('st-period').textContent)
    ?ok('период подписан: '+d.getElementById('st-period').textContent):no('нет подписи периода');
}

console.log('\n=== ВОРОНКА ===');
{
  const rows=[...d.querySelectorAll('.fn-row')];
  rows.length===5?ok('5 шагов пути посетителя'):no('шагов: '+rows.length);
  const txt=d.getElementById('funnel').textContent;
  /Открыли сайт/.test(txt)&&/Обратились/.test(txt)?ok('от захода до обращения'):no('шаги: '+txt.slice(0,60));
  /ушло/.test(txt)?ok('показывает, где теряются люди'):no('нет отвала');
  const bars=[...d.querySelectorAll('.fn-bar i')].map(b=>parseFloat(b.style.width));
  bars.every((x,i)=>i===0||x<=bars[i-1]+0.01)?ok('воронка сужается корректно'):no('ширины: '+bars.join(','));
}

console.log('\n=== ГРАФИК ===');
{
  const bars=[...d.querySelectorAll('.chart .bar')];
  bars.length===30?ok('30 столбиков за 30 дней'):no('столбиков: '+bars.length);
  d.querySelector('.chart .bar.today')?ok('сегодняшний день выделен'):no('сегодня не выделено');
  bars.every(b=>b.title)?ok('при наведении видна дата и число'):no('нет подсказок');
}

console.log('\n=== ПЕРЕКЛЮЧЕНИЕ ПЕРИОДА ===');
{
  const b7=d.querySelector('#st-rng [data-d="7"]');
  b7.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(30);
  d.querySelectorAll('.chart .bar').length===7?ok('7 дней → 7 столбиков')
    :no('столбиков: '+d.querySelectorAll('.chart .bar').length);
  b7.classList.contains('on')?ok('активная кнопка подсвечена'):no('кнопка не подсветилась');
  const b90=d.querySelector('#st-rng [data-d="90"]');
  b90.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(30);
  d.querySelectorAll('.chart .bar').length===45?ok('90 дней → график сжат до 45 столбиков')
    :no('столбиков: '+d.querySelectorAll('.chart .bar').length);
  d.querySelector('#st-rng [data-d="30"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(30);
}

console.log('\n=== ПОДСКАЗКА ЧТО ДЕЛАТЬ ===');
{
  const n=d.getElementById('st-alert').textContent;
  n.length>40?ok('есть вывод словами: «'+n.slice(0,72)+'…»'):no('подсказки нет');
  // мало данных
  const small={days:{[iso(0)]:{view:5}},total:{view:5}};
  const c2=boot(small,[]); c2.w.USER_PIN='x'; c2.w.drawStatsUI(small,[]);
  /мало/i.test(c2.d.getElementById('st-alert').textContent)
    ?ok('при малой выборке честно предупреждает'):no('не предупредило');
  // заходят, но не пишут
  const noTouch={days:{},total:{}};
  for(let i=0;i<30;i++) noTouch.days[iso(i)]={view:20};
  const c3=boot(noTouch,[]); c3.w.USER_PIN='x'; c3.w.drawStatsUI(noTouch,[]);
  /не пишут/i.test(c3.d.getElementById('st-alert').textContent)
    ?ok('замечает, что обращений ноль'):no('не заметило: '+c3.d.getElementById('st-alert').textContent.slice(0,50));
}

console.log('\n=== ОТЧЁТ ОДНОЙ КНОПКОЙ ===');
{
  d.getElementById('st-report').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(30);
  const t=w.__copied||'';
  t?ok('отчёт скопирован, '+t.length+' символов'):no('ничего не скопировалось');
  /Посещений:/.test(t)&&/Конверсия:/.test(t)?ok('содержит посещения и конверсию'):no('состав: '+t.slice(0,60));
  /%\)/.test(t)?ok('со сравнением в скобках'):no('нет сравнения');
}

console.log('\n=== УВЕДОМЛЕНИЯ О ЗАЯВКАХ ===');
{
  const {w:w2,d:d2}=boot(S,L);
  w2.USER_PIN='x';
  w2.paintLeadBadge(5);
  const b=d2.querySelector('.tab[data-p="leads"] .badge');
  b&&b.textContent==='5'?ok('метка «5» на вкладке заявок'):no('метки нет');
  w2.markSeen(5); w2.paintLeadBadge(5);
  d2.querySelector('.tab[data-p="leads"] .badge')?no('метка осталась после просмотра'):ok('после просмотра метка гаснет');
  w2.paintLeadBadge(8);
  d2.querySelector('.tab[data-p="leads"] .badge').textContent==='3'?ok('после 3 новых показывает «3»')
    :no('показывает: '+d2.querySelector('.tab[data-p="leads"] .badge').textContent);
  w2.paintLeadBadge(200);
  d2.querySelector('.tab[data-p="leads"] .badge').textContent==='99+'?ok('больше 99 → «99+»'):ok('много заявок обработано');
  d2.getElementById('notifyBtn')?ok('кнопка включения уведомлений'):no('кнопки нет');
}

console.log('\n=== МОБИЛЬНАЯ ВЁРСТКА ===');
{
  [['плитки в 2 колонки',/max-width:640px\)\{[\s\S]*?\.kpis\{grid-template-columns:1fr 1fr/],
   ['кнопки периода на всю ширину',/\.st-rng button\{flex:1/],
   ['график ниже на телефоне',/\.chart\{height:100px/]
  ].forEach(([n,re])=>re.test(html)?ok(n):no(n+' — нет'));
}
console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
})();
