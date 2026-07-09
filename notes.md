# UWM Fuel — Engineering Notes

_Date: 2026-07-08 • Site: https://uwmerp.duxdigitech.in • App: waste_management_ujjain_

## STEP 0 — Backend discovery (read-only, via SSH + bench console) — DONE

### Environment verified
- SSH to `frappe@187.127.132.58` : **OK** (key auth works).
- Toolchain on this Windows box: Node v24.15.0 / npm 11.12.1 OK. **No Java/Android on PATH**, but Android Studio JBR (JDK 21) + Android SDK (build-tools 34–37, platforms up to 37) + `keytool` + emulator AVD **`Pixel_10_Pro`** are installed → APK build & emulator testing are feasible.
- No physical device connected (`adb devices` empty). Will use the `Pixel_10_Pro` emulator.

### Doctype: "Fuel for Stock" (autoname `format:FS-{##}`, NOT submittable)
| fieldname | type | req | ro | options |
|---|---|---|---|---|
| date_ffs | Date | | | |
| vendor_name | Link | ✔ | | Supplier (JS filter: `supplier_group = "Fuel Supplier"`) |
| warehouse | Link | ✔ | ✔ | Warehouse |
| item | Link | ✔ | | Item (JS filter: `item_group = "Fuel"`) |
| quantity_ffs | Float | ✔ | | |
| rateltr_ffs | Currency | ✔ | | |
| aamountffs | Currency | | ✔ | = ceil(qty×rate) (set by JS) |
| amountffs | Currency | | ✔ | |
| company | Link | | ✔ | Company |
| purchase_receipt_ref | Link | | ✔ | Purchase Receipt |
| purchase_invoice_ref | Link | | ✔ | Purchase Invoice |
| upload_invoice__invoice_copy | Attach | ✔ | | (mandatory invoice) |
| bill_number | Data | | | |
| upload_fuel_station_proof__fuel_station_receipt | Attach | | | |
| remarks | Small Text | | | |

**Controller (`fuel_for_stock.py`):** `after_insert()` → `create_purchase_docs()`:
creates a **Purchase Receipt** (submitted) and a **Purchase Invoice** (draft, `bill_no=FFS-<name>`),
both with `ignore_permissions=True`, then `db_set` `purchase_receipt_ref` / `purchase_invoice_ref`.
On error it `frappe.throw(str(e))`. → Mobile API only needs to `insert()`; controller does the rest.

### Doctype: "Fuel for Distribution" (autoname `format:FD-{##}`, NOT submittable)
| fieldname | type | req | ro | options |
|---|---|---|---|---|
| date | Date | ✔ | | |
| warehouse | Link | ✔ | ✔ | Warehouse |
| fuel_type | Link | ✔ | | Item |
| available_stock | Data | | ✔ | |
| company | Link | | ✔ | Company |
| stock_entry_reference | Link | | ✔ | Stock Entry |
| vehicle_details | Table | | | **Fuel Distrubution Items** |
| total_fuel_issued | Data | | ✔ | |
| attachment | Attach | | | |
| remarks | Small Text | | | |

**Controller (`fuel_for_distribution.py`):** `after_insert()` → `create_stock_entry()`:
creates a **Stock Entry** ("Material Issue", item=`fuel_type`, qty=`total_fuel_issued`,
`s_warehouse`=warehouse), submits it, `db_set` `stock_entry_reference`.
⚠️ **It hard-requires `self.total_fuel_issued > 0`** — so the mobile API MUST compute and set
`total_fuel_issued` before `insert()`, or the save throws "Total Fuel Issued must be greater than 0."

### Child table: "Fuel Distrubution Items" (istable=1)
| fieldname | type | options |
|---|---|---|
| vehicle_details | Link | **Vehicle Details** |
| fuel_issued | Float | |
| odometer_reading | Float | |
| upload_proof | Attach Image | |

### Master data (confirmed)
- Company: **Ujjain Waste Management** (abbr UWM) — only one.
- Warehouses: **Ujjain Plant - UWM** (plus Stores/Finished Goods/etc.), all company UWM.
- Fuel items: **Diesel**, **Petrol** (item_group "Fuel").
- Supplier group for vendors: **Fuel Supplier**.
- `Vehicle Details` doctype exists (e.g. "Rental - ...", "Diesel Generator - Mahindra -"). Child links to it.
- available_stock source: `Bin.actual_qty` summed by item+warehouse (ERPNext ledger).

### Role permissions (DocPerm) — ⚠️ IMPORTANT
- **Fuel for Stock**: only **System Manager** (read/write/create/delete). No submit.
- **Fuel for Distribution**: only **System Manager** (read/write/create/delete). No submit.
- No "Fuel Manager" / "Stock User" / operator role exists with rights. The scaffold's
  `STOCK_ROLES` / `DIST_ROLES` guesses are wrong → **only a System Manager can use the app** today.

### Bugs found in the provided scaffold `backend/fuel_api.py`
1. Child config wrong: `CHILD_VEHICLE="vehicle"` → must be **`vehicle_details`**; `VEHICLE_DOCTYPE="Vehicle"` → **"Vehicle Details"**.
2. `save_fuel_distribution` never sets `total_fuel_issued` → distribution save will **fail** in the controller.
3. `STOCK_ROLES/DIST_ROLES` don't match live DocPerm (only System Manager).
4. Placement: file is `backend/fuel_api.py` → deploys to `waste_management_ujjain/fuel_api.py`
   (method path `waste_management_ujjain.fuel_api.*`). Brief asked for `mobile_api/uwm_fuel.py` module.

