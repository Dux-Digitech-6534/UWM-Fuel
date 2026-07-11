# Copyright (c) 2026, Abhijeet and contributors
# For license information, please see license.txt

# # import frappe
# from frappe.model.document import Document


# class FuelforDIstribution(Document):
# 	pass


# import frappe
# from frappe.model.document import Document


# class FuelforDistribution(Document):

#     # =====================================================
#     # AFTER INSERT (FIRST SAVE)
#     # =====================================================
#     def after_insert(self):
#         try:
#             self.create_stock_entry()
#         except Exception:
#             frappe.log_error(
#                 frappe.get_traceback(),
#                 "Fuel for Distribution - Stock Entry Creation Failed"
#             )
#             frappe.throw("Stock Entry creation failed. Please check error log.")


#     # =====================================================
#     # CREATE STOCK ENTRY
#     # =====================================================
#     def create_stock_entry(self):

#         # Duplicate protection
#         if self.stock_entry_reference:
#             return

#         if not self.item or not self.warehouse:
#             frappe.throw("Item and Warehouse are required.")

#         if not self.issued_quantity_ltr or self.issued_quantity_ltr <= 0:
#             frappe.throw("Issued Quantity must be greater than 0.")

#         stock_entry = frappe.new_doc("Stock Entry")
#         stock_entry.stock_entry_type = "Material Issue"
#         stock_entry.company = self.company
#         stock_entry.posting_date = self.date
#         stock_entry.set_posting_time = 1

#         # Custom reference fields (must exist in Stock Entry)
#         stock_entry.source_type = "Fuel for Distribution"
#         stock_entry.source_reference = self.name

#         stock_entry.append("items", {
#             "item_code": self.item,
#             "qty": self.issued_quantity_ltr,
#             "s_warehouse": self.warehouse,
#             "allow_zero_valuation_rate": 0
#         })

#         stock_entry.insert(ignore_permissions=True)
#         stock_entry.submit()

#         # Save reference back
#         self.db_set("stock_entry_reference", stock_entry.name)

#         frappe.msgprint(
#             f"Stock Entry <b>{stock_entry.name}</b> created successfully."
#         )


#     # =====================================================
#     # ON DELETE → CANCEL STOCK ENTRY
#     # =====================================================
#     def on_trash(self):

#         if not self.stock_entry_reference:
#             return

#         try:
#             stock_entry = frappe.get_doc("Stock Entry", self.stock_entry_reference)

#             if stock_entry.docstatus == 1:
#                 stock_entry.cancel()

#         except Exception:
#             frappe.log_error(
#                 frappe.get_traceback(),
#                 "Fuel for Distribution - Cancel Failed"
#             )
#             frappe.throw("Unable to cancel linked Stock Entry.")


import frappe
from frappe.model.document import Document
from frappe.utils import add_days, nowdate


class FuelforDistribution(Document):

    # =====================================================
    # STOCK ENTRY IS CREATED ONLY WHEN THE ENTRY IS APPROVED
    # (approval_status == "Approved"). A Draft / Pending Approval entry never
    # moves stock. Works for both Desk and the mobile approval flow.
    # =====================================================
    def validate(self):
        # Approval can be done from the mobile app OR here in Desk. Guard it:
        #  - only a Fuel Final Approver (or System Manager) may set "Approved"
        #  - stamp approved_by / approved_on automatically
        #  - once Approved, the entry is locked (no further edits)
        old = self.get_doc_before_save()
        old_status = old.approval_status if old else None

        if old_status == "Approved":
            frappe.throw("This entry is approved and locked — it cannot be edited.")

        if self.approval_status == "Approved" and old_status != "Approved":
            roles = frappe.get_roles()
            if "Fuel Final Approver" not in roles and "System Manager" not in roles:
                frappe.throw("Only a Fuel Final Approver can approve this entry.")
            if not self.approved_by:
                self.approved_by = frappe.session.user
            if not self.approved_on:
                self.approved_on = frappe.utils.now_datetime()

    def after_insert(self):
        self._create_stock_entry_if_approved()

    def on_update(self):
        self._create_stock_entry_if_approved()

    def _create_stock_entry_if_approved(self):
        if (self.get("approval_status") or "Draft") != "Approved":
            return
        if self.stock_entry_reference:
            return
        try:
            self.create_stock_entry()
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                "Fuel for Distribution - Stock Entry Creation Failed"
            )
            frappe.throw("Stock Entry creation failed. Please check error log.")


    # =====================================================
    # CREATE STOCK ENTRY
    # =====================================================
    def create_stock_entry(self):

        # Duplicate protection
        if self.stock_entry_reference:
            return

        # ✅ Correct field names
        if not self.fuel_type or not self.warehouse:
            frappe.throw("Fuel Type and Warehouse are required.")

        # total_fuel_issued is a Data (string) field — cast before comparing/using.
        qty = float(self.total_fuel_issued or 0)
        if qty <= 0:
            frappe.throw("Total Fuel Issued must be greater than 0.")

        stock_entry = frappe.new_doc("Stock Entry")
        stock_entry.stock_entry_type = "Material Issue"
        stock_entry.company = self.company
        stock_entry.posting_date = self.date
        # stock_entry.posting_time = frappe.utils.nowtime()  # ✅ ADD THIS
        stock_entry.posting_time = "23:59:59"
        stock_entry.set_posting_time = 1

        # Custom reference
        stock_entry.source_type = "Fuel for Distribution"
        stock_entry.source_reference = self.name

        # ✅ Updated mapping
        stock_entry.append("items", {
            "item_code": self.fuel_type,
            "qty": qty,
            "s_warehouse": self.warehouse,
            "allow_zero_valuation_rate": 0
        })

        stock_entry.insert(ignore_permissions=True)
        stock_entry.submit()

        # Save reference back
        self.db_set("stock_entry_reference", stock_entry.name)

        frappe.msgprint(
            f"Stock Entry <b>{stock_entry.name}</b> created successfully."
        )


    # =====================================================
    # ON DELETE → CANCEL STOCK ENTRY
    # =====================================================
    def on_trash(self):

        if not self.stock_entry_reference:
            return

        try:
            stock_entry = frappe.get_doc("Stock Entry", self.stock_entry_reference)

            if stock_entry.docstatus == 1:
                stock_entry.cancel()

        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                "Fuel for Distribution - Cancel Failed"
            )
            frappe.throw("Unable to cancel linked Stock Entry.")




