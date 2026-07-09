# UWM Fuel — mobile app (v2.1.0)

Capacitor + React + TypeScript app for the **Fuel for Stock** and **Fuel for
Distribution** doctypes on `uwmerp.duxdigitech.in` (app `waste_management_ujjain`).

## Architecture — thin-shell + OTA
The APK is a **thin shell**: it loads the web app from
`https://uwmerp.duxdigitech.in/waste_management_ujjain/m`. The web app is **deployed
to the Frappe server**, so **future changes ship without rebuilding the APK** — just
run `./deploy-spa.sh`. The APK only needs rebuilding if you change native config
(package id, icon, splash, plugins).

Because the WebView loads the app **same-origin** with the Frappe site, the session
cookie is first-party and sent on every `/api` call. Auth is driven by
`get_boot_data` (never by reading `document.cookie`) — this is why the old
"stuck on login screen" WebView bug is gone.

## The original bug (fixed)
`frappe-react-sdk`'s `useFrappeAuth` decided "logged in?" by reading the `user_id`
cookie via `document.cookie`. Frappe sets that cookie on the login XHR response;
the Android WebView stores it natively but does **not** expose it to
`document.cookie` at that moment → the app never flipped to authenticated and stayed
on Login (while the "Signed in securely" toast fired anyway). The rewrite drives auth
from the `get_boot_data` response instead, so it works in the WebView.

## Backend API — `waste_management_ujjain/mobile_api/uwm_fuel.py`
Whitelisted, login-required, permission-checked:
`ping`, `get_boot_data`, `check_permissions`, `search_link`, `get_available_stock`,
`list_fuel_stock`, `list_fuel_distribution`, `get_fuel_stock`, `get_fuel_distribution`,
`create_fuel_stock`, `create_fuel_distribution`, `list_recent_activity`,
`upload_file_b64`. Methods only `insert()` the parent doc; the doctype controllers
create the Purchase Receipt / Invoice / Stock Entry.

## Screens
Login (Remember me) · Home dashboard · Fuel for Stock (list → form) ·
Fuel for Distribution (list → form) · Profile. Bottom nav: Home / Fuel Stock /
Fuel Distribution / Profile. No Reports.

## Build / deploy
```bash
npm install

# ship a web-app change (OTA — no APK rebuild):
./deploy-spa.sh

# rebuild the APK (only for native/config changes):
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk  (signed)
```

Signing: `android/app/keystore.properties` points at `uwm-fuel-release.keystore`
(passwords in `handoff.txt`, git-ignored — never commit).

## APK
- `android/app/build/outputs/apk/release/app-release.apk`
- Package `com.duxdigitech.uwmfuel`, label **UWM Fuel**, versionName 2.1.0.

## Notes
- Fuel item defaults to **Diesel**. Amount = quantity × rate.
- List search matches ID, vendor/supplier, fuel, company, and vehicle number.
- `available_stock` is stored on Distribution docs so it shows in the Desk list too.
- Remember-me stores the username + password (base64) in Capacitor Preferences and
  auto-signs-in next launch. For stronger at-rest protection, swap in a
  Keystore-backed secure-storage plugin later.
