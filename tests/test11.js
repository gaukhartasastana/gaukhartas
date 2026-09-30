const fs=require("fs"),{JSDOM}=require("jsdom");
const path=require("path");
const DIR=path.join(__dirname,"..")+"/";
const html=fs.readFileSync(DIR+"big/index.html","utf8");
let pass=0,fail=0;const ok=m=>{console.log("  ✅ "+m);pass++},no=m=>{console.log("  ❌ "+m);fail++};

function boot(url){
  const d=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true,url:url||"https://gaukhartas.com/big/"});
  const w=d.window,st={};
  Object.defineProperty(w,"localStorage",{value:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=v},removeItem:()=>{}},configurable:true});
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.tailwind={config:{}};
  let t=0;w.requestAnimationFrame=cb=>{if(t++<2)setTimeout(()=>cb(1),0);return t};
  w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){}disconnect(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:""});
  w.Image=class{set src(v){setTimeout(()=>this.onload&&this.onload(),0)}};
  [...w.document.querySelectorAll("script")].forEach(s=>{
    if(s.getAttribute("src")||s.type==="application/ld+json") return;
    try{w.eval(s.textContent)}catch(e){console.log("     ошибка:",e.message.slice(0,70))}
  });
  return {w,d:w.document,st};
}

console.log("\n=== ПЕРЕКЛЮЧАТЕЛЬ ===");
{
  const {w,d,st}=boot();
  const lng=d.getElementById("lng");
  lng?ok("тумблер РУ/ҚЗ в шапке"):no("тумблера нет");
  const btns=[...d.querySelectorAll("#lng button")];
  btns.length===2?ok("две кнопки"):no("кнопок: "+btns.length);
  btns[0].classList.contains("on")?ok("по умолчанию русский"):no("русский не активен");
  const marked=d.querySelectorAll("[data-i18n]").length;
  marked>=45?ok(`размечено ${marked} элементов`):no(`размечено только ${marked}`);

  const before=d.body.textContent;
  btns[1].dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const after=d.body.textContent;
  after!==before?ok("текст меняется при нажатии ҚЗ"):no("текст не изменился");
  d.documentElement.lang==="kk"?ok('атрибут lang="kk"'):no("lang: "+d.documentElement.lang);
  btns[1].classList.contains("on")&&!btns[0].classList.contains("on")
    ?ok("подсветка переехала на ҚЗ"):no("подсветка не переключилась");

  console.log("\n=== ЧТО ВИДНО НА КАЗАХСКОМ ===");
  [["hero.title","Үлкен зал"],["cta","Күнді брондау"],["pan.title","Айналаңызға қараңыз"],
   ["s3.meta","Дастархан"],["sp.title","Үлкен зал сандармен"]].forEach(([k,exp])=>{
    const n=d.querySelector(`[data-i18n="${k}"]`);
    const got=n?n.textContent.trim():"(нет)";
    got===exp?ok(`${k} → «${got}»`):no(`${k} → «${got}», ждали «${exp}»`);
  });

  /* Ищем слова, которых в казахском быть не может. Буква «ы» есть
     в обоих языках, по ней проверять нельзя. */
  const RUS = /Забронировать|Осмотритесь|Приезжайте|Хрустальные|Сервировка|Официанты|Президиум|листайте страницу|Покажем зал|держит триста/;
  const hit = [...d.querySelectorAll("[data-i18n]")].filter(n => RUS.test(n.textContent));
  hit.length ? no("русский остался в: " + hit.map(n => n.getAttribute("data-i18n")).join(", "))
             : ok("русских слов не осталось");

  console.log("\n=== ВОЗВРАТ НА РУССКИЙ ===");
  btns[0].dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  d.body.textContent.trim()===before.trim()?ok("текст вернулся полностью, ничего не потерялось")
    :no("после возврата текст отличается");
  st.gh_lang==="ru"?ok("выбор запомнился"):no("не запомнился: "+st.gh_lang);
}

console.log("\n=== ССЫЛКА ?lang=kz ===");
{
  const {d}=boot("https://gaukhartas.com/big/?lang=kz");
  /Үлкен зал/.test(d.body.textContent)?ok("открывается сразу на казахском"):no("остался русский");
  d.querySelectorAll("#lng button")[1].classList.contains("on")?ok("ҚЗ подсвечен"):no("подсветка не та");
}

console.log("\n=== ПАМЯТЬ МЕЖДУ ЗАХОДАМИ ===");
{
  const {w,d,st}=boot();
  d.querySelectorAll("#lng button")[1].dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  st.gh_lang==="kz"?ok("казахский сохранён"):no("не сохранился");
}
console.log("\n══════ "+pass+" прошло, "+fail+" упало ══════\n");
