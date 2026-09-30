# Деплой на AWS Lightsail

## Что где лежит

```
/var/www/gaukhartas       ← статика, её отдаёт nginx
/var/www/gaukhartas-api   ← Node на :3000, только /api/*
        └── data/         ← заявки, статистика, контент из админки
/etc/gaukhartas.env       ← PIN админки (chmod 600)
```

nginx отдаёт файлы напрямую и проксирует только `/api/` в Node.
Поэтому сайт работает даже если Node упал — не видно будет лишь админку.

## Установка на чистый сервер

Lightsail → Create instance → **Ubuntu 24.04**, план **$5/мес** (1 ГБ RAM).
Меньше не бери: на 512 МБ `npm install` падает по памяти.

```bash
git clone https://github.com/blackrussia-com/gaukhartas.git
cd gaukhartas
sudo DOMAIN=gaukhartas.com bash deploy/aws/setup.sh
```

Скрипт сам поставит Node 22, nginx, соберёт статику, создаст службу,
сгенерирует PIN и включит файрвол. **Запиши PIN, который он покажет.**

## Домен и SSL

Lightsail → Networking → **Create static IP** и прикрепи к инстансу.
Без статического IP адрес меняется при перезапуске.

Spaceship → DNS:

```
A      @     <статический IP>
A      www   <статический IP>
```

Когда DNS разошёлся (`dig gaukhartas.com +short` показывает твой IP):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d gaukhartas.com -d www.gaukhartas.com
```

Обновляется сертификат сам.

## Обновление после правок

```bash
cd gaukhartas && git pull
sudo bash deploy/aws/update.sh
```

`data/` не трогается — заявки на месте.

## Бэкапы

```bash
sudo cp deploy/aws/backup.sh /var/www/gaukhartas-api/
sudo chmod +x /var/www/gaukhartas-api/backup.sh
sudo crontab -e
# 0 3 * * * /var/www/gaukhartas-api/backup.sh
```

Хранит 30 последних копий в `/var/backups/gaukhartas`.
Раз в месяц скачивай их себе — сервер тоже может умереть.

## Команды

```bash
journalctl -u gaukhartas -f          # логи
sudo systemctl restart gaukhartas    # перезапуск
sudo nano /etc/gaukhartas.env        # сменить PIN, потом restart
curl -I https://gaukhartas.com       # проверка
```

## Безопасность

- PIN только в `/etc/gaukhartas.env`, в коде и в отдаваемых файлах его нет
- `/api/leads` — 5 заявок за 10 минут с адреса, `/api/track` — 120 в минуту
- Тело запроса максимум 512 КБ
- `data/`, `test*.js`, `.env`, `.pem` закрыты и в nginx, и в Node
- В `nginx.conf` есть заготовка «админка только с моего IP» — раскомментируй,
  вписав свой адрес. Это сильнее любого PIN.


## Если админка пишет «Неверный PIN»

Сначала проверь, доходит ли запрос до Node. **На сервере:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'X-Pin: заведомо-неверный' http://127.0.0.1/api/stats
```

* **403** — nginx проксирует правильно, значит PIN действительно не тот.
  Посмотри настоящий: `sudo grep ADMIN_PIN /etc/gaukhartas.env`
* **404** — nginx не проксирует `/api/`. Это и выглядит как «неверный PIN».
  Лечится переустановкой конфига:
  ```bash
  sudo cp deploy/aws/security.conf /etc/nginx/snippets/gaukhartas-security.conf
  sudo sed "s/gaukhartas\.com/$(hostname -f)/g" deploy/aws/nginx-http.conf \
       > /etc/nginx/sites-available/gaukhartas
  sudo nginx -t && sudo systemctl reload nginx
  ```
* **502** — Node не запущен: `sudo systemctl status gaukhartas`
* **000** — nginx не работает: `sudo systemctl status nginx`

Начиная с этой версии админка сама различает эти случаи и пишет,
что именно не так, вместо общего «неверный PIN».


## Не пускает в админку

```bash
sudo bash deploy/aws/check.sh
```

Скрипт проверит по шагам: служба, файл с PIN, мусорные символы в нём,
ответ Node, проксирование `/api/` через nginx, кэширование админки —
и скажет, что именно чинить.

Три самые частые причины:

1. **Браузер держит старую версию админки.** Раньше `.js` кэшировался на
   сутки. Открой админку в режиме инкогнито — если пустило, дело в кэше.
   В новом `nginx.conf` для `/admin/` стоит `no-store`, так что после
   обновления конфига это больше не повторится.

2. **Невидимый символ в `/etc/gaukhartas.env`.** Перевод строки, пробел
   или кавычки в конце значения. Сервер теперь их срезает сам, но проверить
   можно: `cat -A /etc/gaukhartas.env` — `$` в конце строки это норма,
   `^M$` означает файл из Windows.

3. **Служба не перечитала файл.** После правки env обязательно
   `sudo systemctl restart gaukhartas` — одного `reload` не хватит.

Посмотреть состояние без захода по SSH:

```
https://gaukhartas.com/api/health
```

Отдаёт живость службы, длину PIN (не сам PIN), доступность папки данных.
