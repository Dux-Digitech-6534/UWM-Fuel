// Client Script (Fuel for Distribution, Form view) — "UWM Fuel — Approve button"
// Adds a green Approve button in Desk for Fuel Final Approver / System Manager on
// Pending Approval entries. Clicking sets approval_status=Approved and saves, which
// triggers the controller to create the Stock Entry.
frappe.ui.form.on('Fuel for Distribution', {
    refresh(frm) {
        if (frm.is_new()) return;
        const roles = frappe.user_roles || [];
        const isApprover = roles.includes('Fuel Final Approver') || roles.includes('System Manager');
        if (isApprover && frm.doc.approval_status === 'Pending Approval') {
            frm.add_custom_button('✔ Approve', () => {
                frappe.confirm('Approve this fuel distribution? This will issue the stock (create the Stock Entry).', () => {
                    frm.set_value('approval_status', 'Approved');
                    frm.save().then(() => frappe.show_alert({message: 'Approved — stock issued', indicator: 'green'}));
                });
            }).addClass('btn-primary');
        }
        if (frm.doc.approval_status === 'Approved') {
            frm.dashboard.set_headline_alert('Approved & locked — stock issued.', 'green');
        }
    }
});
