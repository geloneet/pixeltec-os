CREATE TYPE "public"."billing_frequency" AS ENUM('unico', 'mensual', 'trimestral', 'semestral', 'anual');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('pendiente', 'pagado', 'vencido', 'parcial', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('efectivo', 'transferencia', 'tarjeta');--> statement-breakpoint
CREATE TABLE "billing_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"contract_id" uuid,
	"proposal_id" uuid,
	"project_id" uuid,
	"concept" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"frequency" "billing_frequency" NOT NULL,
	"status" "billing_status" DEFAULT 'pendiente' NOT NULL,
	"due_date" date NOT NULL,
	"next_due_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_item_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" date NOT NULL,
	"period_key" date NOT NULL,
	"reference" text,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "template_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "sections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_billing_item_id_billing_items_id_fk" FOREIGN KEY ("billing_item_id") REFERENCES "public"."billing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_items_owner_idx" ON "billing_items" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "billing_items_client_idx" ON "billing_items" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "billing_items_contract_idx" ON "billing_items" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "billing_items_status_idx" ON "billing_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_records_billing_item_idx" ON "payment_records" USING btree ("billing_item_id");