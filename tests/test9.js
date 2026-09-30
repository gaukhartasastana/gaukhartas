/* Блок отзывов и плавающая кнопка WhatsApp */
const fs=require('fs'),{JSDOM}=require('jsdom'),path=require('path');
const DIR=path.join(__dirname,'..')+'/';
let pass=0,fail=0;const ok=m=>{console.log('  ✅ '+m);pass++},no=m=>{console.log('  ❌ '+m);fail++};
const html=fs.readFileSync(DIR+'index.html','utf8');

function boot(patchContent){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/'});
  const w=dom.window,st={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=v},removeItem:()=>{}},configurable:true});
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  const obs=[];
  w.IntersectionObserver=class{constructor(cb){this.cb=cb;obs.push(this)}observe(n){this.node=n}disconnect(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:''});
  w.fetch=()=>Promise.reject(new Error('no'));
  /* Выполняем скрипты В ТОМ ЖЕ ПОРЯДКЕ, что и браузер: внешние подтягиваем
     с диска на их месте в документе. Иначе инлайн-инициализация отработает
     раньше движка и тест не заметит отсутствующий вызов. */
  [...w.document.querySelectorAll('script')].forEach(t=>{
    const src=t.getAttribute('src');
    if(src){
      if(/^(content|engine)\.js/.test(src)){
        let code=fs.readFileSync(DIR+src.split('?')[0],'utf8');
        if(src.indexOf('content')===0 && patchContent) code=patchContent(code);
        try{ w.eval(code); }catch(e){}
      }
      return;                       /* lang.js и внешние CDN пропускаем */
    }
    try{ w.eval(t.textContent); }catch(e){}
  });
  return {w,d:w.document,obs};
}

console.log('\n=== БЛОК ОТЗЫВОВ ===');
{
  const {d}=boot();
  const sec=d.getElementById('reviews');
  sec.style.display!=='none'?ok('секция показана'):no('секция скрыта');
  const sum=d.getElementById('reviews-sum');
  const t=sum.textContent.replace(/\u00a0/g,' ');
  /4,9/.test(t)?ok('рейтинг 4,9 крупно'):no('рейтинг: '+t.slice(0,30));
  /4 532/.test(t)?ok('4 532 оценки'):no('оценок нет: '+t.slice(0,60));
  /2 110/.test(t)?ok('2 110 отзывов'):no('отзывов нет');
  /196/.test(t)?ok('196 фото гостей'):no('фото нет');
  const stars=[...sum.querySelectorAll('.rv-stars i')];
  stars.length===5?ok('5 звёзд'):no('звёзд: '+stars.length);
  const on=stars.filter(s=>s.classList.contains('on')).length;
  const hf=stars.filter(s=>s.classList.contains('hf')).length;
  (on===4&&hf===1||on===5)?ok('4,9 → четыре с половиной или 5 звёзд'):no(`полных ${on}, половинных ${hf}`);
  const a=sum.querySelector('.rv-score');
  /2gis\.kz/.test(a.href)?ok('цифра ведёт на 2ГИС — можно проверить'):no('ссылка: '+a.href);
  a.target==='_blank'&&/noopener/.test(a.rel)?ok('открывается в новой вкладке безопасно'):no('нет noopener');
  /Больше оценок/.test(t)?ok('строка про преимущество: «'+(t.match(/Больше оценок[^.]*/)||[''])[0]+'»'):no('нет строки');
}

console.log('\n=== ЧЕСТНОСТЬ ДАННЫХ ===');
{
  const c=fs.readFileSync(DIR+'content.js','utf8');
  /rating:\s*4\.9/.test(c)?ok('рейтинг совпадает с реальным 2ГИС (4.9)'):no('рейтинг в данных другой');
  /ratingsCount:\s*4532/.test(c)?ok('4532 оценки — как в карточке'):no('число оценок не совпадает');
  const grid=boot().d.getElementById('reviews-grid');
  grid.children.length===0?ok('выдуманных отзывов нет — только проверяемые цифры')
    :no('в сетке '+grid.children.length+' отзывов, откуда?');
  /Проверено 29\.07\.2026/.test(c)?ok('в данных проставлена дата проверки'):no('нет даты проверки');
}

