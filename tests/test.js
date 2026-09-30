const fs = require('fs');
const { JSDOM } = require('jsdom');
const DIR = '../';

const html = fs.readFileSync(DIR + 'index.html', 'utf8');
const contentSrc = fs.readFileSync(DIR + 'content.js', 'utf8');
const engineSrc = fs.readFileSync(DIR + 'engine.js', 'utf8');

let pass = 0, fail = 0;
function run(name, mutate) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gaukhartas.com/' });
  const w = dom.window;
  // localStorage shim
  const store = {};
  Object.defineProperty(w, 'localStorage', { value: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  }, configurable: true });
  w.IntersectionObserver = class { constructor(){} observe(){} disconnect(){} };
  w.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
  w.cancelAnimationFrame = id => clearTimeout(id);
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = function(){};

  try {
    w.eval(contentSrc);
    if (mutate) mutate(w, store);
    w.eval(engineSrc);
    w.GH.boot({ theme: 'test' });
    console.log('  ✅ ' + name);
    pass++;
    return { w, ok: true };
  } catch (e) {
    console.log('  ❌ ' + name + '\n       ' + e.constructor.name + ': ' + e.message);
    fail++;
    return { w, ok: false, err: e };
  }
}

console.log('\n=== БАЗОВЫЙ ЗАПУСК ===');
const base = run('boot() на дефолтных данных');

console.log('\n=== ПУСТЫЕ / БИТЫЕ ДАННЫЕ (то, что может прийти из админки) ===');
run('D.menus = []', w => { w.GH_DEFAULT.menus = []; });
run('D.halls = []', w => { w.GH_DEFAULT.halls = []; });
run('D.halls = [один зал]', w => { w.GH_DEFAULT.halls = [w.GH_DEFAULT.halls[0]]; });
run('D.gallery = []', w => { w.GH_DEFAULT.gallery = []; });
run('D.faq = []', w => { w.GH_DEFAULT.faq = []; });
run('D.formats = []', w => { w.GH_DEFAULT.formats = []; });
run('D.trust = []', w => { w.GH_DEFAULT.trust = []; });
run('D.timeline = []', w => { w.GH_DEFAULT.timeline = []; });
run('D.included = []', w => { w.GH_DEFAULT.included = []; });
run('нет settings', w => { delete w.GH_DEFAULT.settings; });
run('нет contacts', w => { delete w.GH_DEFAULT.contacts; });
run('нет brand', w => { delete w.GH_DEFAULT.brand; });
run('меню без gifts', w => { w.GH_DEFAULT.menus.forEach(m => delete m.gifts); });
run('зал без specs', w => { w.GH_DEFAULT.halls.forEach(h => delete h.specs); });
run('localStorage: битый JSON', (w, s) => { s['gh_content'] = '{ломаный json'; });
run('localStorage: null', (w, s) => { s['gh_content'] = 'null'; });
run('localStorage: массив вместо объекта', (w, s) => { s['gh_content'] = '[1,2,3]'; });
run('localStorage: menus=null из админки', (w, s) => { s['gh_content'] = JSON.stringify({ menus: null }); });
run('localStorage: halls=[] из админки', (w, s) => { s['gh_content'] = JSON.stringify({ halls: [] }); });
run('localStorage: строка', (w, s) => { s['gh_content'] = '"привет"'; });
run('битая статистика', (w, s) => { s['gh_stats'] = 'not json'; });
run('битые лиды', (w, s) => { s['gh_leads'] = '{}'; });

console.log('\n=== localStorage ОТКЛЮЧЁН (Safari приватный режим) ===');
{
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gaukhartas.com/' });
  const w = dom.window;
  Object.defineProperty(w, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true });
  w.IntersectionObserver = class { constructor(){} observe(){} };
  w.requestAnimationFrame = cb => setTimeout(() => cb(0), 0);
  w.cancelAnimationFrame = () => {};
  w.Element.prototype.scrollIntoView = function(){};
  try {
    w.eval(contentSrc); w.eval(engineSrc); w.GH.boot({});
    console.log('  ✅ boot() при заблокированном localStorage'); pass++;
  } catch (e) {
    console.log('  ❌ boot() при заблокированном localStorage\n       ' + e.constructor.name + ': ' + e.message); fail++;
  }
}