---

## STEP 1 — Login-bug diagnosis — ✅ ROOT CAUSE CONFIRMED

### The real bug (from the actual deployed build + buggy APK)
The buggy `UWM-Fuel-release.apk` is a **thin WebView shell** (`capacitor.config.json` →
`server.url = https://uwmerp.duxdigitech.in/waste_management_ujjain/m`). It loads the SPA that is
**deployed on the server** (`/assets/waste_management_ujjain/frontend/index.js`, 556 KB, minified).
That deployed build is **newer** than `uwm-fuel-app-source.zip` and DOES contain a branded login screen.

Decompiled the deployed bundle. The app root:
```js
useFrappeAuth() → isLoading ? Spinner : currentUser ? <Home/> : <Login onLoggedIn={updateCurrentUser}/>
```
Login submit handler:
```js
await login({username, password, device:"mobile"});  // POST /api/method/login
toast("Signed in securely");                          // fires on 200 — OPTIMISTIC
onLoggedIn();                                          // = SWR mutate(get_logged_user)
```
`frappe-react-sdk`'s `useFrappeAuth` decides "logged in?" by **reading `document.cookie` for `user_id`**:
```js
getUserCookie = () => { const c = document.cookie.split(";").find(x=>x.trim().startsWith("user_id="));
                        setAuthFlag(c && val!=="Guest" ? val : null); }
login = v => loginWithUsernamePassword(v).then(()=> getUserCookie());   // re-reads document.cookie
// get_logged_user is fetched ONLY when the cookie-derived flag is truthy
```

**Root cause:** login success is detected by reading the `user_id` cookie from `document.cookie`.
Frappe sets that cookie via the login **XHR** `Set-Cookie` response. Desktop Chrome exposes XHR-set
(non-HttpOnly) cookies to `document.cookie` synchronously → works. The **Android System WebView**
stores XHR-set cookies in the native `CookieManager` but does **not** reliably expose them to
`document.cookie` at that moment → `getUserCookie()` finds nothing → the auth flag never flips →
`get_logged_user` is never called → `currentUser` stays undefined → **app re-renders `<Login/>`**.
The `sid` session cookie *is* stored natively (subsequent requests would authenticate), so the
session is real — only the **client-side detection** fails. The "Signed in securely" toast is a
false positive because it is tied solely to the login POST returning 200.

### Fix (drive auth from a real backend call, not from document.cookie)
After a successful `POST /api/method/login`, explicitly `GET frappe.auth.get_logged_user`
(or `get_boot_data`) — this rides the natively-stored `sid` cookie and works in the WebView —
and set the authenticated state from THAT response. Only then navigate to Home + toast.
If it still fails inside the packaged APK, fall back to token auth (`Authorization: token key:secret`)
per Step 3. Requires editing the **frontend source** that built the deployed bundle.

### Source availability
The current frontend source (that built the deployed bundle) is **not in the delivered files and not
on this machine** (grep for the unique login strings across Downloads/Codex = 0 hits in source; only
in the compiled bundle). Decision needed on how to apply the fix (see below).

---
## STEP 1 (original note) — provided source-zip has no login screen

**The provided `uwm-fuel-app-source.zip` has no login screen and no auth code at all.**
- `capacitor.config.ts` is a **thin WebView shell**: it just opens the live URL
  `https://uwmerp.duxdigitech.in/waste_management_ujjain/m` (no bundled web build).
- The React SPA (`main.tsx` → `App.tsx`) is served **by Frappe**, same-origin, and relies purely
  on the **Frappe session cookie** (`frappe-react-sdk` `FrappeProvider`, no baseURL/token).
- `App.tsx` has **no `/login` route, no auth store, no Preferences, no login submit handler,
  no boot-data gating**. It just calls `capabilities()` and renders Home/Stock/Dist/Profile.
- `www/uwm_fuel.py` allows Guests, so an unauthenticated user sees the SPA as **Guest → DENY_ALL**
  (empty screens) with **no way to log in from inside the app**.

→ The brief's "after login shows a toast but stays stuck on the login screen" behavior **cannot come
from this source** — there is no login screen here. The buggy APK/build the brief describes is a
**different (newer) artifact** than this zip. Steps 1–3 as written (diagnose auth store / router
guards / token storage) target code that does not exist in the delivered source.

**Consequence:** to satisfy the brief I would be *writing a login screen from scratch* into this SPA
(session-cookie login via `POST /api/method/login`, same-origin — which works reliably in this
thin-shell model because the WebView is first-party to the site), not *fixing* an existing one.

## Other blockers found
- **Test user `rishabh.shriwas` does not exist** on uwmerp.duxdigitech.in. Searching `%rishabh%`
  returns only `rishabh.surana@jewonline.in` (a different org/site). Cannot run the specified login test.
- Deploying = writing to a **LIVE production ERP**. The scaffold README itself recommends testing on
  `erptest.duxdigitech.in` first.
