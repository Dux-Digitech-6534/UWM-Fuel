#!/usr/bin/env bash
# Over-the-air deploy of the UWM Fuel web app to Frappe.
# The thin-shell APK loads this hosted app, so running this is all that's needed
# to ship a change — NO APK rebuild/reinstall.
#
# Usage:  ./deploy-spa.sh
set -euo pipefail

SSH="frappe@187.127.132.58"
APP_DIR="/home/frappe/frappe-bench/apps/waste_management_ujjain/waste_management_ujjain"
SITE="uwmerp.duxdigitech.in"
PUB="$APP_DIR/public/frontend"
WWW="$APP_DIR/www"
V="$(date +%s)"

echo "1/4  Building web app…"
npm run build

echo "2/4  Uploading assets (version $V)…"
ssh "$SSH" "mkdir -p $PUB"
scp -q dist/index.js  "$SSH:$PUB/index.js"
scp -q dist/index.css "$SSH:$PUB/index.css"
scp -q dist/uwm-logo.jpg "$SSH:$PUB/uwm-logo.jpg"

echo "3/4  Publishing host page…"
sed "s/__V__/$V/g" backend/www/uwm_fuel.html > /tmp/uwm_fuel.html
scp -q /tmp/uwm_fuel.html "$SSH:$WWW/uwm_fuel.html"
scp -q backend/www/uwm_fuel.py "$SSH:$WWW/uwm_fuel.py" 2>/dev/null || true

echo "4/4  Clearing cache…"
ssh "$SSH" "cd /home/frappe/frappe-bench && bench --site $SITE clear-cache >/dev/null 2>&1 || true"
echo "Done. Open https://$SITE/waste_management_ujjain/m  (APK picks it up on next launch)"
