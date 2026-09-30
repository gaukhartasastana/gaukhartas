#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  IndexNow — сообщает Яндексу и Bing, что страницы обновились,
#  вместо того чтобы ждать, когда робот зайдёт сам.
#  Google этот протокол не поддерживает: ему только Search Console.
#
#  Запуск после обновления сайта:  bash deploy/aws/indexnow.sh
#  Ключ должен лежать на сайте:    https://gaukhartas.com/<KEY>.txt
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

HOST="${HOST:-gaukhartas.com}"
KEY="7791de1a8962668920f6f237171b6221"

read -r -d '' BODY <<JSON || true
{
  "host": "${HOST}",
  "key": "${KEY}",
  "keyLocation": "https://${HOST}/${KEY}.txt",
  "urlList": [
    "https://${HOST}/",
    "https://${HOST}/?lang=kz",
    "https://${HOST}/small/"
  ]
}
JSON

echo "IndexNow → ${HOST}"

# сначала проверяем, что файл ключа реально отдаётся
probe=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://${HOST}/${KEY}.txt" || echo 000)
if [ "$probe" != "200" ]; then
  echo "  СТОП: https://${HOST}/${KEY}.txt отдаёт ${probe}, а нужно 200."
  echo "  Без этого файла поисковики отклонят запрос. Выполните update.sh."
  exit 1
fi
echo "  ключ на месте"

for EP in "https://api.indexnow.org/indexnow" "https://yandex.com/indexnow"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST "$EP" \
    -H 'Content-Type: application/json; charset=utf-8' \
    --data-raw "$BODY" || echo 000)
  case "$code" in
    200|202) echo "  принято      $EP" ;;
    400)     echo "  неверный запрос $EP" ;;
    403)     echo "  ключ отклонён   $EP" ;;
    422)     echo "  ключ не совпал с файлом на сайте — $EP" ;;
    429)     echo "  слишком часто, повторите позже — $EP" ;;
    *)       echo "  ответ $code    $EP" ;;
  esac
done

echo
echo "Google так не умеет. Для него: Search Console → Проверка URL → Запросить индексирование."
