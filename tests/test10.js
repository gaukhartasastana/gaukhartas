/* Блок видео: фасад вместо тяжёлого плеера */
const fs=require('fs'),{JSDOM}=require('jsdom'),path=require('path');
const DIR=path.join(__dirname,'..')+'/';
let pass=0,fail=0;const ok=m=>{console.log('  ✅ '+m);pass++},no=m=>{console.log('  ❌ '+m);fail++};
const html=fs.readFileSync(DIR+'index.html','utf8');

function boot(patch){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://gaukhartas.com/'});
  const w=dom.window,st={};
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){}disconnect(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:''});
  w.fetch=()=>Promise.reject(new Error('no'));
  const conv=[];
  [...w.document.querySelectorAll('script')].forEach(t=>{
    const src=t.getAttribute('src');
    if(src){
      if(/^(content|engine)\.js/.test(src)){
        let code=fs.readFileSync(DIR+src.split('?')[0],'utf8');
        if(src.indexOf('content')===0&&patch) code=patch(code);
        try{w.eval(code)}catch(e){}
      }
      return;
    }
    try{w.eval(t.textContent)}catch(e){}
  });
  /* Подменяем ПОСЛЕ загрузки страницы: свой обработчик она определяет сама,
     и ранняя подмена просто затиралась. */
  const orig=w.ghConv;
  w.ghConv=function(n,x){ conv.push({n,x}); if(typeof orig==='function') try{orig(n,x)}catch(e){} };
  return {w,d:w.document,conv};
}

