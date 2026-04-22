# Variables de entorno para Crypto Intelligence

## Requeridas (agregar a .env.production y .env.local)

TELEGRAM_BOT_TOKEN=<token del bot de @BotFather>
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 32>

## Ya existentes (no agregar de nuevo)

CRON_SECRET=<ya está en .env.production>
FIREBASE_ADMIN_PROJECT_ID=<ya está>
FIREBASE_ADMIN_CLIENT_EMAIL=<ya está>
FIREBASE_ADMIN_PRIVATE_KEY=<ya está>

## Después del deploy, configurar webhook de Telegram:

curl -F "url=https://pixeltec.mx/api/crypto-intel/telegram/webhook" \
     -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
     https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
