ALTER TABLE "tasks" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_session_id_work_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."work_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_session_idx" ON "tasks" USING btree ("session_id");