console.log('\n=== БЕЗ ССЫЛКИ БЛОК НЕ ПОКАЗЫВАЕТСЯ ===');
{
  const {d}=boot(c=>c.replace(/id: "[^"]*",\n    title: "Как это проходит"/,'id: "",\n    title: "Как это проходит"'));
  d.getElementById('video').style.display==='none'
    ?ok('ID пустой → секции нет, пустого плеера не будет'):no('показан блок без видео');
}

console.log('\n=== ВЕРТИКАЛЬНОЕ ВИДЕО (SHORTS) ===');
{
  const {d}=boot();
  const sec=d.getElementById('video');
  sec.classList.contains('vd-vertical')
    ?ok('ссылка на Shorts → вертикальная раскладка, без чёрных полос')
    :no('Shorts показывается в рамке 16:9');
  /\.vd-vertical \.vd-box\{aspect-ratio:9\/16/.test(html)?ok('пропорции 9:16'):no('нет 9:16');
  /min-width:820px\)\{[\s\S]*?\.vd-vertical \.vd-inner\{display:grid/.test(html)
    ?ok('на десктопе текст встаёт рядом, а не под узким столбиком'):no('нет двухколоночной раскладки');
  const {d:d2}=boot(c=>c.replace(/id: "[^"]*",\n    title/,'id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",\n    title'));
  d2.getElementById('video').classList.contains('vd-vertical')
    ?no('обычное видео посчитало вертикальным'):ok('обычная ссылка → горизонтальная рамка');
  const {d:d3}=boot(c=>c.replace('vertical: null,','vertical: false,'));
  d3.getElementById('video').classList.contains('vd-vertical')
    ?no('ручное vertical:false не сработало'):ok('ориентацию можно задать вручную');
}

console.log('\n=== С ССЫЛКОЙ ===');
{
  const {w,d,conv}=boot(c=>c.replace(/id: "[^"]*",\n    title/,'id: "dQw4w9WgXcQ",\n    title'));
  const sec=d.getElementById('video');
  sec.style.display!=='none'?ok('секция появилась'):no('секция скрыта');

  const box=d.getElementById('video-box');
  box.querySelector('iframe')?no('iframe создан сразу — страница тянет мегабайт зря')
    :ok('до нажатия iframe нет — YouTube не грузится');
  const poster=box.querySelector('.vd-poster');
  poster?ok('показана обложка: '+poster.getAttribute('src')):no('обложки нет');
  poster.getAttribute('loading')==='lazy'?ok('обложка грузится лениво'):no('нет lazy');
  poster.getAttribute('width')&&poster.getAttribute('height')?ok('размеры заданы — вёрстка не прыгает'):no('нет размеров');
  const btn=box.querySelector('.vd-play');
  btn?ok('кнопка воспроизведения на месте'):no('кнопки нет');
  btn.getAttribute('aria-label')?ok('кнопка подписана для скринридера'):no('нет aria-label');
  btn.type==='button'?ok('type="button" — не сабмитит форму'):no('нет type');

  // нажимаем
  btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const f=box.querySelector('iframe');
  f?ok('после нажатия появился плеер'):no('плеер не появился');
  /youtube-nocookie\.com/.test(f.src)?ok('домен nocookie — без рекламных кук'):no('src: '+f.src);
  /dQw4w9WgXcQ/.test(f.src)?ok('подставлен нужный ролик'):no('не тот ID');
  /autoplay=1/.test(f.src)?ok('запускается сразу после нажатия'):no('нет autoplay');
  /playsinline=1/.test(f.src)?ok('на iPhone играет в блоке, не на весь экран'):no('нет playsinline');
  /rel=0/.test(f.src)?ok('не покажет ролики конкурентов в конце'):no('нет rel=0');
  f.hasAttribute('allowfullscreen')?ok('можно развернуть на весь экран'):no('нет fullscreen');
  box.querySelector('.vd-poster')?no('обложка осталась под плеером'):ok('обложка убрана');
  conv.some(c=>c.n==='video_play')?ok('просмотр считается как событие'):no('событие не отправлено');
}

console.log('\n=== ПРИНИМАЕТ РАЗНЫЕ ФОРМАТЫ ССЫЛКИ ===');
{
  [['голый ID','dQw4w9WgXcQ'],
   ['полная ссылка','https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
   ['короткая youtu.be','https://youtu.be/dQw4w9WgXcQ'],
   ['ссылка со временем','https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'],
   ['shorts','https://www.youtube.com/shorts/dQw4w9WgXcQ']
  ].forEach(([n,val])=>{
    const {w,d}=boot(c=>c.replace(/id: "[^"]*",\n    title/,'id: "'+val+'",\n    title'));
    const vis=d.getElementById('video').style.display!=='none';
    if(!vis) return no(n+' → блок не показался');
    d.querySelector('.vd-play').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    const src=d.querySelector('#video-box iframe').src;
    /embed\/dQw4w9WgXcQ\?/.test(src)?ok(n+' → распознано'):no(n+' → '+src.slice(0,60));
  });
}

console.log('\n=== МУСОР НА ВХОДЕ ===');
{
  [['случайный текст','какое-то видео'],['чужой домен','https://vimeo.com/12345'],
   ['короткий ID','abc'],['скрипт','<script>alert(1)</script>']
  ].forEach(([n,val])=>{
    const {d}=boot(c=>c.replace(/id: "[^"]*",\n    title/,'id: '+JSON.stringify(val)+',\n    title'));
    d.getElementById('video').style.display==='none'
      ?ok(n+' → блок скрыт, ничего не сломалось'):no(n+' → показан блок');
  });
}

console.log('\n=== ТЕКСТЫ ИЗ ДАННЫХ ===');
{
  const {d}=boot(c=>c.replace(/id: "[^"]*",\n    title/,'id: "dQw4w9WgXcQ",\n    title')
                     .replace('caption: ""','caption: "Ұзату той на 180 гостей, июль 2026"'));
  /Ұзату той на 180/.test(d.getElementById('video-cap').textContent)
    ?ok('подпись под видео подставляется'):no('подписи нет');
  const {d:d2}=boot(c=>c.replace(/id: "[^"]*",\n    title/,'id: "dQw4w9WgXcQ",\n    title'));
  d2.getElementById('video-cap').style.display==='none'
    ?ok('пустая подпись не оставляет дыру'):no('пустой абзац висит');
}
console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
