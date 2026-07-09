# -*- coding: utf-8 -*-
# waste_management_ujjain/mobile_api/uwm_fuel.py
#
# Screen-shaped, permission-checked API for the "UWM Fuel" mobile app.
# Every endpoint (except ping) requires a logged-in session and enforces
# Frappe permissions server-side. The two parent doctypes are NOT submittable;
# their own controllers create the downstream docs on insert:
#   Fuel for Stock       -> after_insert -> Purchase Receipt (submitted) + Purchase Invoice (draft)
#   Fuel for Distribution -> after_insert -> Stock Entry ("Material Issue", submitted)
# This API only sets the parent fields (incl. total_fuel_issued, which the
# Distribution controller requires) and insert()s — it never duplicates that logic.

import math

import frappe
from frappe import _

# ---- constants verified against the live site (2026-07-08) -----------------
STOCK_DT = "Fuel for Stock"
DIST_DT = "Fuel for Distribution"
CHILD_DT = "Fuel Distrubution Items"           # (sic) exact spelling on the site

FUEL_ITEM_GROUP = "Fuel"                        # Diesel / Petrol live here
FUEL_SUPPLIER_GROUP = "Fuel Supplier"           # Desk JS filters vendor_name on this
VEHICLE_DOCTYPE = "Vehicle Details"             # child `vehicle_details` links here
DEFAULT_WAREHOUSE = "Ujjain Plant - UWM"
DEFAULT_COMPANY = "Ujjain Waste Management"

# child ("Fuel Distrubution Items") fieldnames (both the parent Table field and
# the child Link field are named `vehicle_details` on this site — not a typo here)
CHILD_VEHICLE = "vehicle_details"
CHILD_ISSUED = "fuel_issued"
CHILD_ODO = "odometer_reading"
CHILD_PROOF = "upload_proof"


# ============================================================================
# helpers
# ============================================================================
def _require_login():
    if frappe.session.user == "Guest":
        frappe.throw(_("Please sign in to continue."), frappe.AuthenticationError)


def _to_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _available_stock_qty(item, warehouse):
    """Actual on-hand qty from the stock ledger (Bin.actual_qty), the same figure
    ERPNext shows and the Stock Entry consumes. Sum across matching bins."""
    filters = {"warehouse": warehouse}
    if item:
        filters["item_code"] = item
    rows = frappe.get_all("Bin", filters=filters, fields=["actual_qty"])
    return sum(_to_float(r.actual_qty) for r in rows)


def _perms(dt):
    return {
        "read": bool(frappe.has_permission(dt, "read")),
        "create": bool(frappe.has_permission(dt, "create")),
        "write": bool(frappe.has_permission(dt, "write")),
        "delete": bool(frappe.has_permission(dt, "delete")),
    }


# ============================================================================
# connectivity
# ============================================================================
@frappe.whitelist(allow_guest=True)
def ping():
    return {
        "ok": True,
        "app": "uwm-fuel",
        "code_version": "2026-07-08-c",
        "user": frappe.session.user,
        "authenticated": frappe.session.user != "Guest",
        "server_time": frappe.utils.now(),
    }


# ============================================================================
# boot: the single call the app makes after login and on every cold start.
# Its success == "the session is valid"; the app drives auth state from this,
# NOT from document.cookie (that was the WebView bug).
# ============================================================================
@frappe.whitelist()
def get_boot_data():
    _require_login()
    user = frappe.session.user
    u = frappe.get_doc("User", user)

    stock_perm = _perms(STOCK_DT)
    dist_perm = _perms(DIST_DT)

    # app-relevant roles only (keep the profile screen tidy)
    RELEVANT = {
        "System Manager", "Administrator", "Fuel Manager", "Fuel Approver",
        "Fuel Operator", "Stock Manager", "Stock User", "Purchase Manager",
        "Purchase User", "Fleet Manager",
    }
    roles = [r for r in frappe.get_roles(user) if r in RELEVANT]

    available = None
    if dist_perm["read"] or stock_perm["read"]:
        available = _available_stock_qty("Diesel", DEFAULT_WAREHOUSE)

    try:
        csrf = frappe.sessions.get_csrf_token() or ""
    except Exception:
        csrf = ""

    return {
        "user": user,
        "full_name": u.full_name or user,
        "user_image": u.user_image,
        "roles": sorted(roles),
        "company": DEFAULT_COMPANY,
        "default_warehouse": DEFAULT_WAREHOUSE,
        "permissions": {"fuel_for_stock": stock_perm, "fuel_for_distribution": dist_perm},
        "can_use": stock_perm["read"] or dist_perm["read"]
        or stock_perm["create"] or dist_perm["create"],
        "stock_summary": {
            "fuel_type": "Diesel",
            "warehouse": DEFAULT_WAREHOUSE,
            "available_stock": available,
            "as_of": frappe.utils.now_datetime().strftime("%d-%m-%Y %H:%M"),
        },
        "recent_activity": _recent_activity(8),
        # CSRF token so the app can make authenticated POSTs with the session cookie
        "csrf_token": csrf,
        "server_time": frappe.utils.now(),
    }


