const fs=require('fs'),DIR='../';
let pass=0,fail=0; const ok=m=>{console.log('  ✅ '+m);pass++}, no=m=>{console.log('  ❌ '+m);fail++};
const src=fs.readFileSync(DIR+'admin/admin.js','utf8');
const i=src.indexOf('function reviewsNeeded'), j=src.indexOf('function renderRatingCalc');
const F=new Function(src.slice(i,j)+';return {reviewsNeeded,roundingRange};')();
const {reviewsNeeded:rn, roundingRange:rr}=F;

console.log('\n=== МАТЕМАТИКА КАЛЬКУЛЯТОРА ===');
// проверка независимой формулой
const ref=(c,n,t,s)=>{const a=5*(s/100)+4*(1-s/100); return a<=t?null:Math.ceil(n*(t-c)/(a-t))};
[[4.6,4532,4.7,100],[4.6,4532,4.8,100],[4.6,4532,4.9,95],[4.4,37,4.8,85],[3.9,120,4.5,90]]
 .forEach(([c,n,t,s])=>{
  const got=rn(c,n,t,s), want=ref(c,n,t,s);
  (got.need===want)?ok(`${c}·${n}, цель ${t}, ${s}% пятёрок → ${want}`)
                   :no(`${c}·${n}→${t}: калькулятор ${JSON.stringify(got)}, формула ${want}`);
});
// проверка обратным пересчётом: применили need — получили цель?
[[4.6,4532,4.7,100],[4.4,37,4.8,85],[4.0,200,4.5,90]].forEach(([c,n,t,s])=>{
  const x=rn(c,n,t,s).need, a=5*(s/100)+4*(1-s/100);
  const res=(c*n+a*x)/(n+x);
  res>=t-1e-9?ok(`обратная проверка: +${x} даёт ${res.toFixed(3)} ≥ ${t}`)
             :no(`+${x} даёт только ${res.toFixed(3)}, а нужно ${t}`);
});

console.log('\n=== ГРАНИЧНЫЕ СЛУЧАИ ===');
rn(4.6,4532,5,100).unreachable5?ok('цель 5.0 помечена как арифметически недостижимая'):no('цель 5.0: '+JSON.stringify(rn(4.6,4532,5,100)));
rn(4.6,4532,4.5,100).done?ok('цель ниже текущей → «уже достигнуто»'):no('цель ниже текущей не распознана');
rn(0,0,4.8,90).fresh?ok('нет отзывов → отдельный сценарий'):no('пустая карточка не распознана');
rn(4.6,4532,4.9,70).impossible?ok('70% пятёрок при цели 4.9 → недостижимо (средняя новых 4.70)'):no('не поймано недостижимое');
rn(-5,-10,9,999).need!==undefined||rn(-5,-10,9,999).unreachable5?ok('мусор на входе не роняет функцию'):no('мусор сломал расчёт');
[['текст','abc'],['пусто','']].forEach(([n2,v])=>{
  const r=rn(v,v,4.8,90);
  // null — тоже корректный ответ: интерфейс на него показывает «заполните поля числами»
  (r===null||r.fresh||r.need!==undefined)?ok(n2+' на входе обработан без падения'):no(n2+': '+JSON.stringify(r));
});

console.log('\n=== УЧЁТ ОКРУГЛЕНИЯ ===');
const R=rr(4.6,4532,4.7,100);
(R.best<R.mid&&R.mid<R.worst)?ok(`диапазон растёт корректно: ${R.best} < ${R.mid} < ${R.worst}`):no('диапазон: '+JSON.stringify(R));
R.best===13?ok('верхняя граница (факт 4.649) → 13 отзывов'):no('best='+R.best);
R.worst===1295?ok('нижняя граница (факт 4.55) → 1295 отзывов'):no('worst='+R.worst);
// при 70% пятёрок средняя новых = 4.70, порог показа «4,7» = 4.65 → цель достижима
const R70=rr(4.6,4532,4.7,70);
(R70&&R70.worst>R.worst)?ok(`при 70% пятёрок цель 4.7 достижима, но дороже: ${R70.worst} против ${R.worst}`)
  :no('70%: '+JSON.stringify(R70));
// а вот цель 4.9 при 70% недостижима — средняя новых ниже порога
rr(4.6,4532,4.9,70)===null?ok('цель 4.9 при 70% пятёрок помечена недостижимой'):no('4.9/70% должно быть null');

console.log('\n=== СВЕРКА С РЕАЛЬНЫМИ ДАННЫМИ 2ГИС ===');
const html=fs.readFileSync(DIR+'admin/index.html','utf8');
/id="rp-cur"[^>]*value="4\.6"/.test(html)?ok('в форме подставлен реальный рейтинг 4.6'):no('рейтинг в форме не 4.6');
/id="rp-n"[^>]*value="4532"/.test(html)?ok('подставлено реальное число оценок 4532'):no('число оценок не 4532');
/id="rp-target"[^>]*value="4\.7"/.test(html)?ok('цель по умолчанию 4.7 — достижимая'):no('цель по умолчанию не 4.7');

console.log('\n══════ ИТОГ: '+pass+' прошло, '+fail+' упало ══════\n');
