#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Установка Гаухартас на чистый Ubuntu 22.04/24.04 (AWS Lightsail)
#  Запускать НА СЕРВЕРЕ:  sudo bash setup.sh
# ══════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${DOMAIN:-gaukhartas.com}"
WEB=/var/www/gaukhartas
API=/var/www/gaukhartas-api
SRC="$(cd "$(dirname "$0")/../.." && pwd)"

[[ $EUID -eq 0 ]] || { echo "Запускать через sudo"; exit 1; }

echo "── 1/7  Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx curl ufw >/dev/null
if ! command -v node >/dev/null || [[ $(node -v | cut -dv -f2 | cut -d. -f1) -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
echo "   node $(node -v), nginx $(nginx -v 2>&1 | grep -o '[0-9.]*')"

echo "── 2/7  PIN администратора"
if [[ ! -f /etc/gaukhartas.env ]]; then
  PIN=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)
  printf 'ADMIN_PIN=%s\nPORT=3000\nNODE_ENV=production\n' "$PIN" > /etc/gaukhartas.env
  chmod 600 /etc/gaukhartas.env
  echo "   Сгенерирован PIN: $PIN"
  echo "   ЗАПИШИ ЕГО — он больше нигде не показывается."
  echo "   Сменить: sudo nano /etc/gaukhartas.env"
else
  echo "   /etc/gaukhartas.env уже есть, не трогаю"
fi

echo "── 3/7  Файлы сайта"
mkdir -p "$WEB" "$API/data"
cp -r "$SRC/deploy/public/." "$WEB/"
cp "$SRC/deploy/server.js" "$SRC/deploy/package.json" "$API/"
rm -f "$WEB"/test*.js "$WEB"/BUGFIXES.md "$WEB"/build.sh
# API отдаёт статику сам только как запасной путь — основную работу делает nginx
ln -sfn "$WEB" "$API/public"
chown -R www-data:www-data "$WEB" "$API"
chmod 750 "$API/data"

echo "── 4/7  Зависимости"
cd "$API" && npm ci --omit=dev --silent 2>/dev/null || npm install --omit=dev --silent
chown -R www-data:www-data "$API/node_modules"

echo "── 5/7  Служба"
cp "$SRC/deploy/aws/gaukhartas.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now gaukhartas
sleep 2
systemctl is-active --quiet gaukhartas \
  && echo "   служба поднялась" \
  || { echo "   НЕ ЗАПУСТИЛАСЬ:"; journalctl -u gaukhartas -n 20 --no-pager; exit 1; }

echo "── 6/7  nginx"
# До выпуска сертификата ставим HTTP-конфиг целиком, без правки sed.
# Раньше здесь sed вырезал ssl-секцию и ломал блок: location /api/ оставался
# в мёртвом server{} без listen, и запросы к API уходили в 404 —
# админка при этом показывала «Неверный PIN», хотя PIN был верный.
if [[ -d /etc/letsencrypt/live/$DOMAIN ]]; then
  CONF="$SRC/deploy/aws/nginx.conf"
else
  CONF="$SRC/deploy/aws/nginx-http.conf"
fi
mkdir -p /etc/nginx/snippets
cp "$SRC/deploy/aws/security.conf" /etc/nginx/snippets/gaukhartas-security.conf
sed "s/gaukhartas\.com/$DOMAIN/g" "$CONF" > /etc/nginx/sites-available/gaukhartas
ln -sf /etc/nginx/sites-available/gaukhartas /etc/nginx/sites-enabled/gaukhartas
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Проверяем, что API действительно доступен через nginx, а не только напрямую
sleep 1
API_CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Pin: заведомо-неверный' http://127.0.0.1/api/stats || echo 000)
if [[ "$API_CODE" == "403" ]]; then
  echo "   nginx проксирует /api/ — проверено"
else
  echo "   ВНИМАНИЕ: /api/stats через nginx вернул $API_CODE, ожидался 403."
  echo "   Ожидаемо 403 = проксирование работает (PIN неверный, но сервер ответил)."
  echo "   404 = nginx не проксирует, админка не пустит. Смотри:"
  echo "     sudo nginx -T | grep -A5 'location /api'"
fi

echo "── 7/7  Файрвол"
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

cat <<DONE

════════════════════════════════════════════════════════
  Готово. Сайт: http://$DOMAIN
  PIN админки: cat /etc/gaukhartas.env

  ДАЛЬШЕ — SSL (только когда DNS уже указывает на этот сервер):
    sudo apt install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN

  Не пускает в админку:
    sudo bash deploy/aws/check.sh

  Обновить сайт после правок:
    sudo bash deploy/aws/update.sh

  Логи:      journalctl -u gaukhartas -f
  Перезапуск: sudo systemctl restart gaukhartas
════════════════════════════════════════════════════════
DONE
