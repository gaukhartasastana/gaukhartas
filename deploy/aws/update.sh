#!/usr/bin/env bash
# Обновление сайта после git pull. Запускать: sudo bash deploy/aws/update.sh
set -euo pipefail
WEB=/var/www/gaukhartas
API=/var/www/gaukhartas-api
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
[[ $EUID -eq 0 ]] || { echo "нужен sudo"; exit 1; }

[[ -x "$SRC/build.sh" ]] && bash "$SRC/build.sh"
# данные не трогаем — там заявки
cp -r "$SRC/deploy/public/." "$WEB/"
cp "$SRC/deploy/server.js" "$SRC/deploy/package.json" "$API/"
rm -f "$WEB"/test*.js "$WEB"/BUGFIXES.md "$WEB"/build.sh
chown -R www-data:www-data "$WEB" "$API/server.js" "$API/package.json"
cd "$API" && npm ci --omit=dev --silent 2>/dev/null || true
systemctl restart gaukhartas
sleep 2
systemctl is-active --quiet gaukhartas && echo "обновлено ✓" || journalctl -u gaukhartas -n 20 --no-pager
nginx -t && systemctl reload nginx
echo
# сообщаем Яндексу и Bing об обновлении
if [ -x "$SRC/deploy/aws/indexnow.sh" ]; then
  bash "$SRC/deploy/aws/indexnow.sh" || echo "IndexNow не отработал — не критично"
fi

echo "Готово. Если админка ведёт себя странно после обновления —"
echo "откройте её в режиме инкогнито: браузер мог сохранить старую версию." 