@frappe.whitelist()
def check_permissions():
    _require_login()
    return {"fuel_for_stock": _perms(STOCK_DT), "fuel_for_distribution": _perms(DIST_DT)}


# ============================================================================
# link search (searchable dropdowns) — permission-checked per target doctype
# ============================================================================
@frappe.whitelist()
def search_link(kind, txt="", limit=20):
    _require_login()
    txt = (txt or "").strip()
    limit = min(int(limit or 20), 50)
    like = "%{0}%".format(txt)

    if kind == "supplier":
        _guard_read("Supplier")
        rows = frappe.get_all(
            "Supplier",
            filters={"supplier_group": FUEL_SUPPLIER_GROUP, "disabled": 0},
            or_filters=[["name", "like", like], ["supplier_name", "like", like]] if txt else None,
            fields=["name as value", "supplier_name as label"],
            order_by="supplier_name asc", limit_page_length=limit,
        )
    elif kind == "fuel_item":
        _guard_read("Item")
        rows = frappe.get_all(
            "Item",
            filters={"item_group": FUEL_ITEM_GROUP, "disabled": 0},
            or_filters=[["name", "like", like], ["item_name", "like", like]] if txt else None,
            fields=["name as value", "item_name as label"],
            order_by="item_name asc", limit_page_length=limit,
        )
    elif kind == "warehouse":
        _guard_read("Warehouse")
        rows = frappe.get_all(
            "Warehouse",
            filters={"company": DEFAULT_COMPANY, "is_group": 0, "disabled": 0},
            or_filters=[["name", "like", like]] if txt else None,
            fields=["name as value", "warehouse_name as label"],
            order_by="name asc", limit_page_length=limit,
        )
    elif kind == "vehicle":
        # Vehicle list is reference data needed to file a distribution. Show it to
        # ANY logged-in app user (the "Vehicle Details" doctype is otherwise limited
        # to System Manager). get_all does not apply user permissions, and we never
        # expose sensitive fields — only the vehicle name for the dropdown.
        rows = frappe.get_all(
            VEHICLE_DOCTYPE,
            or_filters=[["name", "like", like]] if txt else None,
            fields=["name as value", "name as label"],
            order_by="modified desc", limit_page_length=limit,
        )
    elif kind == "company":
        _guard_read("Company")
        rows = frappe.get_all(
            "Company",
            or_filters=[["name", "like", like]] if txt else None,
            fields=["name as value", "company_name as label"],
            order_by="name asc", limit_page_length=limit,
        )
    else:
        frappe.throw(_("Unknown link kind: {0}").format(kind))

    return rows


def _guard_read(dt):
    if not frappe.has_permission(dt, "read"):
        frappe.throw(_("Not permitted to read {0}").format(dt), frappe.PermissionError)


def _link_file(file_url, dt, dn):
    """Attach an uploaded private File to its parent Fuel document. Frappe then
    grants the file to any user who can READ that document — so proofs/invoices
    stay PRIVATE but open for authorised users (not just the uploader/admin)."""
    if not file_url:
        return
    fname = frappe.db.get_value("File", {"file_url": file_url}, "name")
    if fname:
        frappe.db.set_value(
            "File", fname,
            {"attached_to_doctype": dt, "attached_to_name": dn},
            update_modified=False,
        )


