# ============================================
# PixelTEC OS — Production Dockerfile
# Next.js 15 Standalone + Alpine
# ============================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for Firebase config (injected at build time)
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

RUN npm run build

# Stage 3: Tools — migraciones Drizzle / seed (bajo demanda, perfil "tools" en docker-compose)
FROM node:20-alpine AS tools
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Stage 3b: qa-runner — servicio Playwright de QA de navegador (PixelForge
# F8-T6). Base OFICIAL de Microsoft con Chromium + deps de sistema YA
# instaladas — el PIN de versión (v1.61.1) debe coincidir EXACTO con la
# versión de `playwright` fijada en `package.json` (devDependencies), o el
# navegador embebido en la imagen no calza con el cliente Node que lo maneja.
# `npx tsx` (ya en devDependencies) resuelve los paths `@/` de tsconfig.json
# igual que `scripts/pixelforge-schema-smoke.ts` — sin paso de build propio.
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS qa-runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
CMD ["npx", "tsx", "scripts/qa-runner/index.ts"]

# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# El worker de generación de PDF de propuestas (src/lib/documents/pdf-render-worker)
# se invoca vía child_process, no vía require/import estático, así que el tracer
# de standalone de Next.js no captura de forma confiable ni el script ni el árbol
# de dependencias de @react-pdf/renderer (~30 paquetes transitivos: fontkit,
# yoga-layout, color-string, etc.). Se copian explícitamente las fuentes
# vendorizadas y el node_modules completo del build (no solo el podado de
# standalone) para que el worker tenga todo lo que necesita en runtime.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/documents/pdf-render-worker ./src/lib/documents/pdf-render-worker
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/documents/fonts ./src/lib/documents/fonts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
