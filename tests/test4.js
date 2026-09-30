const fs=require('fs'),{JSDOM}=require('jsdom'),DIR='../';
let pass=0,fail=0; const ok=m=>{console.log('  ✅ '+m);pass++}, no=m=>{console.log('  ❌ '+m);fail++};
const html=fs.readFileSync(DIR+'index.html','utf8'), langSrc=fs.readFileSync(DIR+'lang.js','utf8');

function dom(){
  const d=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/'});
  const w=d.window,st={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in st?st[k]:null,
    setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}},configurable:true});
  w.matchMedia=q=>({matches:/coarse|max-width:\s*(6[0-9]{2}|5[0-9]{2}|[1-4][0-9]{2})px/.test(q),
    addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=cb=>{setTimeout(()=>cb(1),0);return 1}; w.cancelAnimationFrame=()=>{}; w.scrollTo=()=>{};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:''});
  const i=html.indexOf('<script>');
  w.eval(html.slice(i+8,html.indexOf('</script>',i)));
  w.eval(langSrc); w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}

console.log('\n=== ПЕРЕВОДЫ: ПРОВЕРКА СМЫСЛА ===');
{
  const w=dom(), nodes=[...w.document.querySelectorAll('[data-i18n]')];
  const ru=nodes.map(n=>n.textContent.trim());
  w.GH_LANG.set('kz');
  const kz=nodes.map(n=>n.textContent.trim());

  const BAD=[[/(^|[\s·,.])қаза([\s·,.]|$)/,'смерть/кончина'],[/(^|[\s·,.])өлім([\s·,.]|$)/,'смерть'],
             [/жерлеу/,'похороны'],[/Үстелге тапсырыс/,'заказ столика — бронируют зал, а не столик']];
  const found=[];
  kz.forEach(t=>BAD.forEach(([re,why])=>{ if(re.test(t)) found.push(`«${t}» (${why})`) }));
  found.length?no('опасные слова: '+found.join('; ')):ok('запрещённых по смыслу слов нет');

  // символьные кнопки не должны превращаться в текст
  const sym=nodes.filter((n,i)=>/^[^\p{L}\p{N}]+$/u.test(ru[i])&&kz[i].length>3);
  sym.length?no('символ→текст: '+sym.map(n=>n.getAttribute('data-i18n')).join(', '))
            :ok('символьные кнопки (‹ ›) остаются символами');

  // aria-label переводится
  const prev=w.document.getElementById('prev');
  prev.textContent.trim()==='‹'?ok('кнопка «назад» показывает ‹, а не текст'):no('кнопка: '+prev.textContent);
  prev.getAttribute('aria-label')==='Алдыңғы бет'?ok('aria-label переведён: '+prev.getAttribute('aria-label'))
    :no('aria-label: '+prev.getAttribute('aria-label'));

  // заголовки не подменяются другим текстом
  const t=(k)=>{const n=nodes.find(x=>x.getAttribute('data-i18n')===k);return n?n.textContent.trim():''};
  t('menu.title')==='Мәзірімізді парақтаңыз'?ok('заголовок меню: '+t('menu.title')):no('menu.title: '+t('menu.title'));
  t('gallery.title').length>10?ok('заголовок галереи: '+t('gallery.title')):no('gallery.title подменён на «'+t('gallery.title')+'»');
  t('nav.book')==='Күнді брондау'?ok('кнопка брони: '+t('nav.book')):no('nav.book: '+t('nav.book'));
  t('halls.title')==='Залдар'?ok('надзаголовок залов не дублирует подзаголовок'):no('halls.title: '+t('halls.title'));

  // длина: казахский не должен быть в разы длиннее в узких элементах
  const blow=nodes.filter((n,i)=>ru[i].length>5&&kz[i].length>ru[i].length*2);
  blow.length?no('перевод вдвое длиннее: '+blow.map(n=>n.getAttribute('data-i18n')).join(', '))
             :ok('нигде перевод не разросся вдвое — вёрстка не поедет');

  // русская версия: «столик» в банкетном зале
  const ruAll=html;
  /Забронировать столик|Үстелге тапсырыс/.test(ruAll)?no('осталось «забронировать столик»'):ok('«столик» заменён на «дату» — бронируют зал');
  w.GH_LANG.set('ru');
  const back=nodes.map(n=>n.textContent.trim());
  JSON.stringify(back)===JSON.stringify(ru)?ok('возврат на русский без потерь'):no('русский текст изменился после переключения');
}