@frappe.whitelist()
def last_purchase_rate(vendor, item):
    """Most recent purchase rate for a supplier+item, so the Fuel for Stock form can
    prefill Rate/L when the vendor is chosen (mirrors the Desk get_last_purchase_rate)."""
    _require_login()
    if not vendor or not item:
        return {"rate": 0.0}
    rows = frappe.db.sql(
        """
        SELECT pri.rate
        FROM `tabPurchase Receipt Item` pri
        JOIN `tabPurchase Receipt` pr ON pr.name = pri.parent
        WHERE pr.supplier = %s AND pri.item_code = %s
        ORDER BY pr.posting_date DESC, pr.creation DESC
        LIMIT 1
        """,
        (vendor, item), as_dict=1,
    )
    return {"rate": _to_float(rows[0].rate) if rows else 0.0}


@frappe.whitelist()
def get_available_stock(item, warehouse=None):
    _require_login()
    if not (frappe.has_permission(DIST_DT, "read") or frappe.has_permission(STOCK_DT, "read")):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    warehouse = warehouse or DEFAULT_WAREHOUSE
    return {"item": item, "warehouse": warehouse,
            "available_stock": _available_stock_qty(item, warehouse)}


# ============================================================================
# LIST VIEWS
# ============================================================================
@frappe.whitelist()
def list_fuel_stock(limit=20, start=0, txt=""):
    _require_login()
    if not frappe.has_permission(STOCK_DT, "read"):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    txt = (txt or "").strip()
    or_filters = None
    if txt:
        like = "%{0}%".format(txt)
        # search by ID, vendor/supplier, fuel item, warehouse, company, bill number
        or_filters = [
            ["name", "like", like], ["vendor_name", "like", like],
            ["item", "like", like], ["warehouse", "like", like],
            ["company", "like", like], ["bill_number", "like", like],
        ]
    rows = frappe.get_list(
        STOCK_DT, or_filters=or_filters,
        fields=["name", "date_ffs", "vendor_name", "item", "quantity_ffs",
                "rateltr_ffs", "amountffs", "aamountffs", "warehouse",
                "purchase_receipt_ref", "purchase_invoice_ref", "docstatus", "modified"],
        order_by="modified desc",
        limit_start=int(start), limit_page_length=int(limit),
    )
    return [
        {
            "name": r.name, "date": str(r.date_ffs or ""), "vendor": r.vendor_name,
            "item": r.item, "quantity": _to_float(r.quantity_ffs),
            "rate": _to_float(r.rateltr_ffs),
            # fall back to quantity x rate so the amount always shows
            "amount": (_to_float(r.amountffs) or _to_float(r.aamountffs)
                       or round(_to_float(r.quantity_ffs) * _to_float(r.rateltr_ffs), 2)),
            "warehouse": r.warehouse, "docstatus": r.docstatus,
            "purchase_receipt_ref": r.purchase_receipt_ref,
            "purchase_invoice_ref": r.purchase_invoice_ref,
            "modified": str(r.modified),
        }
        for r in rows
    ]


@frappe.whitelist()
def list_fuel_distribution(limit=20, start=0, txt=""):
    _require_login()
    if not frappe.has_permission(DIST_DT, "read"):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    txt = (txt or "").strip()
    or_filters = None
    if txt:
        like = "%{0}%".format(txt)
        or_filters = [
            ["name", "like", like], ["fuel_type", "like", like],
            ["warehouse", "like", like], ["company", "like", like],
        ]
        # also match by vehicle number in the child rows
        child_parents = frappe.get_all(
            CHILD_DT, filters=[["parenttype", "=", DIST_DT], ["vehicle_details", "like", like]],
            pluck="parent", distinct=True,
        )
        if child_parents:
            or_filters.append(["name", "in", child_parents])
    rows = frappe.get_list(
        DIST_DT, or_filters=or_filters,
        fields=["name", "date", "fuel_type", "warehouse", "total_fuel_issued",
                "stock_entry_reference", "docstatus", "modified"],
        order_by="modified desc",
        limit_start=int(start), limit_page_length=int(limit),
    )
    return [
        {
            "name": r.name, "date": str(r.date or ""), "fuel_type": r.fuel_type,
            "warehouse": r.warehouse, "total_issued": _to_float(r.total_fuel_issued),
            "stock_entry_reference": r.stock_entry_reference,
            "docstatus": r.docstatus, "modified": str(r.modified),
        }
        for r in rows
    ]


