/* Честная эмуляция браузера: выполняются ТОЛЬКО теги без src.
   Прошлые тесты скармливали код вручную и поэтому пропустили,
   что панорама лежала внутри <script src="lang.js"> и не работала. */
const fs=require('fs'),{JSDOM}=require('jsdom'),path=require('path');
const DIR=path.join(__dirname,'..')+'/';
let pass=0,fail=0;const ok=m=>{console.log('  ✅ '+m);pass++},no=m=>{console.log('  ❌ '+m);fail++};
const html=fs.readFileSync(DIR+'index.html','utf8');

function browser(opts){
  opts=opts||{};
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,
    url:'https://gaukhartas.com/'+(opts.query||'')});
  const w=dom.window,st={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=v},removeItem:()=>{}},configurable:true});
  w.matchMedia=q=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=cb=>{if(opts.raf)setTimeout(()=>cb(1),0);return 0};
  w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){this.cb([{isIntersecting:true}])}disconnect(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:''});
  const posts=[];
  w.fetch=(u,o)=>{ posts.push({u,o:o||{}});
    if(opts.apiDown) return Promise.reject(new Error('down'));
    if(opts.api429)  return Promise.resolve({ok:false,status:429,json:()=>Promise.resolve({})});
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({ok:true})});
  };
  const errs=[];
  // ключевой момент: пропускаем всё, у чего есть src
  [...w.document.querySelectorAll('script')].forEach(t=>{
    if(t.getAttribute('src')) return;
    try{ w.eval(t.textContent); }catch(e){ errs.push(e.message); }
  });
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {w,d:w.document,posts,errs};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
console.log('\n=== НИЧЕГО НЕ ЛЕЖИТ ВНУТРИ ВНЕШНИХ ТЕГОВ ===');
{
  const stray=[...html.matchAll(/<script([^>]*src[^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m=>m[2].trim().length>0);
  stray.length
    ? no(stray.length+' внешних тегов с телом — браузер это игнорирует: '+stray.map(m=>m[1].trim()).join(', '))
    : ok('у всех тегов со src пустое тело');
}

console.log('\n=== СТРАНИЦА ЗАПУСКАЕТСЯ ===');
{
  const {d,errs}=browser();
  errs.length?no('ошибки: '+errs.join(' | ')):ok('инлайн-скрипты выполняются без ошибок');
  d.getElementById('lf')?ok('форма заявки на странице'):no('формы нет');
  d.querySelectorAll('.pano-pane').length===8?ok('панорама собрана: 8 граней')
    :no('граней панорамы: '+d.querySelectorAll('.pano-pane').length);
  typeof d.defaultView.ghConv==='function'?ok('счётчик конверсий подключён'):no('ghConv не определён');
}

console.log('\n=== ЗАСТАВКА И РЕКЛАМА ===');
{
  const a=browser({query:'?gclid=Cj0KCQtest'});
  a.d.body.classList.contains('revealed')||!a.d.getElementById('intro')
    ?ok('переход с рекламы: заставка пропущена')
    :no('человек с рекламы упирается в заставку');
  const b=browser({query:'?utm_source=google&utm_medium=cpc'});
  b.d.body.classList.contains('revealed')||!b.d.getElementById('intro')
    ?ok('utm-метки тоже пропускают заставку'):no('utm не распознан');
}

console.log('\n=== ОТПРАВКА ЗАЯВКИ ===');
{
  const {w,d,posts}=browser();
  const fill=(n,p,dt,g)=>{d.getElementById('l-name').value=n;d.getElementById('l-phone').value=p;
    d.getElementById('l-date').value=dt||'';d.getElementById('l-guests').value=g||''};
  const submit=()=>d.getElementById('lf').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const err=()=>d.getElementById('l-err').textContent;

  fill('','+77011234567'); submit();
  /как к вам обращаться/i.test(err())?ok('пустое имя не пропускает'):no('имя: '+err());
  fill('Айгуль','123'); submit();
  /11 цифр/.test(err())?ok('короткий номер не пропускает'):no('телефон: '+err());
  fill('Айгуль','+77011234567','2020-01-01'); submit();
  /прошла/.test(err())?ok('дата в прошлом не пропускает'):no('дата: '+err());
  fill('Айгуль','+77011234567','',9999); submit();
  /гостей/i.test(err())?ok('9999 гостей не пропускает'):no('гости: '+err());

  posts.length===0?ok('до этого момента на сервер ничего не ушло'):no('улетело '+posts.length+' запросов');

  fill('Айгуль','8 701 234 56 78','2027-05-20',180);
  submit(); await wait(60);
  const p=posts.filter(x=>String(x.u).indexOf('/api/leads')>=0)[0];
  if(p){
    const b=JSON.parse(p.o.body);
    b.phone==='+77012345678'?ok('номер с 8 приведён к +7: '+b.phone):no('номер: '+b.phone);
    b.name==='Айгуль'&&b.guests==='180'?ok('данные ушли верно'):no('тело: '+p.o.body.slice(0,90));
    b.source?ok('источник перехода сохранён'):no('нет источника');
  } else no('заявка не ушла на сервер');
  d.getElementById('leadDone').style.display==='block'?ok('показан экран «заявка принята»'):no('нет подтверждения');
  d.getElementById('leadForm').style.display==='none'?ok('форма скрыта после отправки'):no('форма осталась');
}

console.log('\n=== ДВОЙНАЯ ОТПРАВКА ===');
{
  const {w,d,posts}=browser();
  d.getElementById('l-name').value='Тест'; d.getElementById('l-phone').value='+77011234567';
  const ev=()=>d.getElementById('lf').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  ev(); ev(); ev(); await wait(60);
  const n=posts.filter(x=>String(x.u).indexOf('/api/leads')>=0).length;
  n===1?ok('три нажатия подряд → одна заявка'):no('ушло заявок: '+n);
}

console.log('\n=== СЕРВЕР НЕ ОТВЕТИЛ ===');
{
  const {w,d}=browser({apiDown:true});
  d.getElementById('l-name').value='Ержан'; d.getElementById('l-phone').value='+77011234567';
  d.getElementById('lf').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await wait(60);
  const h=d.getElementById('l-err').innerHTML;
  /wa\.me/.test(h)?ok('предлагает WhatsApp с готовым текстом — человек не теряется'):no('запасного пути нет');
  /Ержан/.test(decodeURIComponent(h))?ok('имя подставлено в сообщение'):no('текст пустой');
  d.getElementById('l-sub').disabled?no('кнопка осталась заблокированной'):ok('кнопку можно нажать снова');
}

console.log('\n=== СОБЫТИЯ ДЛЯ РЕКЛАМЫ ===');
{
  const {w,d}=browser();
  const fired=[];
  w.ghConv=(n,x)=>fired.push(n);
  d.querySelector('a[href^="https://wa.me"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  d.querySelector('a[href^="tel:"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  fired.indexOf('whatsapp_click')>=0?ok('клик по WhatsApp считается конверсией'):no('WhatsApp не отслеживается');
  fired.indexOf('call_click')>=0?ok('клик по телефону считается конверсией'):no('звонок не отслеживается');
  /gaId:\s*''/.test(html)?ok('поля для GA4 и Ads пустые — заполнить своими'):ok('идентификаторы заданы');
  /googletagmanager/.test(html)?ok('gtag подключается при заполнении'):no('нет gtag');
  /mc\.yandex\.ru\/metrika/.test(html)?ok('Метрика подключается при заполнении'):no('нет Метрики');
}
console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
})();