console.log('\n=== БЛОК ПРЯЧЕТСЯ, ЕСЛИ ДАННЫХ НЕТ ===');
{
  const {d}=boot(c=>c.replace('rating: 4.9','rating: 0').replace('ratingsCount: 4532','ratingsCount: 0'));
  d.getElementById('reviews').style.display==='none'
    ?ok('без цифр и отзывов секция скрывается — пустого блока не будет'):no('показан пустой блок');
}
{
  const {d}=boot(c=>c.replace('show: true','show: false'));
  d.getElementById('reviews').style.display==='none'?ok('выключается флагом show:false'):no('флаг не работает');
}

console.log('\n=== ПЛАВАЮЩАЯ КНОПКА ===');
{
  const {w,d,obs}=boot();
  const fab=d.getElementById('waFab');
  fab?ok('кнопка есть в разметке'):no('кнопки нет');
  fab.classList.contains('on')?no('видна сразу — перекрывает первый экран'):ok('на первом экране скрыта');
  /wa\.me/.test(fab.href)?ok('ведёт в WhatsApp'):no('ссылка: '+fab.href);
  fab.getAttribute('data-gh-href')==='wa'?ok('подхватывает метку канала из движка'):no('нет data-gh-href');
  fab.getAttribute('aria-label')?ok('подписана для скринридера'):no('нет aria-label');
  fab.querySelector('svg')?ok('иконка на месте'):no('нет иконки');
  fab.querySelector('.lbl')?ok('есть подпись, раскрывается при наведении'):no('нет подписи');

  // ушли с первого экрана
  obs.forEach(o=>{ if(o.node&&(o.node.classList.contains('hero')||o.node.tagName==='HEADER')) o.cb([{isIntersecting:false}]); });
  fab.classList.contains('on')?ok('после первого экрана появляется'):no('не появилась');
  // доскроллили до контактов
  obs.forEach(o=>{ if(o.node&&o.node.id==='contacts') o.cb([{isIntersecting:true}]); });
  fab.classList.contains('on')?no('дублирует кнопку в контактах'):ok('у контактов прячется — не дублирует');
  obs.forEach(o=>{ if(o.node&&o.node.id==='contacts') o.cb([{isIntersecting:false}]); });
  fab.classList.contains('on')?ok('отпустили контакты — вернулась'):no('не вернулась');
}

console.log('\n=== МЕЛОЧИ, КОТОРЫЕ ЛОМАЮТ ===');
{
  [['не под полосой жестов iPhone',/\.wa-fab\{[^}]*env\(safe-area-inset-bottom/],
   ['высота 54px+ — палец попадает',/\.wa-fab\{[^}]*height:58px/],
   ['уважает reduced-motion',/prefers-reduced-motion:reduce\)\{[\s\S]{0,200}\.wa-fab/],
   ['числа не разъезжаются на узком',/max-width:560px\)\{[\s\S]*?\.rv-nums\{max-width:100%/],
   ['подсказка сама сворачивается',/removeClass|classList\.remove\('hint'\)/]
  ].forEach(([n,re])=>re.test(html)?ok(n):no(n+' — нет'));
}

console.log('\n=== СТРАНИЦА САМА ВЫЗЫВАЕТ РЕНДЕР ===');
{
  /* Прошлый тест звал GH.renderReviews() вручную и поэтому пропустил,
     что в index.html вызова не было: секция висела пустая. */
  /GH\.renderReviews\(\)/.test(html)
    ? ok('index.html вызывает GH.renderReviews()')
    : no('вызова нет — блок отзывов останется пустым на живом сайте');
  const {d}=boot();
  const sum=d.getElementById('reviews-sum').textContent.replace(/\u00a0/g,' ');
  /4,6/.test(sum) ? ok('цифры отрисовались без ручного вызова: '+sum.slice(0,26)+'…')
                  : no('после загрузки страницы блок пустой');
}

console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