@frappe.whitelist()
def get_fuel_stock(name):
    _require_login()
    doc = frappe.get_doc(STOCK_DT, name)
    doc.check_permission("read")
    return doc.as_dict()


@frappe.whitelist()
def get_fuel_distribution(name):
    _require_login()
    doc = frappe.get_doc(DIST_DT, name)
    doc.check_permission("read")
    return doc.as_dict()


# ============================================================================
# CREATE — Fuel for Stock
# ============================================================================
@frappe.whitelist()
def create_fuel_stock(data):
    _require_login()
    data = frappe.parse_json(data)

    doc = frappe.new_doc(STOCK_DT)
    doc.check_permission("create")

    doc.date_ffs = data.get("date_ffs") or frappe.utils.today()
    doc.vendor_name = data.get("vendor_name")
    doc.item = data.get("item")
    doc.quantity_ffs = _to_float(data.get("quantity_ffs"))
    doc.rateltr_ffs = _to_float(data.get("rateltr_ffs"))
    doc.warehouse = data.get("warehouse") or DEFAULT_WAREHOUSE
    doc.company = data.get("company") or DEFAULT_COMPANY
    doc.bill_number = data.get("bill_number")
    doc.remarks = data.get("remarks")

    inv = data.get("upload_invoice__invoice_copy")
    if inv:
        doc.upload_invoice__invoice_copy = inv
    proof = data.get("upload_fuel_station_proof__fuel_station_receipt")
    if proof:
        doc.upload_fuel_station_proof__fuel_station_receipt = proof

    # server-side required-field validation (mirror the Desk form)
    missing = [f for f in ("vendor_name", "item") if not doc.get(f)]
    if doc.quantity_ffs <= 0:
        missing.append("quantity_ffs")
    if doc.rateltr_ffs <= 0:
        missing.append("rateltr_ffs")
    if not doc.get("upload_invoice__invoice_copy"):
        missing.append("upload_invoice__invoice_copy")
    if missing:
        frappe.throw(_("Missing required fields: {0}").format(", ".join(missing)))

    # Amount = quantity x rate (the Desk form computes this in client JS, which does
    # not run for API inserts — so set it here so it is stored and shown everywhere).
    amt = round(doc.quantity_ffs * doc.rateltr_ffs, 2)
    doc.amountffs = amt
    doc.aamountffs = float(math.ceil(doc.quantity_ffs * doc.rateltr_ffs))

    # controller's after_insert() creates the Purchase Receipt + Purchase Invoice
    doc.insert()

    # link uploaded proofs to this doc so authorised readers can open them (private)
    _link_file(doc.get("upload_invoice__invoice_copy"), STOCK_DT, doc.name)
    _link_file(doc.get("upload_fuel_station_proof__fuel_station_receipt"), STOCK_DT, doc.name)

    doc.reload()
    return {
        "name": doc.name,
        "amount": _to_float(doc.get("amountffs")) or _to_float(doc.get("aamountffs")) or amt,
        "purchase_receipt_ref": doc.get("purchase_receipt_ref"),
        "purchase_invoice_ref": doc.get("purchase_invoice_ref"),
        "docstatus": doc.docstatus,
    }


