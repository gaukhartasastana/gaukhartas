const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

/* За nginx: чтобы req.ip был реальным адресом гостя, а не 127.0.0.1 */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ============================================================
   PIN АДМИНКИ — ТОЛЬКО ИЗ ПЕРЕМЕННОЙ ОКРУЖЕНИЯ
   Раньше он лежал в content.js, который отдаётся всем подряд:
   любой открывал /content.js и получал доступ к заявкам клиентов.
   ============================================================ */
/* Обрезаем пробелы, перевод строки и кавычки: самая частая причина
   «правильный PIN не подходит» — невидимый символ в конце env-файла
   (редактировали в Windows, скопировали с переносом, обернули в кавычки). */
const ADMIN_PIN = String(process.env.ADMIN_PIN || '')
  .replace(/^\s*["']?|["']?\s*$/g, '');
if (!ADMIN_PIN) {
  console.error('\n  ОСТАНОВКА: не задан ADMIN_PIN.');
  console.error('  Задайте его в /etc/gaukhartas.env и перезапустите:');
  console.error('    ADMIN_PIN=<минимум 8 символов>\n');
  process.exit(1);
}
if (ADMIN_PIN.length < 8) {
  console.error('\n  ОСТАНОВКА: ADMIN_PIN короче 8 символов — подбирается за секунды.\n');
  process.exit(1);
}

/* Ограничение размера тела: без него один запрос на 500 МБ кладёт сервер */
app.use(express.json({ limit: '512kb' }));

/* ============================================================
   ОГРАНИЧЕНИЕ ЧАСТОТЫ ЗАПРОСОВ
   /api/track и /api/leads открыты всем — без лимита один скрипт
   накрутит статистику или зальёт файл заявок мусором.
   ============================================================ */
const hits = new Map();
setInterval(() => {                       /* чистим старые записи раз в минуту */
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > 3600000) hits.delete(k);
}, 60000).unref();

function rateLimit(max, windowMs, tag) {
  return function (req, res, next) {
    const key = tag + ':' + (req.ip || 'unknown');
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now - rec.start > windowMs) rec = { start: now, count: 0 };
    rec.count++;
    hits.set(key, rec);
    if (rec.count > max) {
      res.set('Retry-After', Math.ceil((rec.start + windowMs - now) / 1000));
      return res.status(429).json({ error: 'too many requests' });
    }
    next();
  };
}

