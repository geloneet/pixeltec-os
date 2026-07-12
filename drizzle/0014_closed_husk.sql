ALTER TABLE "contracts" ADD COLUMN "billing_item_drafts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "project_definitions" ADD COLUMN "proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_definitions" ADD CONSTRAINT "project_definitions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;