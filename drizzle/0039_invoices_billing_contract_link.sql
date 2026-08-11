ALTER TABLE "invoices" ADD COLUMN "billing_item_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "period_key" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_item_id_billing_items_id_fk" FOREIGN KEY ("billing_item_id") REFERENCES "public"."billing_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_billing_item_idx" ON "invoices" USING btree ("billing_item_id");--> statement-breakpoint
CREATE INDEX "invoices_contract_idx" ON "invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_billing_item_period_idx" ON "invoices" USING btree ("billing_item_id","period_key");