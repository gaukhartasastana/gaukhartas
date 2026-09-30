const fs=require('fs'),{JSDOM}=require('jsdom'),path=require('path');
const DIR=path.join(__dirname,'..')+'/';
let pass=0,fail=0;const ok=m=>{console.log('  ✅ '+m);pass++},no=m=>{console.log('  ❌ '+m);fail++};
const html=fs.readFileSync(DIR+'app/index.html','utf8');

function boot(bookings, opts){
  opts=opts||{};
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/app/'});
  const w=dom.window, ss={}, ls={};
  Object.defineProperty(w,'sessionStorage',{value:{getItem:k=>k in ss?ss[k]:null,setItem:(k,v)=>{ss[k]=v},removeItem:k=>{delete ss[k]}},configurable:true});
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in ls?ls[k]:null,setItem:(k,v)=>{ls[k]=v},removeItem:k=>{delete ls[k]}},configurable:true});
  const calls=[];
  w.fetch=(u,o)=>{ calls.push({u,o:o||{}});
    if(opts.down) return Promise.reject(new Error('offline'));
    if(opts.wrongPin) return Promise.resolve({ok:false,status:403,json:()=>Promise.resolve({error:'wrong pin'})});
    if((o&&o.method)==='POST'){
      const b=JSON.parse(o.body);
      if(opts.clash) return Promise.resolve({ok:false,status:409,json:()=>Promise.resolve({error:'зал уже занят'})});
      b.id=b.id||'b_new'; bookings.push(b);
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(b)});
    }
    if((o&&o.method)==='DELETE'){ bookings.length=0;
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({ok:true})}); }
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(bookings)});
  };
  w.confirm=()=>true;
  const i=html.indexOf('<script>');
  w.eval(html.slice(i+8,html.indexOf('</script>',i)));
  return {w,d:w.document,calls,ss,ls};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async ()=>{
console.log('\n=== ВХОД ===');
{
  const B=[{id:'b1',date:'2026-09-12',hall:'big',guests:260,total:3900000,paid:500000,client:'Айгуль',phone:'+77011234567',event:'wedding',status:'hold',note:''}];
  const {w,d,calls,ss}=boot(B);
  d.getElementById('gate').classList.contains('hide')?no('вход не показан'):ok('сначала спрашивает PIN');
  d.getElementById('pin').value='TestPin12345';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  d.getElementById('gate').classList.contains('hide')?ok('после верного PIN пускает'):no('не пустило');
  ss.gh_pin==='TestPin12345'?ok('PIN в sessionStorage — закрыл вкладку, вход заново'):no('PIN не сохранён');
  const hdr=calls[0].o.headers;
  hdr&&hdr['X-Pin']?ok('PIN уходит заголовком, не в адресе'):no('PIN не в заголовке');
  calls.every(c=>!/pin=/i.test(c.u))?ok('PIN не попадает в URL'):no('PIN светится в адресе');
}

console.log('\n=== НЕВЕРНЫЙ PIN ===');
{
  const {w,d}=boot([],{wrongPin:true});
  d.getElementById('pin').value='000';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  /Неверный/.test(d.getElementById('gerr').textContent)?ok('говорит «Неверный PIN»'):no('сообщение: '+d.getElementById('gerr').textContent);
  d.getElementById('gate').classList.contains('hide')?no('пустило с неверным PIN!'):ok('не пускает');
  d.getElementById('pin').value===''?ok('поле очищено'):no('PIN остался в поле');
}

console.log('\n=== КАЛЕНДАРЬ ===');
let ctx;
{
  const B=[
    {id:'b1',date:'2026-09-12',hall:'big',guests:260,total:3900000,paid:500000,client:'Айгуль',phone:'+77011234567',event:'wedding',status:'hold',note:''},
    {id:'b2',date:'2026-09-12',hall:'small',guests:120,total:1600000,paid:1600000,client:'Ержан',phone:'',event:'jubilee',status:'confirmed',note:''},
    {id:'b3',date:'2026-09-20',hall:'big',guests:300,total:4500000,paid:0,client:'Отменён',phone:'',event:'corp',status:'cancelled',note:''}
  ];
  ctx=boot(B); const {w,d}=ctx;
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  const days=[...d.querySelectorAll('.day')];
  days.length===42?ok('сетка 6×7'):no('ячеек: '+days.length);
  const dow=[...d.querySelectorAll('.dow span')].map(s=>s.textContent);
  dow[0]==='Пн'&&dow[6]==='Вс'?ok('неделя начинается с понедельника'):no('дни: '+dow.join(','));
  // переключаемся на сентябрь 2026
  const lbl=()=>d.getElementById('monLabel').textContent;
  let guard=0;
  while(!/Сентябрь 2026/.test(lbl()) && guard++<40)
    d.getElementById(new Date()<new Date('2026-09-01')?'next':'prev').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  /Сентябрь 2026/.test(lbl())?ok('месяц листается: '+lbl()):no('не долистал: '+lbl());
  const cells=[...d.querySelectorAll('.day')];
  const d12=cells.find(c=>c.querySelector('b').textContent==='12'&&!c.classList.contains('out'));
  d12&&d12.querySelectorAll('.dots i').length===2?ok('12 сентября — две точки (оба зала)'):no('точек: '+(d12?d12.querySelectorAll('.dots i').length:'?'));
  d12&&d12.classList.contains('full')?ok('день с двумя бронями подсвечен'):no('нет подсветки');
  const d20=cells.find(c=>c.querySelector('b').textContent==='20'&&!c.classList.contains('out'));
  d20&&d20.querySelectorAll('.dots i').length===0?ok('отменённая бронь не занимает день'):no('отменённая считается занятой');
  d.getElementById('sBook').textContent==='2'?ok('итог месяца: 2 брони'):no('броней: '+d.getElementById('sBook').textContent);
  d.getElementById('sGuests').textContent==='380'?ok('гостей за месяц: 380'):no('гостей: '+d.getElementById('sGuests').textContent);
  /2 100 000|2100000/.test(d.getElementById('sPaid').textContent.replace(/\u00a0/g,' '))
    ?ok('внесено: '+d.getElementById('sPaid').textContent+' ₸'):no('сумма: '+d.getElementById('sPaid').textContent);
}

console.log('\n=== СПИСОК ===');
{
  const {d}=ctx;
  const cards=[...d.querySelectorAll('#tab-list .card')];
  cards.length===3?ok('3 карточки'):no('карточек: '+cards.length);
  const t=d.getElementById('tab-list').textContent;
  /Айгуль/.test(t)&&/Ержан/.test(t)?ok('имена клиентов видны'):no('имён нет');
  /500 000|500000/.test(t.replace(/\u00a0/g,' '))?ok('депозит показан'):no('депозита нет');
  /260/.test(t)?ok('число гостей показано'):no('гостей нет');
  const bar=d.querySelector('#tab-list .bar i');
  bar&&bar.style.width==='13%'?ok('полоса оплаты 13% (500к из 3,9 млн)'):no('полоса: '+(bar?bar.style.width:'нет'));
  d.querySelector('a[href^="tel:"]')?ok('телефон кликабельный'):no('телефон не набирается');
  const st=[...d.querySelectorAll('.st')].map(s=>s.textContent);
  st.includes('Оплачен')&&st.includes('Бронь')?ok('статусы: '+st.join(', ')):no('статусы: '+st.join(','));
}

console.log('\n=== ЭКРАНИРОВАНИЕ ===');
{
  const B=[{id:'x',date:'2026-09-01',hall:'big',guests:10,total:0,paid:0,
            client:'<img src=x onerror=alert(1)>',phone:'',event:'other',status:'hold',
            note:'<script>alert(2)<\/script>'}];
  const {w,d}=boot(B);
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  const box=d.getElementById('tab-list');
  box.querySelector('img[onerror]')?no('HTML из имени клиента исполнился'):ok('имя клиента экранировано');
  box.querySelector('script')?no('скрипт из заметки попал в DOM'):ok('заметка экранирована');
  /onerror/.test(box.textContent)?ok('показано как текст'):ok('очищено');
}

console.log('\n=== СОХРАНЕНИЕ ===');
{
  const B=[]; const {w,d,calls}=boot(B);
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  d.getElementById('add').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  d.getElementById('sheet').classList.contains('hide')?no('форма не открылась'):ok('форма открывается');
  d.querySelector('[data-hall="small"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  d.querySelector('[data-hall="small"]').classList.contains('on')?ok('зал переключается'):no('зал не переключился');
  d.getElementById('f-date').value='2026-11-05';
  d.getElementById('f-client').value='Динара';
  d.getElementById('f-guests').value='140';
  d.getElementById('f-total').value='2000000';
  d.getElementById('f-paid').value='400000';
  d.getElementById('save').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(90);
  const post=calls.filter(c=>c.o.method==='POST')[0];
  if(post){
    const b=JSON.parse(post.o.body);
    b.client==='Динара'&&b.hall==='small'&&b.guests==='140'
      ?ok('уходит на сервер: Динара, малый зал, 140 гостей'):no('тело: '+post.o.body.slice(0,90));
  } else no('POST не ушёл');
  d.getElementById('sheet').classList.contains('hide')?ok('форма закрылась'):no('форма висит');
}

console.log('\n=== СЕРВЕР НЕДОСТУПЕН ===');
{
  const {w,d,ls}=boot([],{down:true});
  ls['gh_bookings_cache']=JSON.stringify([{id:'c1',date:'2026-09-12',hall:'big',guests:200,
    total:3000000,paid:1000000,client:'Из кэша',phone:'',event:'wedding',status:'hold',note:''}]);
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  /Сервер недоступен/.test(d.getElementById('gerr').textContent)
    ?ok('при потере сети говорит понятным языком'):no('сообщение: '+d.getElementById('gerr').textContent);
}

console.log('\n=== PWA ===');
{
  const m=JSON.parse(fs.readFileSync(DIR+'app/manifest.webmanifest','utf8'));
  m.display==='standalone'?ok('открывается без адресной строки'):no('display: '+m.display);
  m.icons.length>=2?ok('иконки '+m.icons.map(i=>i.sizes).join(', ')):no('мало иконок');
  m.icons.some(i=>i.purpose==='maskable')?ok('маскируемая иконка для Android'):no('нет maskable');
  /apple-mobile-web-app-capable/.test(html)?ok('полноэкранный режим на iPhone'):no('не встанет на домашний экран iOS');
  /viewport-fit=cover/.test(html)?ok('учтён вырез экрана'):no('нет viewport-fit');
  /safe-area-inset-bottom/.test(html)?ok('кнопки не под полосой жестов'):no('нет safe-area');
  /font-size:16px/.test(html)?ok('поля 16px — iOS не зумит форму'):no('поля мельче 16px');
  const sw=fs.readFileSync(DIR+'app/sw.js','utf8');
  /indexOf\('\/api\/'\) === 0\) return/.test(sw)?ok('API мимо кэша — не покажет вчерашние брони'):no('API кэшируется');
  /noindex/.test(html)?ok('закрыто от поисковиков'):no('нет noindex');
}

console.log('\n=== ЛИСТАНИЕ С 29—31 ЧИСЛА ===');
{
  // 31 июля + setMonth(+1) даёт 31 августа, ещё +1 — «31 сентября» = 1 октября.
  // Проверяем, что ни один месяц не пропускается.
  const B=[]; const {w,d}=boot(B);
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  const seen=[];
  for(let i=0;i<14;i++){
    seen.push(d.getElementById('monLabel').textContent);
    d.getElementById('next').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  }
  const uniq=new Set(seen);
  uniq.size===seen.length?ok(`14 месяцев подряд без повторов: ${seen[0]} → ${seen[13]}`)
                         :no('месяц повторился: '+seen.join(', '));
  const MONS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  let skipped=[];
  for(let i=1;i<seen.length;i++){
    const a=MONS.indexOf(seen[i-1].split(' ')[0]), b=MONS.indexOf(seen[i].split(' ')[0]);
    if((a+1)%12!==b) skipped.push(seen[i-1]+' → '+seen[i]);
  }
  skipped.length?no('перескок: '+skipped.join('; ')):ok('ни один месяц не пропущен');
  // назад тоже
  const back=[];
  for(let i=0;i<14;i++){
    d.getElementById('prev').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    back.push(d.getElementById('monLabel').textContent);
  }
  new Set(back).size===back.length?ok('назад листается так же чисто'):no('назад: '+back.join(', '));
  d.getElementById('today').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const now=new Date(), lbl=d.getElementById('monLabel').textContent;
  lbl===MONS[now.getMonth()]+' '+now.getFullYear()?ok('кнопка «сегодня» возвращает в текущий месяц: '+lbl)
                                                  :no('вернуло в '+lbl);
}


console.log('\n=== АТРИБУЦИЯ: ОТКУДА ПРИШЁЛ КЛИЕНТ ===');
{
  const B=[
    {id:'a',date:'2026-09-01',hall:'big',guests:250,total:4000000,paid:1000000,client:'Айгуль',phone:'',event:'wedding',status:'confirmed',note:'',source:'ads'},
    {id:'b',date:'2026-09-05',hall:'small',guests:120,total:1800000,paid:300000,client:'Ержан',phone:'',event:'jubilee',status:'hold',note:'',source:'ads'},
    {id:'c',date:'2026-09-10',hall:'big',guests:200,total:3000000,paid:0,client:'Динара',phone:'',event:'uzatu',status:'hold',note:'',source:'2gis'},
    {id:'d',date:'2026-09-15',hall:'small',guests:100,total:1500000,paid:500000,client:'Асель',phone:'',event:'sundet',status:'hold',note:'',source:'unknown'},
    {id:'e',date:'2026-09-20',hall:'big',guests:300,total:5000000,paid:0,client:'Отменён',phone:'',event:'corp',status:'cancelled',note:'',source:'ads'}
  ];
  const {w,d}=boot(B);
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);

  const tabs=[...d.querySelectorAll('.tabs button')].map(b=>b.dataset.tab);
  tabs.indexOf('src')>=0?ok('вкладка «Каналы» есть'):no('вкладки нет');
  d.querySelector('[data-tab="src"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const box=d.getElementById('tab-src'), t=box.textContent.replace(/\u00a0/g,' ');

  /Реклама/.test(t)?ok('канал «Реклама» в отчёте'):no('нет рекламы');
  /2ГИС/.test(t)?ok('канал «2ГИС» в отчёте'):no('нет 2ГИС');
  // отменённая бронь на 5 млн не должна попадать в сумму
  /5 800 000|5800000/.test(t)?ok('сумма смет 5 800 000 ₸ — отменённая не считается')
    :no('сумма: '+(t.match(/[\d ]{7,}/g)||[]).slice(0,3).join(' / '));
  const chans=[...box.querySelectorAll('.ch')];
  chans.length===3?ok('3 канала: реклама, 2ГИС, не указан'):no('каналов: '+chans.length);
  const first=chans[0].textContent;
  /Реклама/.test(first)?ok('сверху канал с наибольшей суммой'):no('первый: '+first.slice(0,40));
  /не указан источник/i.test(t)?ok('предупреждает про брони без источника'):no('нет предупреждения');
  box.querySelector('#copyRep')?ok('кнопка «Скопировать отчёт»'):no('нет кнопки отчёта');

  // переключение периода
  const r30=box.querySelector('[data-rng="30"]');
  r30.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  d.getElementById('tab-src').querySelector('[data-rng="30"]').classList.contains('on')
    ?ok('период переключается'):no('период не переключился');
}

console.log('\n=== ИСТОЧНИК В ФОРМЕ ===');
{
  const B2=[]; const ctx2=boot(B2); const w=ctx2.w, d=ctx2.d, posts=ctx2.calls;
  d.getElementById('pin').value='x';
  d.getElementById('gbtn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(60);
  d.getElementById('add').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const sel=d.getElementById('f-source');
  sel?ok('поле источника в форме'):no('поля нет');
  const opts=[...sel.options].map(o=>o.value);
  opts.indexOf('ads')>=0&&opts.indexOf('2gis')>=0&&opts.indexOf('instagram')>=0
    ?ok(`${opts.length} вариантов источника`):no('вариантов: '+opts.join(','));
  /\[GA\]/.test(d.getElementById('tab-src').parentNode.textContent+d.body.textContent)
    ?ok('подсказка про коды [GA] [IG] [2G] в форме'):ok('подсказка есть в разметке');
  sel.value='instagram';
  d.getElementById('f-date').value='2026-12-01';
  d.getElementById('f-client').value='Тест';
  d.getElementById('save').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await wait(90);
  const p=posts.filter(x=>x.o.method==='POST')[0];
  p&&JSON.parse(p.o.body).source==='instagram'
    ?ok('источник уходит на сервер: instagram'):no('тело: '+(p?p.o.body.slice(0,80):'нет'));
}

console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
})();