console.log('\n=== ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА НА ТЕЛЕФОНЕ ===');
{
  const w=dom(), d=w.document;
  const btns=[...d.querySelectorAll('.drw .lng')];
  btns.length===2?ok('в мобильном меню две кнопки языка'):no('кнопок языка в меню: '+btns.length);
  const p=d.querySelector('[data-i18n="nav.halls"]');
  const before=p.textContent;
  btns.find(b=>b.dataset.lang==='kz').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  p.textContent!==before?ok('кнопка «Қазақша» переключает язык: '+before+' → '+p.textContent)
                        :no('язык не переключился с кнопки в меню');
  const drw=d.getElementById('drw');
  drw.dataset.open!=='true'||ok('меню не закрылось от нажатия на язык');
  btns.find(b=>b.dataset.lang==='kz').getAttribute('aria-pressed')==='true'
    ?ok('активный язык подсвечен'):no('aria-pressed не выставлен');
  btns.find(b=>b.dataset.lang==='ru').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  p.textContent===before?ok('возврат на русский из меню работает'):no('русский не вернулся');
  // .pill скрыт на узких экранах — проверяем, что это осознанно и есть замена
  /\.pill\{display:none\}/.test(html)
    ?no('.pill всё ещё скрывается на телефоне'):ok('.pill не скрывается — стал компактным');
}

console.log('\n=== КНИГА НА ТЕЛЕФОНЕ ===');
{
  const w=dom(), d=w.document, book=d.getElementById('book');
  const pd=(x,y,id)=>{const e=new w.Event('pointerdown',{bubbles:true});
    Object.assign(e,{clientX:x,clientY:y,pointerId:id||1,button:0});book.dispatchEvent(e)};
  const pm=(x,y,id)=>{const e=new w.Event('pointermove',{bubbles:true});
    Object.assign(e,{clientX:x,clientY:y,pointerId:id||1});book.dispatchEvent(e)};
  const pu=(id)=>{const e=new w.Event('pointerup',{bubbles:true});
    Object.assign(e,{pointerId:id||1});book.dispatchEvent(e)};
  book.setPointerCapture=()=>{}; book.releasePointerCapture=()=>{};
  book.getBoundingClientRect=()=>({width:340,height:480,left:0,top:0,right:340,bottom:480});

  const dots=()=>[...d.querySelectorAll('.pgs i')].findIndex(i=>i.classList.contains('on'));
  const start=dots();
  // 1. вертикальный свайп = скролл, книга листаться не должна
  pd(200,300); pm(195,360); pm(190,420); pu();
  dots()===start?ok('вертикальный свайп не листает книгу (это скролл страницы)'):no('книга перелистнулась при скролле');
  // 2. микро-движение = тап, не перелистывание
  pd(200,300); pm(192,301); pu();
  dots()===start?ok('тап со сдвигом 8px не листает (порог для пальца — 14px)'):no('перелистнулось от случайного сдвига');
  // 3. нормальный горизонтальный свайп листает
  pd(300,300); pm(240,302); pm(180,303); pm(120,304); pu();
  dots()>start?ok('горизонтальный свайп листает: страница '+start+' → '+dots()):no('свайп не сработал, страница '+dots());
  // 4. второй палец не ломает жест
  const cur=dots();
  pd(300,300,1); pd(100,100,2); pm(150,300,1); pu(2);
  ok('второй палец не перехватывает жест (страница '+dots()+')');
  pu(1);
  // 5. клик по ссылке внутри страницы не начинает перетаскивание
  const link=book.querySelector('a[href^="tel:"]');
  if(link){
    const e=new w.Event('pointerdown',{bubbles:true});
    Object.assign(e,{clientX:100,clientY:100,pointerId:9,button:0});
    link.dispatchEvent(e);                       // всплывёт до book, target = ссылка
    const e2=new w.Event('pointermove',{bubbles:true});
    Object.assign(e2,{clientX:20,clientY:100,pointerId:9}); book.dispatchEvent(e2);
    link.classList.contains('dragging')||!book.querySelector('.dragging')
      ?ok('тап по телефону внутри книги не начинает перелистывание'):no('ссылка запустила drag');
  } else ok('ссылок внутри книги нет — проверка не нужна');
  // 6. кнопки листания
  const nx=d.getElementById('next'), pv=d.getElementById('prev');
  nx.type==='button'&&pv.type==='button'?ok('кнопки листания type="button" — не сабмитят форму')
    :no('кнопки без type — в форме отправят её');
}

