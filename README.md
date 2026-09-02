# Qigong WhatsApp Bot

WhatsApp Business Platform one-to-one MVP for daily Qigong check-ins.

## Features

- Verified Meta Cloud API webhook with raw-body HMAC validation.
- Durable, deduplicated webhook inbox and delivery status tracking.
- One-to-one commands for check-in links, statistics, and reminder consent.
- Single-use magic-link authentication with server-side sessions.
- Mobile Web App for check-ins, history, statistics, and reminder settings.
- Timezone-aware, opt-in template reminders with daily deduplication.

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
4. Set `META_APP_SECRET`, `META_ACCESS_TOKEN`, and `META_PHONE_NUMBER_ID`.
5. Submit `WHATSAPP_REMINDER_TEMPLATE` for approval before enabling reminders.
6. Ensure the approved reminder template language matches `WHATSAPP_REMINDER_TEMPLATE_LANGUAGE`.

The default reminder template has no variables or buttons. Users can reply with `打卡` to receive a fresh one-time Web App link within the customer-service window.

## Commands

- `打卡` or `checkin`
- `統計` or `stats`
- `提醒`
- `提醒開啟`
- `提醒關閉`
- `選單` or `menu`

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
