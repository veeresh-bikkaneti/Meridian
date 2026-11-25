# Meridian crash-report watchdog

Goal ID: goal_9d695ae849f3
Goal slug: meridian-crash-report-watchdog

## Description
Meridian gets a crash-report fallback: an inline ES5 watchdog in _shell.html shows "The game couldn't start on this phone" with a report button when the bundle never boots. Reports feed the existing observability pipeline through a new CORS-enabled Cloudflare Worker receiver, with no email or secrets in client code.