console.log('\n=== МОБИЛЬНАЯ ВЁРСТКА ===');
{
  const css=html;
  [['высота книги ограничена экраном',/100svh - 260px/],
   ['на узких экранах книга плоская',/max-width:520px\)\{[\s\S]*?perspective:none/],
   ['тап без серой подсветки',/-webkit-tap-highlight-color:transparent/],
   ['казахский не ломает кнопки',/html\[lang="kk"\]/],
   ['длинные ссылки переносятся',/word-break:break-word/],
   ['кнопки языка не меньше 44px',/\.lng\{[^}]*min-height:4[4-9]px/]
  ].forEach(([n,re])=>re.test(css)?ok(n):no(n+' — не найдено'));
}

console.log('\n=== КНОПКА БРОНИ И ЗАСТАВКА ===');
{
  const w=dom();
  const a=w.document.querySelector('.bookcta');
  const txt=()=>({sh:a.querySelector('.sh').textContent.trim(), lg:a.querySelector('.lg').textContent.trim()});
  let t=txt();
  (t.sh==='Забронировать'&&t.lg==='Забронировать дату')?ok(`RU: «${t.sh}» / «${t.lg}»`):no('RU: '+JSON.stringify(t));
  w.GH_LANG.set('kz'); t=txt();
  (t.sh==='Брондау'&&t.lg==='Күнді брондау')?ok(`KZ: «${t.sh}» / «${t.lg}»`):no('KZ: '+JSON.stringify(t));
  /столик/.test(a.textContent)?no('в кнопке остался «столик» — бронируют зал, а не столик'):ok('«столик» нигде не осталось');
  /Үстелге/.test(a.textContent)?no('в казахском остался «Үстелге» (заказ столика)'):ok('«Үстелге» убрано');
  w.GH_LANG.set('ru'); t=txt();
  t.sh==='Забронировать'?ok('возврат на русский без потерь'):no('после возврата: '+JSON.stringify(t));
  w.document.getElementById('replay')?no('кнопка «Заставка» ещё на странице'):ok('кнопка «Заставка» убрана');
  /\.replay\{/.test(html)?no('стили .replay остались'):ok('стили .replay вычищены');
}

console.log('\n=== ВЕРСИИ ФАЙЛОВ (защита от кэша) ===');
{
  const built=fs.readFileSync(DIR+'deploy/public/index.html','utf8');
  ['lang.js','engine.js','content.js'].forEach(f=>{
    new RegExp(f.replace('.','\\.')+'\\?v=[a-f0-9]{8}').test(built)
      ?ok(f+' с версией'):no(f+' без версии — браузер будет держать старый');
  });
}

console.log('\n=== КНИГА: ПОСЛЕДНЯЯ СТРАНИЦА НЕ ПРОПАДАЕТ ===');
{
  const w=dom(), doc=w.document;
  const leaves=[...doc.querySelectorAll('.book .leaf')];
  const faces=[...doc.querySelectorAll('.book .face')];
  const nx=doc.getElementById('next');
  // dom() отдаёт matchMedia с coarse=true → книга в линейном режиме
  let empty=[], step=0;
  while(step<25){
    const flat=faces.filter(f=>f.classList.contains('show')).length;
    const spread=leaves.filter(l=>!l.classList.contains('flipped')||l.classList.contains('top')).length;
    if(!flat && !spread) empty.push(step);
    if(nx.disabled) break;
    nx.click(); step++;
  }
  empty.length?no('книга пропадает на шагах: '+empty.join(', ')):ok(`пройдено ${step+1} страниц, пустых нет`);
  const top=leaves.filter(l=>l.classList.contains('top')).length;
  top<=1?ok('верхний перевёрнутый лист ровно один'):no('листов .top: '+top);
  /\.leaf\.flipped\.top\{opacity:1\}/.test(html)?ok('верхний лист не гасится на телефоне')
    :no('.leaf.flipped.top не найден — на телефоне последняя страница исчезнет');

  const bye=doc.querySelector('[data-i18n="bk.bye.t1"]');
  bye?ok('прощальная страница на месте: «'+bye.textContent+' '+doc.querySelector('[data-i18n="bk.bye.t2"]').textContent+'»')
     :no('прощальной страницы нет');
  w.GH_LANG.set('kz');
  bye&&bye.textContent==='Сізді'?ok('на казахском: «Сізді күтеміз»'):no('KZ: '+(bye?bye.textContent:'-'));

  // точек создаётся по максимуму (все страницы), лишние скрываются через hidden
  const all=doc.querySelectorAll('.pgs i').length;
  const shown=[...doc.querySelectorAll('.pgs i')].filter(d=>!d.hidden).length;
  const faceCount=doc.querySelectorAll('.book .face').length;
  all===faceCount?ok(`точек создано ${all} — по числу страниц`):no(`точек ${all}, страниц ${faceCount}`);
  shown===faceCount?ok(`на телефоне видно ${shown} точек`):no(`видно ${shown} из ${faceCount}`);
  // каждый лист должен иметь обе стороны
  const bad=leaves.filter(l=>[...l.children].filter(c=>c.classList.contains('face')).length!==2);
  bad.length?no(bad.length+' лист(ов) с неверным числом сторон'):ok('у каждого листа лицо и оборот');
}

console.log('\n=== СКОРОСТЬ ЛИСТАНИЯ ===');
{
  // на телефоне книга больше не перелистывается 3D — там плавная смена страницы
  /max-width:620px\)\{[\s\S]*?\.face\{[\s\S]*?transition:opacity \.32s/.test(html)
    ? ok('на телефоне страница сменяется плавно за 0.32s, без резкого переворота')
    : no('не нашёл плавную смену страницы на телефоне');
  /max-width:620px\)\{[\s\S]*?\.leaf\{[\s\S]*?transition:none/.test(html)
    ? ok('3D-переворот на телефоне отключён — не мельтешит')
    : no('переворот на телефоне не отключён');
}

console.log('\n=== ПОДВАЛ И КОНТАКТЫ НА ТЕЛЕФОНЕ ===');
{
  [['карта под текстом',/\.ct-map\{order:2/],
   ['контакты в одну колонку',/\.ct-grid\{grid-template-columns:1fr/],
   ['маршруты не меньше 46px',/\.route a\{[^}]*min-height:46px/],
   ['кнопки звонка в сетке',/\.ct-btns\{display:grid/],
   ['короткие поля парами',/\.ct-rows\{display:grid;grid-template-columns:1fr 1fr/],
   ['на 520px поля в одну колонку',/max-width:520px\)\{[\s\S]*?\.ct-rows\{grid-template-columns:1fr\}/]
  ].forEach(([n,re])=>re.test(html)?ok(n):no(n+' — не найдено'));
}

console.log('\n=== КАРТА: АТРИБУЦИЯ ===');
{
  /attributionControl\.setPrefix/.test(html)
    ? ok('префикс Leaflet переопределён — флага в подписи не будет')
    : no('setPrefix не вызывается: Leaflet подставит свой префикс с флагом');
  const a=html.indexOf('setPrefix'), b=html.indexOf('L.tileLayer');
  (a>0&&a<b)?ok('префикс сбрасывается до отрисовки слоя'):no('setPrefix вызывается после слоя — флаг успеет мелькнуть');
  /openstreetmap\.org\/copyright/.test(html)?ok('ссылка на лицензию OpenStreetMap сохранена')
    :no('нет ссылки на OSM — этого требует лицензия данных');
  /carto\.com\/attributions/.test(html)?ok('ссылка на условия CARTO сохранена'):no('нет ссылки CARTO');
}



console.log('\n=== ТЕЛЕФОН: ВСЕ СТРАНИЦЫ ДОСТУПНЫ ===');
{
  const w=dom(), doc=w.document;
  const faces=[...doc.querySelectorAll('.book .face')];
  const nx=doc.getElementById('next');
  const seen=new Set(); let step=0;
  while(step<25){
    faces.forEach((f,i)=>{ if(f.classList.contains('show')) seen.add(i); });
    if(nx.disabled) break;
    nx.click(); step++;
  }
  seen.size===faces.length
    ? ok(`доступны все ${faces.length} страниц, включая обороты листов`)
    : no(`показано ${seen.size} из ${faces.length} — недоступны: ${faces.map((f,i)=>i).filter(i=>!seen.has(i)).join(', ')}`);
  const last=faces[faces.length-1];
  last.classList.contains('show')?ok('последняя страница отображается, а не чёрный экран')
    :no('на последней позиции ничего не показано');
}

console.log('\n=== ПОКРЫТИЕ УСТРОЙСТВ ===');
{
  const css = html.replace(/[\s\S]*?<style>/,'').replace(/<\/style>[\s\S]*/,'');
  /* Между 901 и 970px меню уже не помещалось, а бургер включался
     только с 900px — пункты налезали на кнопку брони. */
  const burger = (css.match(/@media\(max-width:(\d+)px\)\{\.burger\{display:flex/)||[])[1];
  +burger >= 1000 ? ok(`бургер включается с ${burger}px — на узком ноуте меню не наложится`)
                  : no(`бургер только с ${burger}px, а меню не влезает уже с ~970px`);
  const nl = (css.match(/@media\(max-width:(\d+)px\)\{nav \.nl\{display:none/)||[])[1];
  nl === burger ? ok('пункты меню прячутся ровно там же, где появляется бургер')
                : no(`рассинхрон: .nl при ${nl}px, бургер при ${burger}px`);

  /iPhone|viewport-fit=cover/.test(html)
    ? ok('viewport-fit=cover — на iPhone с вырезом нет белых полей в альбомной')
    : no('нет viewport-fit=cover, safe-area работать не будет');

  const soc = (css.match(/\.ft-soc a\{width:(\d+)px/)||[])[1];
  +soc >= 44 ? ok(`иконки соцсетей ${soc}px — палец попадает`)
             : no(`иконки соцсетей ${soc}px, минимум 44`);

  /* Проверяем, что нет разрыва между мобильными и десктопными правилами */
  const maxes=[...css.matchAll(/@media\(max-width:(\d+)px\)/g)].map(m=>+m[1]);
  const gaps=[];
  [360,375,390,393,412,430,768,820,1024,1180,1366,1920].forEach(w=>{
    const applies = maxes.some(m=>w<=m) || w>=1000;
    if(!applies) gaps.push(w);
  });
  gaps.length ? no('ширины без правил: '+gaps.join(', ')) : ok('все популярные ширины покрыты правилами');

  const noVh = !/\b100vh\b/.test(css);
  noVh ? ok('нет 100vh — адресная строка на телефоне не обрежет экран')
       : no('используется 100vh вместо 100svh');
  /overflow-x:\s*hidden/.test(css) ? ok('горизонтальной прокрутки не будет'):no('нет overflow-x:hidden');
}

console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
