# ubuntu1 WhatsApp Bot 部署與打卡驗收

本文件將 `qigong-whatsapp-bot` 部署到既有 `ubuntu1` 架構：

- LINE：`127.0.0.1:3000`
- Telegram：`127.0.0.1:3001`
- WhatsApp：`127.0.0.1:3002`
- Caddy：`127.0.0.1:8080`
- 公開入口：`https://ubuntu1.tailbf9b8d.ts.net`
- PostgreSQL container：`qigong_db`

## 1. Meta 端先準備的資料

前往 [Meta for Developers](https://developers.facebook.com/) 建立或開啟 App，加入 WhatsApp 產品。從 WhatsApp API Setup 及 App Settings 取得：

- App Secret，對應 `META_APP_SECRET`
- Phone number ID，對應 `META_PHONE_NUMBER_ID`，不是顯示的電話號碼
- Access token，對應 `META_ACCESS_TOKEN`
- 自行產生的 webhook verify token，對應 `META_VERIFY_TOKEN`

測試階段可先使用 Meta 測試號碼及 temporary access token，並在 API Setup 將自己的 WhatsApp 號碼加入允許的測試收件人。正式環境應改用 Business Settings 的 system user token，授予所需的 `whatsapp_business_messaging` 權限；管理 WABA 時另需 `whatsapp_business_management`。

產生 webhook verify token：

```bash
openssl rand -hex 32
```

保存輸出，之後必須同時填入 `.env` 和 Meta webhook 設定。

## 2. Clone 與安裝

```bash
mkdir -p ~/Devel
cd ~/Devel
git clone https://github.com/myhsu7/qigong-whatsapp-bot.git
cd qigong-whatsapp-bot
npm ci
```

確認版本：

```bash
node --version
npm --version
pm2 --version
docker ps --filter name=qigong_db
```

Node.js 必須為 20 以上，`qigong_db` 必須處於 running 狀態。

## 3. 建立獨立資料庫

第一次部署執行：

```bash
docker exec qigong_db createdb -U qigong_user qigong_whatsapp_bot
```

如果顯示 database already exists，可直接繼續。確認資料庫存在：

```bash
docker exec qigong_db psql -U qigong_user -d qigong_whatsapp_bot -c 'SELECT current_database();'
```

## 4. 建立 `.env`

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

至少填入以下內容：

```ini
NODE_ENV=production
PORT=3002
PUBLIC_BASE_URL=https://ubuntu1.tailbf9b8d.ts.net
DATABASE_URL=postgresql://qigong_user:YOUR_DATABASE_PASSWORD@127.0.0.1:5432/qigong_whatsapp_bot

META_GRAPH_VERSION=v23.0
META_APP_SECRET=YOUR_META_APP_SECRET
META_VERIFY_TOKEN=YOUR_RANDOM_VERIFY_TOKEN
META_ACCESS_TOKEN=YOUR_META_ACCESS_TOKEN
META_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID

WHATSAPP_REMINDER_ENABLED=false
WHATSAPP_REMINDER_TEMPLATE=qigong_daily_checkin_reminder
WHATSAPP_REMINDER_TEMPLATE_LANGUAGE=zh_TW
SESSION_TTL_HOURS=168
MAGIC_LINK_TTL_MINUTES=15
```

`DATABASE_URL` 的密碼要使用 `ubuntu1` 上 `qigong_db` 的實際密碼。初次測試保持 `WHATSAPP_REMINDER_ENABLED=false`，不必等待提醒範本核准即可測試打卡。

## 5. Migration、build 與 PM2

```bash
npm run migrate
npm run build
npm test
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
```

確認服務：

```bash
pm2 status qigong-whatsapp-bot
pm2 logs qigong-whatsapp-bot --lines 100
curl http://127.0.0.1:3002/
curl http://127.0.0.1:3002/whatsapp/health/ready
```

readiness 預期回應：

```json
{"ok":true}
```

若 PM2 顯示 errored，通常是 `.env` 缺少 production 必填值；查看 PM2 log 可看到缺少的變數名稱。

## 6. 加入 Caddy routing

編輯 `/etc/caddy/Caddyfile`，在最後的 fallback `handle` 之前加入：

```caddy
handle /whatsapp/* {
    reverse_proxy 127.0.0.1:3002
}
```

不要使用 `handle_path`，否則 `/whatsapp` prefix 會被移除。

驗證並重新載入：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl http://127.0.0.1:8080/whatsapp/health/ready
curl https://ubuntu1.tailbf9b8d.ts.net/whatsapp/health/ready
tailscale funnel status
```

若既有 Funnel 不是指向 8080：

```bash
tailscale funnel reset
tailscale funnel 8080
```

注意：重設 Funnel 會短暫影響既有 LINE 和 Telegram，正常情況不需要重設。

## 7. Meta webhook 設定

在 Meta App Dashboard 的 WhatsApp Configuration 設定：

- Callback URL：`https://ubuntu1.tailbf9b8d.ts.net/whatsapp/webhook`
- Verify token：與 `.env` 的 `META_VERIFY_TOKEN` 完全相同
- Webhook field：訂閱 `messages`

按下 Verify and Save。驗證失敗時依序檢查：

```bash
curl https://ubuntu1.tailbf9b8d.ts.net/whatsapp/health/ready
pm2 logs qigong-whatsapp-bot --lines 100
journalctl -u caddy -n 100 --no-pager
tailscale funnel status
```

如果 App Dashboard 要求選擇 WABA，確認 webhook subscription 已套用到目前測試號碼所屬的 WhatsApp Business Account。

## 8. 完整打卡驗收

使用已加入 Meta 測試收件人的 WhatsApp 號碼，傳訊息給 Meta 提供的測試號碼：

```text
選單
```

接著測試：

1. 傳送 `打卡`。
2. Bot 應回覆 15 分鐘有效的一次性 HTTPS 連結。
3. 開啟連結，選擇至少一個功法並送出。
4. Web App 應顯示打卡成功。
5. WhatsApp 應收到打卡摘要。
6. 再傳送 `統計`，累計天數應為 1。
7. 再次使用新連結修改同日打卡，累計天數仍應為 1。
8. 重開已使用過的一次性連結，應顯示連結無效。

檢查資料庫：

```bash
docker exec qigong_db psql -U qigong_user -d qigong_whatsapp_bot -c 'SELECT wa_id, profile_name, last_inbound_at FROM whatsapp_users ORDER BY last_inbound_at DESC LIMIT 5;'
docker exec qigong_db psql -U qigong_user -d qigong_whatsapp_bot -c 'SELECT wa_id, checkin_date, note FROM whatsapp_checkin_logs ORDER BY created_at DESC LIMIT 5;'
docker exec qigong_db psql -U qigong_user -d qigong_whatsapp_bot -c 'SELECT message_id, processed_at, last_error FROM whatsapp_inbound_messages ORDER BY received_at DESC LIMIT 10;'
```

## 9. 每日提醒稍後啟用

先在 WhatsApp Manager 建立並送審 utility template，例如名稱：

```text
qigong_daily_checkin_reminder
```

建議內容：

```text
這是您設定的每日氣功打卡提醒。完成練功後，請回覆「打卡」進行記錄；若要停止提醒，請回覆「提醒關閉」。
```

核准後確認 template 名稱與語言和 `.env` 一致，再修改：

```ini
WHATSAPP_REMINDER_ENABLED=true
```

重新載入：

```bash
pm2 restart qigong-whatsapp-bot --update-env
```

使用者仍需先傳送 `提醒開啟` 明確 opt-in，預設不會收到提醒。

## 10. 更新版本

```bash
cd ~/Devel/qigong-whatsapp-bot
git pull origin main
npm ci
npm run migrate
npm run build
npm test
pm2 restart qigong-whatsapp-bot --update-env
```

## 11. 常見問題

- Webhook Verify 403：Meta verify token 與 `.env` 不一致。
- Webhook POST 401：App Secret 錯誤，導致 `X-Hub-Signature-256` 驗證失敗。
- Bot 收到訊息但不回覆：檢查 access token、Phone number ID 及 PM2 logs。
- Web App 401：magic link 已使用、超過 15 分鐘，或 session cookie 過期；回 WhatsApp 再傳 `打卡`。
- Meta API 131047：通常代表超過客服視窗卻嘗試傳送非範本訊息；請讓使用者先主動傳訊。
- Meta 測試號碼無法傳送：確認自己的號碼已加入 API Setup 的測試收件人清單。
- readiness 顯示 database unavailable：檢查 `qigong_db`、5432 port 和 `DATABASE_URL`。
