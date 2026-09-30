#!/usr/bin/env bash
# Резервная копия заявок и контента. В крон: 0 3 * * * /var/www/gaukhartas-api/backup.sh
set -euo pipefail
D=/var/www/gaukhartas-api/data
B=/var/backups/gaukhartas
mkdir -p "$B"
tar czf "$B/data-$(date +%F-%H%M).tar.gz" -C "$D" .
ls -t "$B"/data-*.tar.gz | tail -n +31 | xargs -r rm   # держим 30 копий
echo "бэкап: $B/data-$(date +%F-%H%M).tar.gz"
