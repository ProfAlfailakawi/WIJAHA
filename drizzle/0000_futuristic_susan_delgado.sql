CREATE TABLE "ai_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"stage" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"estimated_cost_kwd" text DEFAULT '0' NOT NULL,
	"used_fallback" boolean DEFAULT false NOT NULL,
	"org_id" text,
	"user_uid" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"org_id" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"duration_ms" integer,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_uid" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"org_id" text,
	"ip_hash" text DEFAULT 'local' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"active_org_id" text NOT NULL,
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_session_id" text NOT NULL,
	"org_id" text NOT NULL,
	"user_uid" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"billing_cycle" text,
	"amount_kwd" integer NOT NULL,
	"service_request_id" text,
	"service_owner" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_checkout_sessions_provider_session_id_unique" UNIQUE("provider_session_id")
);
--> statement-breakpoint
CREATE TABLE "competency_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text,
	"org_id" text,
	"competency" text NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer DEFAULT 3 NOT NULL,
	"run_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset" text DEFAULT 'dev' NOT NULL,
	"query_text" text NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"dialect" text DEFAULT 'msa' NOT NULL,
	"expected_intent" text NOT NULL,
	"expected_sensitivity" text NOT NULL,
	"expected_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mandatory_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"forbidden_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author" text DEFAULT 'system_demo' NOT NULL,
	"reviewed_by" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_used" text NOT NULL,
	"total_cases" integer NOT NULL,
	"intent_accuracy_pct" integer NOT NULL,
	"recall_pct" integer NOT NULL,
	"schema_pass_pct" integer NOT NULL,
	"high_sensitivity_pass_pct" integer NOT NULL,
	"hallucinated_rules_count" integer NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_suggestion_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text,
	"org_id" text,
	"project_id" text,
	"result_id" text,
	"trigger_type" text NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"bio_ar" text NOT NULL,
	"bio_en" text NOT NULL,
	"avatar_url" text NOT NULL,
	"role_tag" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "experts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exports_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"org_id" text NOT NULL,
	"user_uid" text NOT NULL,
	"format" text NOT NULL,
	"watermarked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"user_uid" text,
	"rating" text NOT NULL,
	"comment" text,
	"reported_error" boolean DEFAULT false NOT NULL,
	"rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_status" text DEFAULT 'open' NOT NULL,
	"resolved_by_uid" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_uid" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"org_id" text NOT NULL,
	"user_uid" text NOT NULL,
	"payment_id" text NOT NULL,
	"amount_kwd" integer NOT NULL,
	"description_ar" text NOT NULL,
	"description_en" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "knowledge_rule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by_uid" text NOT NULL,
	"change_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"body_ar" text NOT NULL,
	"body_en" text NOT NULL,
	"level" text DEFAULT 'customary' NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '["GLOBAL"]'::jsonb NOT NULL,
	"contexts" jsonb DEFAULT '["business"]'::jsonb NOT NULL,
	"sensitivity" text DEFAULT 'low' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exceptions" text,
	"status" text DEFAULT 'draft_demo' NOT NULL,
	"author_uid" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" text,
	"review_note" text,
	"valid_from" text,
	"review_due_at" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes" text,
	"embedding_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding_vec" vector(768),
	"normalized_search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"invalidated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"org_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"is_personal" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_uid" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"amount_kwd" integer NOT NULL,
	"currency" text DEFAULT 'KWD' NOT NULL,
	"status" text DEFAULT 'succeeded' NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_tx_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_tx_id_unique" UNIQUE("provider_tx_id")
);
--> statement-breakpoint
CREATE TABLE "plan_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"entitlement_key" text NOT NULL,
	"entitlement_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"audience_ar" text NOT NULL,
	"audience_en" text NOT NULL,
	"monthly_price_kwd" integer DEFAULT 0 NOT NULL,
	"annual_price_kwd" integer DEFAULT 0 NOT NULL,
	"is_quote" boolean DEFAULT false NOT NULL,
	"tax_note_ar" text NOT NULL,
	"tax_note_en" text NOT NULL,
	"excluded_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"change_summary" text NOT NULL,
	"diff_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_uid" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_uid" text NOT NULL,
	"org_id" text NOT NULL,
	"title" text NOT NULL,
	"intent" text DEFAULT 'delegation_visit_host' NOT NULL,
	"current_version_id" text NOT NULL,
	"visibility" text DEFAULT 'org' NOT NULL,
	"dismissed_expert_triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_uid" text,
	"anon_id" text,
	"org_id" text,
	"text_encrypted" text NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"intent" text DEFAULT 'etiquette_personal' NOT NULL,
	"sensitivity" text DEFAULT 'low' NOT NULL,
	"cache_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"kb_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" text PRIMARY KEY NOT NULL,
	"query_id" text NOT NULL,
	"user_uid" text,
	"anon_id" text,
	"org_id" text,
	"payload" jsonb NOT NULL,
	"rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_estimate_kwd" text DEFAULT '0.002' NOT NULL,
	"is_public_share" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"service_id" text,
	"service_owner" text NOT NULL,
	"gross_amount_kwd" integer NOT NULL,
	"split_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_split_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_type" text NOT NULL,
	"platform_share_pct" integer,
	"yousef_share_pct" integer,
	"ahmad_share_pct" integer,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "revenue_split_rules_owner_type_unique" UNIQUE("owner_type")
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"description_ar" text NOT NULL,
	"description_en" text NOT NULL,
	"audience" jsonb DEFAULT '["corporate"]'::jsonb NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"competencies" jsonb DEFAULT '["C1"]'::jsonb NOT NULL,
	"learning_objectives_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learning_objectives_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_minutes" integer DEFAULT 5 NOT NULL,
	"content_owner" text NOT NULL,
	"learning_design_owner" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"cover_image" text,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_uid" text,
	"requester_email" text NOT NULL,
	"requester_name" text NOT NULL,
	"org_id" text,
	"service_id" text NOT NULL,
	"project_id" text,
	"trigger_source" text DEFAULT 'direct' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"context_shared" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_notes" text DEFAULT '' NOT NULL,
	"internal_notes" text DEFAULT '' NOT NULL,
	"assigned_owner" text DEFAULT 'yousef' NOT NULL,
	"quoted_amount_kwd" integer,
	"delivery_notes" text,
	"paid" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"for_whom_ar" text NOT NULL,
	"for_whom_en" text NOT NULL,
	"deliverables_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deliverables_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format" text NOT NULL,
	"duration_ar" text,
	"duration_en" text,
	"pricing_type" text NOT NULL,
	"price_amount_kwd" integer,
	"turnaround_ar" text,
	"turnaround_en" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"org_id" text NOT NULL,
	"token" text NOT NULL,
	"created_by_uid" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "simulation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_uid" text,
	"anon_id" text,
	"org_id" text,
	"scenario_id" text NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"current_node_id" text NOT NULL,
	"report_payload" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "simulation_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"node_id" text NOT NULL,
	"kind" text DEFAULT 'choice' NOT NULL,
	"answer_encrypted" text NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feedback_text" text DEFAULT '' NOT NULL,
	"rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"type" text DEFAULT 'internal' NOT NULL,
	"url" text,
	"published_at" text,
	"accessed_at" text NOT NULL,
	"reliability" text DEFAULT 'secondary' NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_uid" text NOT NULL,
	"plan_id" text NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synonyms" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"canonical_ar" text NOT NULL,
	"canonical_en" text NOT NULL,
	"dialect" text DEFAULT 'gulf' NOT NULL,
	"topic" text DEFAULT 'general' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titles_dictionary" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text DEFAULT 'GLOBAL' NOT NULL,
	"role_ar" text NOT NULL,
	"role_en" text NOT NULL,
	"salutation_ar" text NOT NULL,
	"salutation_en" text NOT NULL,
	"reviewed_by" text,
	"is_demo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"period_key" text NOT NULL,
	"metric_key" text NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"platform_role" text DEFAULT 'user' NOT NULL,
	"expert_suggestions_enabled" boolean DEFAULT true NOT NULL,
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret_encrypted" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_uid_users_uid_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_scores" ADD CONSTRAINT "competency_scores_run_id_simulation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_rule_versions" ADD CONSTRAINT "knowledge_rule_versions_rule_id_knowledge_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."knowledge_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_uid_users_uid_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_uid_users_uid_fk" FOREIGN KEY ("owner_uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_steps" ADD CONSTRAINT "simulation_steps_run_id_simulation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_created_at_idx" ON "ai_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "knowledge_rules_embedding_hnsw_idx" ON "knowledge_rules" USING hnsw ("embedding_vec" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "magic_attempts_email_time_idx" ON "magic_attempts" USING btree ("email","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_counters_org_period_metric_idx" ON "usage_counters" USING btree ("org_id","period_key","metric_key");