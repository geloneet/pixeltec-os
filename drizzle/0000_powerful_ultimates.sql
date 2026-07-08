CREATE TYPE "public"."campaign_status" AS ENUM('planning', 'strategy_ready', 'generating', 'review', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."charge_frequency" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."client_source" AS ENUM('crm_blob', 'portal');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('borrador', 'en_revision', 'firmado', 'vencido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('monthly_grant', 'purchase', 'charge', 'refund', 'manual_grant', 'trial_grant');--> statement-breakpoint
CREATE TYPE "public"."discovery_status" AS ENUM('generando', 'en_progreso', 'completado');--> statement-breakpoint
CREATE TYPE "public"."email_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ia_template_type" AS ENUM('contrato', 'factura', 'discovery', 'estrategia', 'bienvenida', 'propuesta');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('borrador', 'enviada', 'vista', 'pagada', 'vencida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."iva_mode" AS ENUM('none', 'plus', 'included');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('contact_form', 'newsletter');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'lost');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning', 'error', 'alert');--> statement-breakpoint
CREATE TYPE "public"."organization_plan" AS ENUM('free', 'starter', 'pro', 'agency');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('generating', 'draft', 'approved', 'scheduled', 'published', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."project_log_category" AS ENUM('General', 'Cliente', 'Desarrollo', 'Infraestructura', 'Cobros');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('borrador', 'enviada', 'vista', 'aceptada', 'rechazada', 'vencida');--> statement-breakpoint
CREATE TYPE "public"."social_account_status" AS ENUM('connected', 'expired', 'error');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('instagram', 'facebook', 'linkedin', 'twitter');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('active', 'unsubscribed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."task_prio" AS ENUM('urgent_important', 'important', 'urgent', 'low');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pendiente', 'en_progreso', 'en_revision', 'completado', 'pausado', 'bloqueado');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"week_key" text NOT NULL,
	"template_id" text,
	"important" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_tasks_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"week_key" text NOT NULL,
	"template_id" text,
	"important" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"rrule" text NOT NULL,
	"default_time" text NOT NULL,
	"duration_min" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_category" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"generated_by" text NOT NULL,
	"color_bucket" text,
	"whatsapp_message_id" text,
	"whatsapp_sent_at" timestamp with time zone,
	"whatsapp_error" text,
	"telegram_message_id" integer,
	"telegram_sent_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_lockouts" (
	"email" text PRIMARY KEY NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blog_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"cover_image" text,
	"author" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"brief_source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"reading_time_min" integer DEFAULT 1 NOT NULL,
	"approved_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_portal_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"firestore_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_portal_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"firestore_id" text,
	"text" text NOT NULL,
	"image_url" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"source" "client_source" NOT NULL,
	"firestore_id" text,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"location" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"portal_token" text,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"strategy_id" uuid,
	"whatsapp" text,
	"website" text,
	"tech_stack" text,
	"services" text[] DEFAULT '{}' NOT NULL,
	"status" text,
	"client_value" numeric(12, 2),
	"assigned_to" text,
	"color" text,
	"logo_url" text,
	"initial_notes" text,
	"task_progress" jsonb,
	"slug" text,
	"access_code_hash" text,
	"access_code_expires_at" timestamp with time zone,
	"last_code_request_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"proposal_id" uuid,
	"template_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "contract_status" DEFAULT 'borrador' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pdf_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csp_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocked_uri" text,
	"violated_directive" text,
	"source_file" text,
	"line_number" integer,
	"document_uri" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"industry" text NOT NULL,
	"status" "discovery_status" DEFAULT 'generando' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"client_name" text NOT NULL,
	"project_name" text,
	"amount" numeric(12, 2) NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"method" text,
	"date" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"identity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"voice" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"business" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"positioning" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"objections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"objective" text NOT NULL,
	"target_action" text NOT NULL,
	"target_platforms" "social_platform"[] DEFAULT '{}' NOT NULL,
	"status" "campaign_status" DEFAULT 'planning' NOT NULL,
	"strategy" jsonb,
	"total_posts" integer DEFAULT 0 NOT NULL,
	"generated_posts" integer DEFAULT 0 NOT NULL,
	"approved_posts" integer DEFAULT 0 NOT NULL,
	"published_posts" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"type" "credit_transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"operation" text,
	"reference_id" text,
	"description" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_credits" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"monthly_allowance" integer DEFAULT 50 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"total_used" integer DEFAULT 0 NOT NULL,
	"last_monthly_refill_at" timestamp with time zone,
	"plan" "organization_plan" DEFAULT 'free' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"brand_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"result_post_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"campaign_id" uuid,
	"template_id" text,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"format" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"image_url" text,
	"alt_text" text,
	"suggested_time" text,
	"brand_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"scheduled_platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_platforms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"publish_errors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variant_group_id" uuid,
	"variant_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"status" "social_account_status" DEFAULT 'connected' NOT NULL,
	"facebook_user_id" text NOT NULL,
	"facebook_page_id" text NOT NULL,
	"facebook_page_name" text NOT NULL,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"instagram_business_id" text,
	"instagram_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"type" "ia_template_type" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"variables" text[] DEFAULT '{}' NOT NULL,
	"industry" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"ai_system_prompt" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infra_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"uid" text,
	"route" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infra_command_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command" text NOT NULL,
	"args" text,
	"chat_id" text NOT NULL,
	"username" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" text NOT NULL,
	"duration_ms" integer,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "infra_silences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"silenced_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"qty" numeric(10, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'borrador' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"iva_rate" numeric(4, 3) DEFAULT '0.16' NOT NULL,
	"iva_amount" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"pdf_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"tool_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"source" "lead_source" NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"message" text,
	"user_agent" text,
	"ip_hash" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"email_delivery_status" "email_delivery_status" DEFAULT 'pending' NOT NULL,
	"email_delivery_at" timestamp with time zone,
	"email_delivery_error" text,
	"consent_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"responsible" text,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" "subscriber_status" DEFAULT 'active' NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"reactivated_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"source" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"uid" text NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'recibida' NOT NULL,
	"linked_task_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"slug" text,
	"resolved_slug" text,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"project_id" uuid NOT NULL,
	"category" "project_log_category" DEFAULT 'General' NOT NULL,
	"content" text NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"budget" numeric(12, 2) DEFAULT '0' NOT NULL,
	"annual" numeric(12, 2) DEFAULT '0' NOT NULL,
	"budget_iva" "iva_mode" DEFAULT 'none' NOT NULL,
	"annual_iva" "iva_mode" DEFAULT 'none' NOT NULL,
	"tech" text DEFAULT '' NOT NULL,
	"guides" text DEFAULT '' NOT NULL,
	"accounts" text DEFAULT '' NOT NULL,
	"readme" text DEFAULT '' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"quick_notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"reference" text,
	"title" text NOT NULL,
	"scope" text NOT NULL,
	"solution" text,
	"deliverables" text,
	"benefits" text,
	"budget" text,
	"timeline" text,
	"status" "proposal_status" DEFAULT 'borrador' NOT NULL,
	"contract_id" uuid,
	"public_token" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"view_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"project_id" uuid NOT NULL,
	"concept" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"frequency" charge_frequency NOT NULL,
	"start_date" date NOT NULL,
	"client_email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_notified" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_links" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kpis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"roadmap" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priorities" text[] DEFAULT '{}' NOT NULL,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"automations" text[] DEFAULT '{}' NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"severity" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"desc" text DEFAULT '' NOT NULL,
	"status" "task_status" DEFAULT 'pendiente' NOT NULL,
	"prio" "task_prio" DEFAULT 'important' NOT NULL,
	"pomo_sessions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"ticket_id" text NOT NULL,
	"cliente" text NOT NULL,
	"problema" text NOT NULL,
	"categoria" text,
	"prioridad" text,
	"estado" text DEFAULT 'Abierto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_streak" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"firebase_uid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firestore_id" text,
	"owner_id" uuid NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"task_id" uuid,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"task_name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"current_activity" text,
	"activities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"session_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deploy_status" text,
	"commit_status" boolean,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_tasks" ADD CONSTRAINT "assistant_tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tasks_archive" ADD CONSTRAINT "assistant_tasks_archive_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_templates" ADD CONSTRAINT "assistant_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_weekly_reports" ADD CONSTRAINT "assistant_weekly_reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_projects" ADD CONSTRAINT "client_portal_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_updates" ADD CONSTRAINT "client_portal_updates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_brands" ADD CONSTRAINT "growth_brands_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_campaigns" ADD CONSTRAINT "growth_campaigns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_campaigns" ADD CONSTRAINT "growth_campaigns_brand_id_growth_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."growth_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_credit_ledger" ADD CONSTRAINT "growth_credit_ledger_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_credits" ADD CONSTRAINT "growth_credits_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_jobs" ADD CONSTRAINT "growth_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_jobs" ADD CONSTRAINT "growth_jobs_brand_id_growth_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."growth_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_posts" ADD CONSTRAINT "growth_posts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_posts" ADD CONSTRAINT "growth_posts_brand_id_growth_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."growth_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_social_accounts" ADD CONSTRAINT "growth_social_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_templates" ADD CONSTRAINT "ia_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_tips" ADD CONSTRAINT "knowledge_tips_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_tasks" ADD CONSTRAINT "legacy_tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_requests" ADD CONSTRAINT "portal_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_keys" ADD CONSTRAINT "project_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_log_entries" ADD CONSTRAINT "project_log_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_links" ADD CONSTRAINT "server_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_links" ADD CONSTRAINT "server_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streak" ADD CONSTRAINT "user_streak_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_firestore_id_idx" ON "activity" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "assistant_tasks_owner_week_idx" ON "assistant_tasks" USING btree ("owner_id","week_key");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_tasks_firestore_id_idx" ON "assistant_tasks" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "assistant_tasks_archive_owner_week_idx" ON "assistant_tasks_archive" USING btree ("owner_id","week_key");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_tasks_archive_firestore_id_idx" ON "assistant_tasks_archive" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "assistant_templates_owner_idx" ON "assistant_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_templates_firestore_id_idx" ON "assistant_templates" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "assistant_weekly_reports_owner_idx" ON "assistant_weekly_reports" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_weekly_reports_owner_week_idx" ON "assistant_weekly_reports" USING btree ("owner_id","week_key");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_weekly_reports_firestore_id_idx" ON "assistant_weekly_reports" USING btree ("firestore_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_briefs_firestore_id_idx" ON "blog_briefs" USING btree ("firestore_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_firestore_id_idx" ON "blog_posts" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "client_portal_projects_client_idx" ON "client_portal_projects" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_portal_projects_firestore_id_idx" ON "client_portal_projects" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "client_portal_updates_client_idx" ON "client_portal_updates" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_portal_updates_firestore_id_idx" ON "client_portal_updates" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "clients_owner_idx" ON "clients" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_firestore_id_idx" ON "clients" USING btree ("firestore_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_portal_token_idx" ON "clients" USING btree ("portal_token");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_slug_idx" ON "clients" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "contracts_owner_idx" ON "contracts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "contracts_client_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_firestore_id_idx" ON "contracts" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "discovery_sessions_owner_idx" ON "discovery_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_sessions_firestore_id_idx" ON "discovery_sessions" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "finances_client_name_idx" ON "finances" USING btree ("client_name");--> statement-breakpoint
CREATE UNIQUE INDEX "finances_firestore_id_idx" ON "finances" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "growth_brands_owner_idx" ON "growth_brands" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_brands_firestore_id_idx" ON "growth_brands" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "growth_campaigns_owner_idx" ON "growth_campaigns" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "growth_campaigns_brand_idx" ON "growth_campaigns" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_campaigns_firestore_id_idx" ON "growth_campaigns" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "growth_credit_ledger_owner_idx" ON "growth_credit_ledger" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_credit_ledger_firestore_id_idx" ON "growth_credit_ledger" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "growth_jobs_owner_idx" ON "growth_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_jobs_firestore_id_idx" ON "growth_jobs" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "growth_posts_owner_idx" ON "growth_posts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "growth_posts_brand_idx" ON "growth_posts" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "growth_posts_campaign_idx" ON "growth_posts" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_posts_firestore_id_idx" ON "growth_posts" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "growth_social_accounts_owner_idx" ON "growth_social_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_social_accounts_firestore_id_idx" ON "growth_social_accounts" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "ia_templates_owner_idx" ON "ia_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ia_templates_firestore_id_idx" ON "ia_templates" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "infra_silences_expires_idx" ON "infra_silences" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_owner_idx" ON "invoices" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_firestore_id_idx" ON "invoices" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "knowledge_tips_tool_idx" ON "knowledge_tips" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_tips_firestore_id_idx" ON "knowledge_tips" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_firestore_id_idx" ON "leads" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "legacy_tasks_owner_idx" ON "legacy_tasks" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_tasks_firestore_id_idx" ON "legacy_tasks" USING btree ("firestore_id");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscribers_token_idx" ON "newsletter_subscribers" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_firestore_id_idx" ON "notifications" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "portal_requests_client_idx" ON "portal_requests" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_requests_firestore_id_idx" ON "portal_requests" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "portal_security_events_created_idx" ON "portal_security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "project_keys_project_idx" ON "project_keys" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_keys_firestore_id_idx" ON "project_keys" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "project_log_entries_project_idx" ON "project_log_entries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_log_entries_firestore_id_idx" ON "project_log_entries" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_firestore_id_idx" ON "projects" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "proposals_owner_idx" ON "proposals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "proposals_client_idx" ON "proposals" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_public_token_idx" ON "proposals" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_reference_idx" ON "proposals" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_firestore_id_idx" ON "proposals" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "recurring_charges_project_idx" ON "recurring_charges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "recurring_charges_active_idx" ON "recurring_charges" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_charges_firestore_id_idx" ON "recurring_charges" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "strategies_owner_idx" ON "strategies" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategies_firestore_id_idx" ON "strategies" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_firestore_id_idx" ON "tasks" USING btree ("firestore_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_ticket_id_idx" ON "tickets" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_firestore_id_idx" ON "tickets" USING btree ("firestore_id");--> statement-breakpoint
CREATE INDEX "tools_owner_idx" ON "tools" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_firestore_id_idx" ON "tools" USING btree ("firestore_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "work_sessions_owner_idx" ON "work_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "work_sessions_project_idx" ON "work_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_sessions_firestore_id_idx" ON "work_sessions" USING btree ("firestore_id");