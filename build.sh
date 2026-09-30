#!/usr/bin/env bash
# Единственный источник правды — корень репозитория.
# deploy/public собирается отсюда, руками его не правят.
set -e
cd "$(dirname "$0")"
mkdir -p deploy/public/admin deploy/public/assets deploy/public/app
cp index.html base.css engine.js content.js lang.js robots.txt sitemap.xml deploy/public/
cp -f ./*.txt deploy/public/ 2>/dev/null || true   # robots.txt и ключ IndexNow
cp admin/index.html admin/admin.js deploy/public/admin/
cp app/* deploy/public/app/
[ -d print ] && cp -r print deploy/public/
[ -d big ] && cp -r big deploy/public/
[ -d small ] && cp -r small deploy/public/
rsync -a --delete assets/ deploy/public/assets/ 2>/dev/null || cp -r assets/. deploy/public/assets/
rm -f deploy/public/test*.js deploy/public/BUGFIXES.md deploy/public/build.sh

# ── Версии файлов в ссылках ──────────────────────────────────────────
stamp() {
  local dir="$1" page="$2"; shift 2
  for f in "$@"; do
    [ -f "$dir/$f" ] || continue
    python3 -c "
import sys, re, hashlib
dir_path, page, f = sys.argv[1], sys.argv[2], sys.argv[3]
filepath = f'{dir_path}/{f}'
pagepath = f'{dir_path}/{page}'
with open(filepath, 'rb') as fp:
    h = hashlib.md5(fp.read()).hexdigest()[:8]
with open(pagepath, 'r', encoding='utf-8') as fp:
    content = fp.read()
content = re.sub(r'src=\"' + re.escape(f) + r'(\?v=[a-f0-9]+)?\"', f'src=\"{f}?v={h}\"', content)
content = re.sub(r'href=\"' + re.escape(f) + r'(\?v=[a-f0-9]+)?\"', f'href=\"{f}?v={h}\"', content)
with open(pagepath, 'w', encoding='utf-8') as fp:
    fp.write(content)
" "$dir" "$page" "$f"
  done
}
stamp deploy/public index.html base.css engine.js content.js lang.js
stamp deploy/public/admin index.html admin.js
stamp deploy/public/app index.html sw.js

echo "собрано → deploy/public"
grep -o '\(src\|href\)="[a-z.]*\.\(js\|css\)?v=[a-f0-9]*"' deploy/public/index.html | sed 's/^/  /'
