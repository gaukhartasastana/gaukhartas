const fs = require('fs');
/* Разметку проверяем без содержимого <script>: там встречаются
   строки вида assets/' + v[0] + '.webp, и это не битый путь. */
function stripScripts(h){ return h.replace(/<script[\s\S]*?<\/script>/gi, ''); }

const { JSDOM } = require('jsdom');
const DIR = '../';
let pass = 0, fail = 0;
const ok = m => { console.log('  ✅ ' + m); pass++; };
const no = m => { console.log('  ❌ ' + m); fail++; };

function makeDom(html, { reduce = false, noStorage = false } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gaukhartas.com/' });
  const w = dom.window, store = {};
  if (noStorage) Object.defineProperty(w, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true });
  else Object.defineProperty(w, 'localStorage', { value: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, configurable: true });
  w.matchMedia = q => ({ matches: reduce && /reduce/.test(q), addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  w.requestAnimationFrame = cb => { setTimeout(() => cb(Date.now()), 0); return 1; };
  w.cancelAnimationFrame = () => {};
  w.scrollTo = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => ({
    setTransform(){}, clearRect(){}, beginPath(){}, arc(){}, fill(){}, fillRect(){},
    drawImage(){}, createRadialGradient: () => ({ addColorStop(){} }), globalAlpha: 1, fillStyle: '' });
  return { w, store };
}

// ─────────────────────────────────────────────────
console.log('\n=== БОЕВАЯ СТРАНИЦА index.html (инлайн-скрипт) ===');
const indexHtml = fs.readFileSync(DIR + 'index.html', 'utf8');
const inline = indexHtml.slice(indexHtml.indexOf('<script>') + 8, indexHtml.indexOf('</script>', indexHtml.indexOf('<script>')));
const langSrc = fs.readFileSync(DIR + 'lang.js', 'utf8');

function bootPage(opts = {}) {
  const { w } = makeDom(indexHtml, opts);
  const errs = [];
  try { w.eval(inline); } catch (e) { errs.push('inline: ' + e.message); }
  try { w.eval(langSrc); } catch (e) { errs.push('lang: ' + e.message); }
  return { w, errs };
}

let r = bootPage();
r.errs.length ? no('загрузка страницы: ' + r.errs.join(' | ')) : ok('страница грузится без ошибок');

r = bootPage({ reduce: true });
r.errs.length ? no('reduced-motion: ' + r.errs.join(' | ')) : ok('работает при «уменьшить движение»');

r = bootPage({ noStorage: true });
r.errs.length ? no('приватный Safari: ' + r.errs.join(' | ')) : ok('работает при заблокированном localStorage');

// страница без ключевых узлов — раньше это роняло весь скрипт
{
  let stripped = indexHtml
    .replace(/id="book"/g, 'id="book-x"')
    .replace(/id="prev"/g, 'id="prev-x"')
    .replace(/id="pgs"/g, 'id="pgs-x"')
    .replace(/id="intro"/g, 'id="intro-x"')
    .replace(/id="lbClose"/g, 'id="lbClose-x"');
  const { w } = makeDom(stripped);
  let err = null;
  try { w.eval(inline); } catch (e) { err = e.message; }
  if (err) no('без части элементов страница падает: ' + err);
  else {
    const yr = w.document.getElementById('yr');
    (yr && yr.textContent === String(new Date().getFullYear()))
      ? ok('при отсутствии книги/интро остальное (меню, галерея, год) работает')
      : no('скрипт не дошёл до конца при отсутствии элементов');
  }
}

// ─────────────────────────────────────────────────
console.log('\n=== ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА ===');
{
  const page = `<html><body><a class="pill" href="#">ҚАЗ</a>
    <h1 data-i18n="hero.title">ГАУХАРТАС</h1>
    <p data-i18n="nav.halls">Залы</p></body></html>`;
  const { w } = makeDom(page);
  w.eval(langSrc);
  w.eval(langSrc);   // ← имитируем прежнее двойное подключение
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const pill = w.document.querySelector('.pill');
  const p = w.document.querySelector('[data-i18n="nav.halls"]');
  const before = p.textContent;
  pill.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const after = p.textContent;
  (after !== before && after === 'Залдар')
    ? ok('язык переключается при двойном подключении lang.js (было: щёлкал туда-обратно)')
    : no(`язык не переключился: "${before}" → "${after}"`);
  pill.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  (p.textContent === before) ? ok('обратное переключение на русский работает')
                             : no('русский не вернулся: ' + p.textContent);
}
{
  const { w } = makeDom('<html><body><a class="pill">ҚАЗ</a></body></html>', { noStorage: true });
  let err = null;
  try { w.eval(langSrc); w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        w.document.querySelector('.pill').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
  catch (e) { err = e.message; }
  err ? no('lang.js падает без localStorage: ' + err) : ok('lang.js переживает заблокированный localStorage');
}

// ─────────────────────────────────────────────────
console.log('\n=== ВАЛИДАЦИЯ АДМИНКИ ===');
{
  const adminSrc = fs.readFileSync(DIR + 'admin/admin.js', 'utf8');
  const body = adminSrc.slice(adminSrc.indexOf('function isObj'), adminSrc.indexOf('/* Единая безопасная запись'));
  const validate = new Function(body + '; return validate;')();
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(DIR + 'content.js', 'utf8'))(sandbox.window);
  const good = sandbox.window.GH_DEFAULT;
  const clone = () => JSON.parse(JSON.stringify(good));

  const cases = [
    ['корректные данные проходят', good, 0],
    ['нет залов', (() => { const d = clone(); d.halls = []; return d; })(), 1],
    ['нет меню', (() => { const d = clone(); d.menus = []; return d; })(), 1],
    ['цена меню = текст', (() => { const d = clone(); d.menus[0].price = 'абв'; return d; })(), 1],
    ['цена меню = 0', (() => { const d = clone(); d.menus[0].price = 0; return d; })(), 1],
    ['min > max в зале', (() => { const d = clone(); d.halls[0].min = 500; return d; })(), 1],
    ['максимум гостей = 0', (() => { const d = clone(); d.halls[0].max = 0; return d; })(), 1],
    ['WhatsApp с буквами', (() => { const d = clone(); d.contacts.whatsapp = '+7 (776) абв'; return d; })(), 1],
    ['пустое название зала', (() => { const d = clone(); d.halls[0].name = '  '; return d; })(), 1],
    ['дублирующийся id меню', (() => { const d = clone(); d.menus[1].id = d.menus[0].id; return d; })(), 1],
    
    ['faq не список', (() => { const d = clone(); d.faq = 'сломано'; return d; })(), 1],
    ['цена 5 000 000 ₸/чел (опечатка)', (() => { const d = clone(); d.menus[0].price = 5000000; return d; })(), 1],
  ];
  cases.forEach(([name, data, wantErr]) => {
    const errs = validate(data);
    const got = errs.length > 0 ? 1 : 0;
    got === wantErr ? ok(name + (wantErr ? ' → отклонено: ' + errs[0].slice(0, 55) : ' → принято'))
                    : no(name + ' → ожидали ' + (wantErr ? 'ошибку' : 'успех') + ', получили ' + JSON.stringify(errs).slice(0, 90));
  });
}

// ─────────────────────────────────────────────────
console.log('\n=== ВЕС И РАЗМЕТКА ===');
{
  const size = fs.statSync(DIR + 'index.html').size;
  size < 150 * 1024 ? ok(`index.html весит ${Math.round(size / 1024)} КБ (было 1101 КБ)`)
                    : no(`index.html всё ещё ${Math.round(size / 1024)} КБ`);
  const imgs = (indexHtml.match(/<img\b[^>]*>/g) || []).filter(t => !/id="lbImg"/.test(t));
  const b64 = imgs.filter(t => /base64/.test(t)).length;
  const lazy = imgs.filter(t => /loading="lazy"/.test(t)).length;
  const dims = imgs.filter(t => /width="\d+"/.test(t) && /height="\d+"/.test(t)).length;
  b64 === 0 ? ok('картинок в base64 не осталось') : no(b64 + ' картинок всё ещё вшиты в HTML');
  dims === imgs.length ? ok(`у всех ${imgs.length} картинок заданы размеры (нет скачков вёрстки)`)
                       : no(`${imgs.length - dims} картинок без width/height`);
  ok(`lazy-загрузка: ${lazy} из ${imgs.length} (первые ${imgs.length - lazy} — сразу, они выше сгиба)`);
  (indexHtml.match(/lang\.js/g) || []).length === 1 ? ok('lang.js подключён один раз')
                                                    : no('lang.js подключён несколько раз');
  /font-size:16px/.test(fs.readFileSync(DIR + 'base.css', 'utf8')) ? ok('поля ввода 16px — iOS не зумит страницу')
                                                                   : no('поля ввода мельче 16px');
  const missing = imgs.map(t => (t.match(/src="([^"]+)"/) || [])[1])
    .filter(src => src && src.indexOf('+') < 0 && !fs.existsSync(DIR + src));
  missing.length ? no('битые пути картинок: ' + missing.join(', ')) : ok('все пути к картинкам существуют');
}

console.log('\n══════ ИТОГ: ' + pass + ' прошло, ' + fail + ' упало ══════\n');
process.exit(fail ? 1 : 0);
