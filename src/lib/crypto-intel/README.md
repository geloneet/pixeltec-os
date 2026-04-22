# Crypto Intel Module — Developer Reference

## Architecture

```
src/lib/crypto-intel/
├── types.ts              # Central type definitions
├── firebase-admin.ts     # Firestore bridge + COL constants
├── watchlist.ts          # Tracked assets
├── price-engine.ts       # CoinGecko price sync
├── alert-engine.ts       # Alert rule evaluation (cron)
├── logger.ts             # Structured logging to Firestore
├── auth.ts               # Session + admin guard helpers
├── schemas/
│   ├── alert.ts          # Zod schemas for alert CRUD
│   └── user.ts           # Zod schemas for Telegram user management
├── queries/
│   ├── alerts.ts         # Read queries: alertRules, alerts
│   ├── logs.ts           # Read queries: cryptoIntelLogs + metrics
│   └── users.ts          # Read queries: telegramUsers
├── actions/
│   ├── alerts.ts         # Server Actions: create/update/toggle/delete alert
│   ├── users.ts          # Server Actions: authorize/deauthorize Telegram user
│   └── admin.ts          # Server Actions: force sync/evaluate (admin only)
└── telegram/             # grammY bot handlers
```

---

## How to add a new alert condition type

1. **Add to `AlertType` union** in `types.ts`:
   ```typescript
   export type AlertType = "price_below" | "price_above" | "change_percent"
     | "rsi_extreme" | "ma_cross" | "volume_spike"
     | "your_new_type";   // <-- add here
   ```

2. **Add evaluation logic** in `alert-engine.ts` inside `evaluateRule()`:
   ```typescript
   case "your_new_type": {
     // implement condition, return { triggered: true, message: "..." }
     break;
   }
   ```

3. **Add to `AlertConditionSchema`** in `schemas/alert.ts` if it should be selectable from the UI:
   ```typescript
   export const AlertConditionSchema = z.enum([
     "price_above", "price_below", "change_percent", "your_new_type"
   ]);
   ```

4. **Add label** to `TYPE_LABELS` in `alert-form.tsx`:
   ```typescript
   your_new_type: "Tu nueva condición",
   ```

5. **Add badge style** in `alerts-table.tsx` inside `ConditionBadge`.

---

## How to add a new admin tile

1. Create `src/components/crypto-intel/admin/your-tile.tsx` — `"use client"`, accepts server-fetched data as props.
2. Fetch data in `src/app/(admin)/crypto-intel/admin/page.tsx` (add to `Promise.all`).
3. Import and render `<YourTile />` inside the grid in `admin/page.tsx`.

---

## How to add a new log source

1. Add to `LogSource` union in `logger.ts`:
   ```typescript
   export type LogSource = "price-sync" | "alert-engine" | "telegram-webhook" | "admin" | "your-source";
   ```

2. Import `log` and call it in your module:
   ```typescript
   import { log } from "@/lib/crypto-intel/logger";
   await log("your-source", "info", "Message", { metadata });
   ```

3. Add the source to `SOURCES` in `logs-tile.tsx` so it appears as a filter tab.

---

## Firestore indexes required

| Collection    | Fields                              | Purpose                        |
|---------------|-------------------------------------|--------------------------------|
| `alertRules`  | `deletedAt` ASC + `createdAt` DESC  | `listAlerts()` default query   |
| `alerts`      | `ruleId` ASC + `createdAt` DESC     | `getAlertHistory()` per rule   |
| `cryptoIntelLogs` | `source` ASC + `timestamp` DESC | `listLogs({ source })`        |
| `cryptoIntelLogs` | `level` ASC + `timestamp` DESC  | `listLogs({ level })`         |
| `alerts`      | `createdAt` ASC                     | `getMetrics()` 24h count       |

The code includes `.catch()` fallbacks that degrade gracefully when indexes are missing — create them in the Firebase Console to enable full filtering.

---

## Environment variables

No new environment variables are required for Phase 3A. All existing vars apply:

| Variable | Purpose |
|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | Firestore project |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account key |
| `CRON_SECRET` | Auth for cron endpoints |
| `TELEGRAM_BOT_TOKEN` | Bot token |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook validation |