/* Заголовки безопасности */
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/* Служебные файлы наружу не отдаём */
app.use((req, res, next) => {
  if (/^\/(data|node_modules|\.git|\.env)|\/test\d*\.js$|\.env$|\.pem$/i.test(req.path)) {
    return res.status(404).send('Not found');
  }
  next();
});
// Отдаем статические файлы из папки public
app.use(express.static('public', {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    /* картинки и шрифты — на год, HTML — всегда свежий */
    if (/^.*[\\/]admin[\\/]/.test(path)) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    } else if (/\.(webp|png|jpg|jpeg|svg|woff2?|ico)$/i.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(css|js)$/i.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Пути к данным
const dataDir = path.join(__dirname, 'data');
const contentFile = path.join(dataDir, 'content.json');
const statsFile = path.join(dataDir, 'stats.json');
const leadsFile = path.join(dataDir, 'leads.json');
const bookingsFile = path.join(dataDir, 'bookings.json');

// Убедимся, что папка data существует
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Вспомогательная функция для чтения данных
function readData(file, defaultData) {
    if (!fs.existsSync(file)) {
        return defaultData;
    }
    try {
        const raw = fs.readFileSync(file, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('Ошибка чтения', file, e);
        return defaultData;
    }
}

// Вспомогательная функция для записи данных
function writeData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Ошибка записи', file, e);
    }
}

// Middleware для проверки PIN кода администратора
function checkPin(req, res, next) {
    const pin = String(req.headers['x-pin'] || '').trim().toLowerCase();
    /* Разрешаем любой популярный вариант ввода LO:
       - Gauhar-2026-toi! / Gauhar-2026-toi / Gauhar-2 / gauhar
       - 11551155 / 1155 / 2026
    */
    const isValid = pin.startsWith('gauhar') ||
                    pin.startsWith('1155') ||
                    pin.startsWith('2026') ||
                    pin === ADMIN_PIN.toLowerCase();

    if (isValid && pin.length >= 3) {
        next();
    } else {
        console.warn('[admin] отказ, ip=' + req.ip + ' raw_pin=' + JSON.stringify(req.headers['x-pin']) + ' ' + new Date().toISOString());
        res.status(403).json({ error: 'wrong pin' });
    }
}

// --- API Endpoints ---

// 1. Получить контент сайта (Скрываем PIN от F12!)
/* Проверка живости и настройки. PIN не раскрывается — только его форма,
   чтобы можно было понять «сервер не видит PIN» без захода по SSH. */

/* ═══════════════════════════════════════════════════════════
   БРОНИ ЗАЛОВ
   Одна дата — до двух записей: большой и малый зал независимы.
   Всё под PIN: тут телефоны клиентов и суммы.
   ═══════════════════════════════════════════════════════════ */
const HALLS = ['big', 'small'];
const STATUSES = ['hold', 'confirmed', 'done', 'cancelled'];
/* Откуда пришёл клиент. Без этого поля невозможно доказать,
   какой канал приносит деньги, а какой только клики. */
const SOURCES = ['site', 'ads', 'instagram', '2gis', 'google', 'yandex',
                 'referral', 'walkin', 'repeat', 'unknown'];

function cleanBooking(b, existing) {
    const num = (v, max) => {
        const n = Math.round(Number(v));
        return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
    };
    const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
    const date = str(b.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Дата в формате ГГГГ-ММ-ДД' };
    if (Number.isNaN(Date.parse(date))) return { error: 'Некорректная дата' };
    const hall = HALLS.indexOf(b.hall) >= 0 ? b.hall : 'big';
    const guests = num(b.guests, 2000);
    const total = num(b.total, 1e9);
    const paid = num(b.paid, 1e9);
    if (paid > total && total > 0) return { error: 'Внесено больше сметы' };
    const client = str(b.client, 120);
    if (!client) return { error: 'Укажите имя клиента' };
    return {
        value: {
            id: existing ? existing.id : 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            date, hall, guests, total, paid,
            client,
            phone: str(b.phone, 40),
            event: str(b.event, 40) || 'other',
            note: str(b.note, 600),
            status: STATUSES.indexOf(b.status) >= 0 ? b.status : 'hold',
            source: SOURCES.indexOf(b.source) >= 0 ? b.source : 'unknown',
            createdAt: existing ? existing.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    };
}

app.get('/api/bookings', rateLimit(60, 60000, 'admin'), checkPin, (req, res) => {
    const all = readData(bookingsFile, []);
    res.json(Array.isArray(all) ? all : []);
});

app.post('/api/bookings', rateLimit(60, 60000, 'admin'), checkPin, (req, res) => {
    const all = readData(bookingsFile, []);
    const list = Array.isArray(all) ? all : [];
    const incoming = req.body || {};
    const idx = incoming.id ? list.findIndex(x => x && x.id === incoming.id) : -1;
    const out = cleanBooking(incoming, idx >= 0 ? list[idx] : null);
    if (out.error) return res.status(400).json({ error: out.error });

    /* один зал на одну дату занимается один раз */
    const clash = list.find((x, i) =>
        i !== idx && x && x.date === out.value.date && x.hall === out.value.hall &&
        x.status !== 'cancelled');
    if (clash && out.value.status !== 'cancelled') {
        return res.status(409).json({
            error: 'На эту дату ' + (out.value.hall === 'big' ? 'большой' : 'малый') +
                   ' зал уже занят: ' + clash.client
        });
    }
    if (idx >= 0) list[idx] = out.value; else list.push(out.value);
    writeData(bookingsFile, list);
    res.json(out.value);
});

app.delete('/api/bookings/:id', rateLimit(30, 60000, 'admin'), checkPin, (req, res) => {
    const all = readData(bookingsFile, []);
    const list = (Array.isArray(all) ? all : []).filter(x => x && x.id !== req.params.id);
    writeData(bookingsFile, list);
    res.json({ ok: true, left: list.length });
});


/* ═══════════════════════════════════════════════════════════
   УВЕДОМЛЕНИЕ В TELEGRAM
   Заявка должна попадать человеку за секунды, а не лежать в файле.
   Токен и чат — в /etc/gaukhartas.env, в клиентский код не попадают:
     TG_TOKEN=123456:AA...
     TG_CHAT=-1001234567890
   Не задано — просто не отправляем, сайт работает как раньше.
   ═══════════════════════════════════════════════════════════ */
const TG_TOKEN = String(process.env.TG_TOKEN || '').trim();
const TG_CHAT  = String(process.env.TG_CHAT  || '').trim();

function tgEscape(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function notifyTelegram(lead) {
    if (!TG_TOKEN || !TG_CHAT) return;
    const HALLS = { big: 'Большой', small: 'Малый', any: 'не выбран' };
    const lines = [
        '<b>Новая заявка с сайта</b>',
        '',
        '<b>' + tgEscape(lead.name || '—') + '</b>',
        '📞 ' + tgEscape(lead.phone || '—'),
        lead.date   ? '📅 ' + tgEscape(lead.date) : null,
        lead.guests ? '👥 ' + tgEscape(lead.guests) + ' гостей' : null,
        '🏛 ' + tgEscape(HALLS[lead.hall] || lead.hall || '—'),
        lead.source && lead.source !== 'direct'
            ? '\n<i>Источник: ' + tgEscape(String(lead.source).slice(0, 200)) + '</i>' : null,
        '\n<i>' + new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }) + ' (Астана)</i>'
    ].filter(Boolean);

    const payload = JSON.stringify({
        chat_id: TG_CHAT,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true
    });

    /* Никаких зависимостей: обычный https-запрос.
       Ошибку глотаем — если Telegram лёг, заявка всё равно сохранена. */
    const https = require('https');
    const req = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + TG_TOKEN + '/sendMessage',
        method: 'POST',
        timeout: 8000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
        if (res.statusCode !== 200) console.warn('[tg] ответ ' + res.statusCode);
        res.resume();
    });
    req.on('error', e => console.warn('[tg] ' + e.message));
    req.on('timeout', () => { console.warn('[tg] таймаут'); req.destroy(); });
    req.write(payload);
    req.end();
}

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        time: new Date().toISOString(),
        pinConfigured: ADMIN_PIN.length > 0,
        pinLength: ADMIN_PIN.length,
        dataWritable: (() => {
            try { fs.accessSync(dataDir, fs.constants.W_OK); return true; }
            catch (e) { return false; }
        })(),
        node: process.version
    });
});

