const fs=require("fs"),{JSDOM}=require("jsdom");
const file=process.argv[2], label=process.argv[3];
const html=fs.readFileSync(file,"utf8");
const d=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true,url:"https://gaukhartas.com/x/"});
const w=d.window;
Object.defineProperty(w,"localStorage",{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});
w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
w.tailwind={config:{}};
let t=0; w.requestAnimationFrame=cb=>{if(t++<3)setTimeout(()=>cb(1),0);return t};
w.cancelAnimationFrame=()=>{}; w.scrollTo=()=>{};
w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){this.cb([{isIntersecting:true}])}disconnect(){}};
w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
  fillRect(){},drawImage(){},createRadialGradient:()=>({addColorStop(){}}),globalAlpha:1,fillStyle:""});
w.fetch=()=>Promise.reject(new Error("no"));
w.Image=class{set src(v){setTimeout(()=>this.onload&&this.onload(),0)}};
[...w.document.querySelectorAll("script")].forEach(s=>{
  const src=s.getAttribute("src");
  if(src){ if(/^(content|engine)\.js/.test(src)&&fs.existsSync(src)) {try{w.eval(fs.readFileSync(src,"utf8"))}catch(e){}} return; }
  try{w.eval(s.textContent)}catch(e){}
});
setTimeout(()=>{
  const doc=w.document;
  const sel=doc.querySelector(".pane")?".pane":".pano-pane";
  const panes=[...doc.querySelectorAll(sel)];
  const cyl=doc.getElementById("cylinder")||doc.getElementById("panoCyl");
  const prev=doc.getElementById("panPrev")||doc.getElementById("panoPrev");
  const next=doc.getElementById("panNext")||doc.getElementById("panoNext");
  if(!panes.length||!cyl){console.log(`  ⚠ ${label}: панорама не собралась`);return;}
  const act=()=>panes.findIndex(p=>p.classList.contains("focus")||p.classList.contains("on"));
  const rot=()=>{const m=cyl.style.transform.match(/rotateY\(([-\d.]+)deg\)/);return m?+m[1]:0};
  let prevRot=rot(), maxJump=0, seq=[act()];
  const STEP=360/panes.length;
  const click=el=>{el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
    const j=Math.abs(rot()-prevRot); if(j>maxJump)maxJump=j; prevRot=rot(); seq.push(act());};
  for(let i=0;i<3;i++) click(next);
  for(let i=0;i<6;i++) click(prev);   // проходим через ноль
  for(let i=0;i<3;i++) click(next);
  const ok = maxJump <= STEP*1.6;
  console.log(`  ${ok?"✅":"❌"} ${label}: ${panes.length} граней, шаг ${STEP.toFixed(1)}°, ` +
              `максимальный скачок ${maxJump.toFixed(1)}°`);
  console.log(`     путь: ${seq.join(" → ")}`);
},400);
