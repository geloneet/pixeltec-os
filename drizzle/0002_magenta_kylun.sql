CREATE TYPE "public"."crypto_alert_type" AS ENUM('price_below', 'price_above', 'change_percent', 'rsi_extreme', 'ma_cross', 'volume_spike');--> statement-breakpoint
CREATE TYPE "public"."crypto_log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."crypto_log_source" AS ENUM('price-sync', 'alert-engine', 'telegram-webhook', 'admin');--> statement-breakpoint
CREATE TYPE "public"."crypto_price_source" AS ENUM('binance', 'coingecko');--> statement-breakpoint
CREATE TYPE "public"."crypto_telegram_role" AS ENUM('owner', 'operator');--> statement-breakpoint
CREATE TABLE "crypto_alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb NOT NULL,
	"delivered_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"type" "crypto_alert_type" NOT NULL,
	"params" jsonb NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"telegram_chat_id" text,
	"display_name" text,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_intel_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "crypto_log_source" NOT NULL,
	"level" "crypto_log_level" NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_price_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"price" numeric NOT NULL,
	"volume" numeric DEFAULT '0' NOT NULL,
	"interval" text DEFAULT '1m' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_prices" (
	"symbol" text PRIMARY KEY NOT NULL,
	"price_usd" numeric NOT NULL,
	"change_1h" numeric NOT NULL,
	"change_24h" numeric NOT NULL,
	"change_7d" numeric NOT NULL,
	"volume_24h" numeric NOT NULL,
	"market_cap" numeric NOT NULL,
	"source" "crypto_price_source" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_telegram_users" (
	"telegram_id" text PRIMARY KEY NOT NULL,
	"telegram_user_id_num" bigint NOT NULL,
	"telegram_username" text,
	"first_name" text,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"role" "crypto_telegram_role" DEFAULT 'operator' NOT NULL,
	"authorized" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crypto_alert_events" ADD CONSTRAINT "crypto_alert_events_rule_id_crypto_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."crypto_alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crypto_alert_events_rule_idx" ON "crypto_alert_events" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "crypto_alert_events_created_idx" ON "crypto_alert_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "crypto_alert_rules_user_idx" ON "crypto_alert_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crypto_alert_rules_active_idx" ON "crypto_alert_rules" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "crypto_alert_rules_firestore_id_idx" ON "crypto_alert_rules" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "crypto_intel_logs_timestamp_idx" ON "crypto_intel_logs" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "crypto_intel_logs_source_idx" ON "crypto_intel_logs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "crypto_intel_logs_level_idx" ON "crypto_intel_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "crypto_price_points_symbol_ts_idx" ON "crypto_price_points" USING btree ("symbol","timestamp");