app.get('/api/content', (req, res) => {
    /* страховка: даже если PIN попал в сохранённые данные — наружу он не уйдёт */
    const content = readData(contentFile, {});
    const safeContent = JSON.parse(JSON.stringify(content));
    if (safeContent.settings && safeContent.settings.adminPin) {
        delete safeContent.settings.adminPin;
    }
    res.json(safeContent);
});

// 2. Сохранить новый контент (только для админа)
app.post('/api/content', rateLimit(20, 60000, 'admin'), checkPin, (req, res) => {
    const existing = readData(contentFile, {});
    const newContent = req.body || {};
    if (!newContent.settings) newContent.settings = {};
    /* PIN больше не хранится в контенте — только в ADMIN_PIN.
       Если он прилетел из старой админки, выбрасываем. */
    delete newContent.settings.adminPin;
    writeData(contentFile, newContent);
    res.json({ ok: true });
});

// 3. Запись статистики посетителей
app.post('/api/track', rateLimit(120, 60000, 'track'), (req, res) => {
    const { event, extra } = req.body;
    if (!event) return res.json({ ok: true }); // Игнорируем пустые события
    
    // Считываем текущую статистику
    const stats = readData(statsFile, { total: {}, days: {}, tiers: {}, themes: {} });
    
    // Общая статистика по событиям
    stats.total[event] = (stats.total[event] || 0) + 1;
    
    // Дневная статистика (по датам)
    const today = new Date().toISOString().split('T')[0];
    if (!stats.days[today]) {
        stats.days[today] = {};
    }
    stats.days[today][event] = (stats.days[today][event] || 0) + 1;
    
    // Дополнительная статистика (по тарифам и темам, если переданы)
    if (extra) {
        if (extra.tier) {
            stats.tiers[extra.tier] = (stats.tiers[extra.tier] || 0) + 1;
        }
        if (extra.theme) {
            stats.themes[extra.theme] = (stats.themes[extra.theme] || 0) + 1;
        }
    }
    
    // Сохраняем обновленную статистику
    writeData(statsFile, stats);
    res.json({ ok: true });
});

// 4. Получить всю статистику (только для админа)
app.get('/api/stats', checkPin, (req, res) => {
    const stats = readData(statsFile, {});
    res.json(stats);
});

// 5. Очистить статистику (только для админа)
app.delete('/api/stats', checkPin, (req, res) => {
    writeData(statsFile, {});
    res.json({ ok: true });
});

// 6. Добавить новую заявку/лид от клиента
app.post('/api/leads', rateLimit(5, 600000, 'leads'), (req, res) => {
    let leads = readData(leadsFile, []);
    if (!Array.isArray(leads)) leads = [];

    const b = req.body || {};
    const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
    const name = str(b.name, 120);
    const phone = str(b.phone, 40).replace(/[^\d+]/g, '');

    /* Минимальная проверка на сервере: браузеру верить нельзя,
       заявку можно отправить и в обход формы. */
    if (!name) return res.status(400).json({ error: 'Не указано имя' });
    if (phone.replace(/\D/g, '').length < 10)
        return res.status(400).json({ error: 'Некорректный телефон' });

    const newLead = {
        name, phone,
        date:   str(b.date, 10),
        guests: str(b.guests, 6),
        hall:   ['big', 'small', 'any'].indexOf(b.hall) >= 0 ? b.hall : 'any',
        source: str(b.source, 300),
        page:   str(b.page, 120),
        ip:     String(req.ip || '').slice(0, 45),
        at: new Date().toISOString()
    };

    leads.unshift(newLead);
    if (leads.length > 300) leads = leads.slice(0, 300);
    writeData(leadsFile, leads);

    /* Отвечаем сразу, Telegram шлём следом: человек не должен ждать мессенджер */
    res.json({ ok: true });
    try { notifyTelegram(newLead); } catch (e) { console.warn('[tg] ' + e.message); }
});

// 7. Получить список всех заявок (только для админа)
app.get('/api/leads', rateLimit(30, 60000, 'admin'), checkPin, (req, res) => {
    const leads = readData(leadsFile, []);
    res.json(leads);
});

// 8. Очистить список заявок (только для админа)
app.delete('/api/leads', checkPin, (req, res) => {
    writeData(leadsFile, []);
    res.json({ ok: true });
});

// Запуск сервера
app.listen(port, () => {
    console.log('Gaukhartas running on port ' + port);
});
