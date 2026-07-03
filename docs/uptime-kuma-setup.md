# Uptime Kuma — настройка мониторов для AziralPDF

Открой: **https://uptime.cybersecurity.aziral.com** (войди через Authentik SSO).

При первом входе создаст admin-аккаунт. Сохрани пароль в `~/hacking-aziral/.env` отдельной строкой `UPTIME_KUMA_ADMIN=...` (через нашу схему env-vars, не хардкодить).

## Мониторы, которые нужно добавить

Каждый — кнопка `Add New Monitor`. Все основные параметры — ниже.

### 1. PDF service — HTTP smoke

| Поле | Значение |
|---|---|
| **Monitor Type** | HTTP(s) |
| **Friendly Name** | AziralPDF · login page |
| **URL** | `https://pdf.aziral.com/login` |
| **Heartbeat Interval** | 60 sec |
| **Retries** | 2 |
| **Heartbeat Retry Interval** | 30 sec |
| **Resend Notification** | every 3 failed heartbeats |
| **Expected Status Codes** | `200-299` |
| **Accept HTTPS Errors** | NO |

### 2. PDF service — internal health endpoint

| Поле | Значение |
|---|---|
| **Monitor Type** | HTTP(s) |
| **Friendly Name** | AziralPDF · API /info/status |
| **URL** | `https://pdf.aziral.com/api/v1/info/status` |
| **Heartbeat Interval** | 60 sec |
| **Expected Status Codes** | `200-299` |

### 3. Login flow (catch DB / auth crashes)

| Поле | Значение |
|---|---|
| **Monitor Type** | HTTP(s) — Keyword |
| **Friendly Name** | AziralPDF · auth login |
| **URL** | `https://pdf.aziral.com/api/v1/auth/login` |
| **Method** | POST |
| **Body** (raw, set Content-Type to application/json) | `{"username":"healthcheck-probe","password":"will-fail"}` |
| **Keyword** | `Invalid username or password` |
| **Heartbeat Interval** | 120 sec |
| **Expected Status Codes** | `401` |

Логика: ждём ровно ответ "неверный пароль" — это значит цепочка auth+JWT+DB жива. Если получим 5xx или другой текст — значит что-то упало.

### 4. Legal pages (4 страницы скопом)

Сделай 4 отдельных монитора или используй один со скриптом — для простоты 4:

- `https://pdf.aziral.com/legal/offer` — Keyword `Договор`
- `https://pdf.aziral.com/legal/terms` — Keyword `Условия`
- `https://pdf.aziral.com/legal/privacy` — Keyword `Конфиденциальности`
- `https://pdf.aziral.com/legal/cookies` — Keyword `cookie`

Interval 5 min — статика, незачем чаще.

### 5. SSL expiry

| Поле | Значение |
|---|---|
| **Monitor Type** | HTTP(s) |
| **Friendly Name** | AziralPDF · SSL |
| **URL** | `https://pdf.aziral.com` |
| **Notify Certificate Expiry** | YES (warn 21 days, alert 7 days) |

### 6. Disk space (на сервере)

| Поле | Значение |
|---|---|
| **Monitor Type** | Push |
| **Friendly Name** | Server · disk |
| **Heartbeat Interval** | 300 sec |

После создания скопируй `Push URL`, повесь в cron на сервер:
```cron
*/4 * * * * df -h / | awk 'NR==2 && int($5)<85 {exit 0} NR==2 {exit 1}' && curl -fsS '<PUSH_URL>' >/dev/null
```
Push улетит только если диск <85% занят.

## Notifications

`Settings → Notifications → Setup Notification`

### Telegram (рекомендую)

1. В Telegram пиши **@BotFather** → `/newbot` → имя, например `AziralPDFAlerts` → дай username с суффиксом `_bot` → получишь токен вида `123456:ABC-DEF...`.
2. В Telegram добавь бота себе в чат, напиши ему любое сообщение.
3. Открой `https://api.telegram.org/bot<TOKEN>/getUpdates` → в JSON найди `"chat":{"id": ...}` — это твой chat_id.
4. В Uptime Kuma:
   - **Notification Type:** Telegram
   - **Friendly Name:** Telegram AziralPDF
   - **Bot Token:** `<TOKEN>`
   - **Chat ID:** `<CHAT_ID>`
   - `Test` → должно прилететь сообщение
5. `Apply on all existing monitors` ✅

### Email (опционально, как дублирование)

`Settings → Notifications → Email (SMTP)` — пропиши SMTP своего почтового провайдера. Telegram надёжнее: SMS-точность доставки, не уйдёт в спам.

## Status Page (публичный для клиентов — опционально)

`Status Pages → New Status Page` → `aziralpdf` → выбери мониторы PDF + Legal (без disk/SSL — это internal). Получишь `https://uptime.cybersecurity.aziral.com/status/aziralpdf` — но это subdomain не для клиентов.

Если хочешь дать клиентам публичный статус на `pdf.aziral.com/status` — это отдельный Traefik route, скажи если надо настрою.