console.log('\n=== КАЛЬКУЛЯТОР: ввод пользователя (синтетический DOM с data-block) ===');
{
  const page = `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <section id="calc"><div data-block="calc"></div></section>
    <section id="book"><div data-block="form"></div></section>
  </body></html>`;
  const dom = new JSDOM(page, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gaukhartas.com/' });
  const w = dom.window; const store = {};
  Object.defineProperty(w, 'localStorage', { value: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, configurable: true });
  w.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} };
  w.requestAnimationFrame = cb => { cb(1e9); return 1; };
  w.cancelAnimationFrame = () => {};
  w.matchMedia = () => ({ matches: true, addListener(){}, removeListener(){} }); // reduced-motion: мгновенный итог
  w.Element.prototype.scrollIntoView = function(){};
  w.eval(contentSrc); w.eval(engineSrc); w.GH.boot({ theme: 'calc-test' });
  const d = w.document, GH = w.GH;

  function calcWith(val, hallId) {
    const g = d.querySelector('#c-guests'), n = d.querySelector('#c-guests-n');
    if (!g) return 'нет калькулятора';
    if (hallId) d.querySelector('#c-hall').value = hallId;
    n.value = val; GH.calcState.lastInput = 'num';
    try { GH.calc(); } catch (e) { return '❌ ОШИБКА: ' + e.message; }
    const t = d.querySelector('#c-total').textContent;
    const bad = /NaN|Infinity|undefined/.test(t) ? '  ❌ БИТО!' : '';
    return `гостей=${GH.calcState.guests}  итого=${t}${bad}`;
  }
  const cases = [['(пусто)',''],['abc','abc'],['-50','-50'],['0','0'],['5','5'],['1e5','1e5'],
                 ['5.7','5.7'],['99999','99999'],['  200  ','  200  '],['1 000','1 000'],
                 ['<script>','<script>'],['NaN','NaN'],['999999999999','999999999999']];
  cases.forEach(([label, val]) => console.log(`  "${label}"`.padEnd(20) + '→ ' + calcWith(val)));
  console.log('  --- границы залов ---');
  console.log('  350 гостей в малом (max 160) → ' + calcWith('350','small'));
  console.log('  350 гостей в большом (max 350) → ' + calcWith('350','big'));
  console.log('  5 гостей в большом (min 150) → ' + calcWith('5','big'));

  console.log('\n=== ФОРМА ЗАЯВКИ ===');
  const f = d.querySelector('#gh-form');
  if (!f) { console.log('  ❌ форма не отрисовалась'); fail++; }
  else {
    let opened = null; w.open = (u) => { opened = u; return { focus(){} }; };
    d.querySelector('#f-name').value = 'Айгуль';
    d.querySelector('#f-phone').value = '+7 (701) 555-11-22';
    d.querySelector('#f-guests').value = '9999';
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    console.log('  9999 гостей → ' + d.querySelector('#gh-fmsg').textContent.slice(0, 70));
    d.querySelector('#f-guests').value = '200';
    d.querySelector('#f-date').value = '2020-01-01';
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    console.log('  дата в прошлом → ' + d.querySelector('#gh-fmsg').textContent.slice(0, 70));
    d.querySelector('#f-date').value = '';
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    const leads = GH.leads();
    const ok = leads.length === 1 && !/NaN/.test(String(leads[0].total));
    console.log('  корректная заявка → ' + (ok ? '✅ лид записан, смета ' + GH.money(leads[0].total) : '❌ ' + JSON.stringify(leads)));
    ok ? pass++ : fail++;
    console.log('  двойной клик по «Отправить» → кнопка disabled: ' + f.querySelector('button[type=submit]').disabled);
  }
}

console.log('\n=== ИТОГ: ' + pass + ' прошло, ' + fail + ' упало ===\n');