# ============================================================================
# CREATE — Fuel for Distribution
# ============================================================================
@frappe.whitelist()
def create_fuel_distribution(data):
    _require_login()
    data = frappe.parse_json(data)

    doc = frappe.new_doc(DIST_DT)
    doc.check_permission("create")

    doc.date = data.get("date") or frappe.utils.today()
    doc.fuel_type = data.get("fuel_type")
    doc.warehouse = data.get("warehouse") or DEFAULT_WAREHOUSE
    doc.company = data.get("company") or DEFAULT_COMPANY
    doc.attachment = data.get("attachment")
    doc.remarks = data.get("remarks")

    if not doc.fuel_type:
        frappe.throw(_("Fuel type is required."))

    total = 0.0
    rows = data.get("vehicle_details") or data.get("rows") or []
    for row in rows:
        issued = _to_float(row.get("fuel_issued"))
        total += issued
        doc.append("vehicle_details", {
            CHILD_VEHICLE: row.get("vehicle") or row.get("vehicle_details"),
            CHILD_ISSUED: issued,
            CHILD_ODO: _to_float(row.get("odometer_reading")),
            CHILD_PROOF: row.get("upload_proof"),
        })

    if total <= 0:
        frappe.throw(_("Total fuel issued must be greater than 0."))

    avail = _available_stock_qty(doc.fuel_type, doc.warehouse)
    if avail is not None and total > avail:
        frappe.throw(_("Total fuel issued ({0} L) exceeds available stock ({1} L).")
                     .format(round(total, 2), round(avail, 2)))

    # Store the available stock at time of entry (Data field) so it shows on the
    # ERPNext Desk list view too — the Desk form fills this via client JS, which
    # does not run for API inserts.
    doc.available_stock = str(round(avail, 2)) if avail is not None else None

    # the Distribution controller REQUIRES total_fuel_issued to be set before insert,
    # then its after_insert() creates the submitted Stock Entry.
    doc.total_fuel_issued = total
    doc.insert()

    # link uploaded proofs (main attachment + each vehicle-row proof) to this doc
    _link_file(doc.get("attachment"), DIST_DT, doc.name)
    for row in doc.get("vehicle_details") or []:
        _link_file(row.get(CHILD_PROOF), DIST_DT, doc.name)

    doc.reload()
    return {
        "name": doc.name,
        "total_fuel_issued": _to_float(doc.get("total_fuel_issued")) or total,
        "stock_entry_reference": doc.get("stock_entry_reference"),
        "docstatus": doc.docstatus,
    }


# recent activity (used by boot + a possible Home refresh)
def _recent_activity(limit=8):
    out = []
    if frappe.has_permission(STOCK_DT, "read"):
        for r in frappe.get_list(
            STOCK_DT,
            fields=["name", "vendor_name", "item", "quantity_ffs", "amountffs",
                    "aamountffs", "docstatus", "modified"],
            order_by="modified desc", limit_page_length=limit,
        ):
            out.append({
                "doctype": STOCK_DT, "name": r.name, "kind": "in",
                "title": r.vendor_name or "Fuel purchase", "fuel": r.item,
                "litres": _to_float(r.quantity_ffs),
                "amount": _to_float(r.amountffs) or _to_float(r.aamountffs),
                "docstatus": r.docstatus, "modified": str(r.modified),
            })
    if frappe.has_permission(DIST_DT, "read"):
        for r in frappe.get_list(
            DIST_DT,
            fields=["name", "fuel_type", "total_fuel_issued", "docstatus", "modified"],
            order_by="modified desc", limit_page_length=limit,
        ):
            out.append({
                "doctype": DIST_DT, "name": r.name, "kind": "out",
                "title": "Fuel distribution", "fuel": r.fuel_type,
                "litres": _to_float(r.total_fuel_issued), "amount": None,
                "docstatus": r.docstatus, "modified": str(r.modified),
            })
    out.sort(key=lambda x: x["modified"], reverse=True)
    return out[:limit]


@frappe.whitelist()
def list_recent_activity(limit=20):
    _require_login()
    return _recent_activity(int(limit))


# ============================================================================
# file upload (base64/JSON) — avoids multipart over the native HTTP bridge
# ============================================================================
@frappe.whitelist()
def upload_file_b64(filename, data_b64, is_private=1):
    """Save a base64-encoded file and return its file_url. The app reads the
    picked/captured file as base64 and sends it here; the returned file_url is
    then stored on the Attach field of the Fuel document."""
    _require_login()
    import base64
    if not (frappe.has_permission(STOCK_DT, "create") or frappe.has_permission(DIST_DT, "create")):
        frappe.throw(_("Not permitted"), frappe.PermissionError)

    # strip a possible data: URL prefix
    if "," in data_b64 and data_b64[:5] == "data:":
        data_b64 = data_b64.split(",", 1)[1]
    content = base64.b64decode(data_b64)

    if len(content) > 15 * 1024 * 1024:
        frappe.throw(_("File too large (max 15 MB)."))

    safe_name = frappe.utils.random_string(6) + "_" + (filename or "upload.bin").replace("/", "_")[:120]
    f = frappe.get_doc({
        "doctype": "File",
        "file_name": safe_name,
        "is_private": 1 if int(is_private or 0) else 0,
        "content": content,
    })
    f.insert(ignore_permissions=True)
    return {"file_url": f.file_url, "file_name": f.file_name, "name": f.name}
