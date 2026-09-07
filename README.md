# Qigong WhatsApp Bot

WhatsApp Business Platform one-to-one MVP for daily Qigong check-ins.

## Features

- Verified Meta Cloud API webhook with raw-body HMAC validation.
- Durable, deduplicated webhook inbox and delivery status tracking.
- Exponential webhook retry with explicit dead-letter and queue health reporting.
- One-to-one commands for check-in links, statistics, and reminder consent.
- Interactive menus linking to the unified Web Dashboard.
- Single-use magic-link authentication with server-side sessions.
- Mobile Web App for check-ins, history, statistics, and reminder settings.
- Four practice levels, 49 persistent achievement badges, and retroactive badge reconciliation.
- Month-by-month check-in calendar with localized practice details.
- Timezone-aware, opt-in template reminders with daily deduplication.
- Traditional Chinese, Simplified Chinese, and English bot and Web App interfaces.

The WhatsApp Cloud API does not expose the user's WhatsApp interface language in inbound webhooks. On first contact, the bot detects unambiguous English or Chinese text; otherwise it asks the user to choose a language. The saved preference controls future bot replies, method names, the Web App, and reminder templates. Send `語言`, `语言`, or `language` to change it.

Groups are intentionally excluded. Meta Groups API requires an Official Business Account and currently limits groups to eight participants.

## Local setup

Requirements: Node.js 20+ and PostgreSQL 15+.

```bash
cp .env.example .env
npm install
createdb qigong_whatsapp_bot
npm run migrate
npm run dev
```

Configure `PUBLIC_BASE_URL` with the public HTTPS origin. The Meta webhook URL is:

```text
https://your-domain.example/whatsapp/webhook
```

Use `META_VERIFY_TOKEN` while registering the webhook and subscribe the WABA to `messages` events.

## Meta setup

1. Create a Meta app with WhatsApp Business Platform enabled.
2. Add or register a business phone number.
3. Create a system user token with the required WhatsApp permissions.
4. Set `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, and `WHATSAPP_BUSINESS_NUMBER` (E.164 digits only, without `+`).
5. Submit the three configured reminder templates for approval before enabling reminders.
6. Ensure each approved template name and language matches the corresponding `WHATSAPP_REMINDER_TEMPLATE_*` settings.

The default reminder template has no variables or buttons. Users can reply with `打卡` to receive a fresh one-time Web App link within the customer-service window.

## Commands

- `打卡` or `checkin`
- `統計` or `stats`
- `提醒`
- `提醒開啟`
- `提醒關閉`
- `選單` or `menu`
- `語言`, `语言`, or `language`

`選單` / `菜单` / `menu` returns an interactive menu and a single-use Dashboard link. Runtime diagnostics are available at `/whatsapp/health/meta` and `/whatsapp/health/queue`; responses never include access tokens or phone numbers.

After a successful Web App check-in, the page attempts to close the in-app browser and then falls back to `/whatsapp/webapp/return`, which redirects to the configured WhatsApp business chat.

## Production

```bash
npm ci
npm run build
npm run migrate
pm2 startOrReload ecosystem.config.js
```

Add the route in `docs/Caddyfile.example` to the existing Caddy configuration. Keep `.env`, access tokens, phone numbers, journal text, raw webhook bodies, and magic-link tokens out of logs and source control.

Run a Meta test-number beta before registering the production number.

For the complete `ubuntu1` clone, Caddy, Funnel, Meta webhook, and end-to-end check-in procedure, see [`docs/ubuntu1_setup.md`](docs/ubuntu1_setup.md).
