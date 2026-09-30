#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  Диагностика: почему не пускает в админку
#  Запуск НА СЕРВЕРЕ:  sudo bash deploy/aws/check.sh
# ══════════════════════════════════════════════════════════════
ENVF=/etc/gaukhartas.env
API=http://127.0.0.1:3000
ok(){ echo "  ✅ $1"; }
no(){ echo "  ❌ $1"; }
warn(){ echo "  ⚠  $1"; }

echo
echo "── 1. Служба"
if systemctl is-active --quiet gaukhartas; then ok "gaukhartas запущена"
else
  no "gaukhartas НЕ запущена — это и есть причина"
  echo; echo "  Последние строки лога:"
  journalctl -u gaukhartas -n 15 --no-pager | sed 's/^/    /'
  echo; echo "  Починить:  sudo systemctl restart gaukhartas"
  exit 1
fi

echo
echo "── 2. Файл с PIN"
if [[ ! -f $ENVF ]]; then
  no "$ENVF не существует"
  echo "     Создать:  printf 'ADMIN_PIN=ВашПароль123\\nPORT=3000\\n' | sudo tee $ENVF"
  echo "               sudo chmod 600 $ENVF && sudo systemctl restart gaukhartas"
  exit 1
fi
ok "$ENVF есть"
RAW=$(grep -m1 '^ADMIN_PIN=' "$ENVF" | cut -d= -f2-)
LEN=${#RAW}
echo "     длина значения в файле: $LEN"
# ищем мусор, из-за которого верный PIN не подходит
[[ "$RAW" =~ $'\r' ]]   && no "в конце строки \\r — файл редактировали в Windows"
[[ "$RAW" =~ ^[[:space:]]|[[:space:]]$ ]] && no "пробел в начале или конце значения"
[[ "$RAW" =~ ^\"|\"$ ]] && warn "значение в кавычках — сервер их срежет, но лучше убрать"
[[ $LEN -lt 8 ]]        && no "короче 8 символов — сервер не стартует с таким"
if ! [[ "$RAW" =~ $'\r' || "$RAW" =~ ^[[:space:]]|[[:space:]]$ ]]; then
  ok "мусорных символов нет"
fi
echo "     первый символ: '${RAW:0:1}'   последний: '${RAW: -1}'"

echo
echo "── 3. Что видит сам сервер"
H=$(curl -s -m 5 $API/api/health)
if [[ -z "$H" ]]; then
  no "Node не отвечает на $API"
  echo "     journalctl -u gaukhartas -n 20"
  exit 1
fi
ok "Node отвечает"
echo "     $H"
SRVLEN=$(echo "$H" | grep -o '"pinLength":[0-9]*' | cut -d: -f2)
if [[ "$SRVLEN" != "$LEN" ]]; then
  warn "длина в файле ($LEN) ≠ длина у сервера ($SRVLEN)"
  echo "     Сервер обрезал мусор, либо служба работает со старым значением."
  echo "     Перезапустить:  sudo systemctl restart gaukhartas"
fi
echo "$H" | grep -q '"dataWritable":true' && ok "папка data доступна на запись" \
  || no "data недоступна на запись — заявки не сохранятся"

echo
echo "── 4. Проверка входа настоящим PIN"
CLEAN=$(echo "$RAW" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')
CODE=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -H "X-Pin: $CLEAN" $API/api/stats)
case "$CODE" in
  200) ok "PIN из файла подходит — сервер в порядке" ;;
  403) no "сервер отклоняет собственный PIN"
       echo "     Почти наверняка служба не перечитала файл."
       echo "     sudo systemctl restart gaukhartas && sudo bash $0" ;;
  *)   no "неожиданный ответ $CODE" ;;
esac

echo
echo "── 5. nginx проксирует /api/"
if command -v nginx >/dev/null; then
  CODE=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -k https://localhost/api/health 2>/dev/null \
      || curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost/api/health)
  case "$CODE" in
    200) ok "через nginx /api/health отвечает" ;;
    404) no "nginx НЕ проксирует /api/ — админка не сможет проверить PIN"
         echo "     sudo nginx -T | grep -A5 'location /api'" ;;
    *)   warn "nginx вернул $CODE" ;;
  esac
fi

echo
echo "── 6. Кэш админки"
CH=$(curl -s -m 5 -I http://localhost/admin/admin.js 2>/dev/null | grep -i '^cache-control' | tr -d '\r')
if echo "$CH" | grep -qi 'no-store'; then ok "admin.js не кэшируется"
else
  warn "admin.js кэшируется: ${CH:-заголовка нет}"
  echo "     Это частая причина «верный PIN не подходит»: браузер держит"
  echo "     старую версию админки. Обнови конфиг nginx и сделай на телефоне"
  echo "     жёсткое обновление страницы."
fi

echo
echo "════════════════════════════════════════════"
echo "  Если всё выше зелёное, а войти не выходит —"
echo "  открой админку в режиме инкогнито. Это отсечёт кэш браузера."
echo "════════════════════════════════════════════"
echo
