# waste_management_ujjain/www/uwm_fuel.py
# Host page for the UWM Fuel SPA. Guests may load the page; the app itself shows
# the login screen and every backend method enforces permissions server-side.
no_cache = 1


def get_context(context):
    context.no_cache = 1
    return context
