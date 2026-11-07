CREATE TABLE "applicant_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"invitation_type" text NOT NULL,
	"email" text NOT NULL,
	"given_name" text,
	"family_name" text,
	"job_posting_id" uuid,
	"talent_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"custom_fields_config" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prefill_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invited_by_user_id" text,
	"invited_by_name" text,
	"personal_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "applicant_invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "crypto_data_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"algorithm" text DEFAULT 'AES-256-GCM' NOT NULL,
	"record_salt" text NOT NULL,
	"wrapped_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"shredded_at" timestamp,
	"shredded_by_user_id" text,
	"shred_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_key_pair" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"provider_type" text DEFAULT 'm365-entra-oidc' NOT NULL,
	"entra_tenant_id" text,
	"entra_object_id" text,
	"encryption_algorithm" text DEFAULT 'RSA-OAEP-256' NOT NULL,
	"signing_algorithm" text DEFAULT 'RSASSA-PSS-SHA256' NOT NULL,
	"public_key_spki" text NOT NULL,
	"signing_public_key_spki" text NOT NULL,
	"encrypted_private_key" jsonb NOT NULL,
	"encrypted_signing_private_key" jsonb NOT NULL,
	"key_fingerprint" text NOT NULL,
	"x509_subject" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interview_evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"job_posting_id" uuid,
	"stage" text DEFAULT 'screening' NOT NULL,
	"interview_type" text DEFAULT 'video' NOT NULL,
	"scheduled_at" timestamp,
	"conducted_at" timestamp DEFAULT now() NOT NULL,
	"interviewer_user_id" text,
	"interviewer_name" text NOT NULL,
	"interviewer_role" text DEFAULT 'Hiring Team' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"competency_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overall_score" double precision DEFAULT 0 NOT NULL,
	"recommendation" text DEFAULT 'hire' NOT NULL,
	"strengths" text,
	"concerns" text,
	"structured_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calibration_notes" text,
	"is_blind_submitted" boolean DEFAULT true NOT NULL,
	"ledger_block_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_posting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"department" text NOT NULL,
	"role_category" text DEFAULT 'general' NOT NULL,
	"employment_type" text DEFAULT 'regular' NOT NULL,
	"work_model" text DEFAULT 'onsite' NOT NULL,
	"work_hours_per_week" double precision DEFAULT 39 NOT NULL,
	"contract_framework_code" text,
	"entgeltgruppe" text,
	"erfahrungsstufe" integer DEFAULT 1,
	"salary_range_min" double precision,
	"salary_range_max" double precision,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"sgb2_eligible" text DEFAULT 'none' NOT NULL,
	"summary" text,
	"description" text,
	"responsibilities" text,
	"qualifications" text,
	"benefits" text,
	"equal_opportunity_statement" text,
	"accessibility_notes" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"openings_count" integer DEFAULT 1 NOT NULL,
	"hiring_manager_talent_id" uuid,
	"hr_responsible_user_id" text,
	"created_by_user_id" text,
	"interview_scorecard_template" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_onboarding_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sync_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp,
	"closing_date" timestamp,
	"target_hire_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_posting_contact" (
	"job_posting_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" text DEFAULT 'hiring_team' NOT NULL,
	CONSTRAINT "job_posting_contact_job_posting_id_contact_id_pk" PRIMARY KEY("job_posting_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "job_posting_location" (
	"job_posting_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "job_posting_location_job_posting_id_location_id_pk" PRIMARY KEY("job_posting_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "job_posting_tag" (
	"job_posting_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "job_posting_tag_job_posting_id_tag_id_pk" PRIMARY KEY("job_posting_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"job_posting_id" uuid,
	"invitation_id" uuid,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"filled_by_channel" text DEFAULT 'internal_team' NOT NULL,
	"submitted_by_user_id" text,
	"verified_by_user_id" text,
	"payroll_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_field_definitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_field_responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_payload" jsonb,
	"ledger_block_id" uuid,
	"submitted_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel_data_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid,
	"contact_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"ledger_block_id" uuid,
	"ledger_block_hash" text NOT NULL,
	"operation" text NOT NULL,
	"channel" text DEFAULT 'internal_ui' NOT NULL,
	"encrypted_snapshot" jsonb,
	"redacted_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_diffs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restored_from_version" integer,
	"is_shredded" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_by_role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel_ledger_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_index" integer NOT NULL,
	"previous_block_hash" text NOT NULL,
	"previous_entity_block_hash" text NOT NULL,
	"block_hash" text NOT NULL,
	"merkle_root_hash" text NOT NULL,
	"signed_tree_head" jsonb NOT NULL,
	"talent_id" uuid,
	"contact_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"operation" text NOT NULL,
	"channel" text DEFAULT 'internal_ui' NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_email_hash" text NOT NULL,
	"actor_role" text NOT NULL,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change_summary" text NOT NULL,
	"payload_commitment_hash" text NOT NULL,
	"signature_base64" text NOT NULL,
	"signer_key_fingerprint" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "encrypted_envelope" jsonb;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "encryption_status" text DEFAULT 'plaintext' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_mapping" ADD COLUMN "talent_id" uuid;--> statement-breakpoint
ALTER TABLE "sync_mapping" ADD COLUMN "job_posting_id" uuid;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "pipeline_stage" text DEFAULT 'applied' NOT NULL;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "job_posting_id" uuid;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "average_rating" double precision;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "sync_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "latest_ledger_block_hash" text;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "encrypted_envelope" jsonb;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "custom_field_values" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "last_modified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "talent" ADD COLUMN "last_modified_channel" text DEFAULT 'internal_ui';--> statement-breakpoint
ALTER TABLE "applicant_invitation" ADD CONSTRAINT "applicant_invitation_job_posting_id_job_posting_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_posting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_invitation" ADD CONSTRAINT "applicant_invitation_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_evaluation" ADD CONSTRAINT "interview_evaluation_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_evaluation" ADD CONSTRAINT "interview_evaluation_job_posting_id_job_posting_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_posting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting" ADD CONSTRAINT "job_posting_hiring_manager_talent_id_talent_id_fk" FOREIGN KEY ("hiring_manager_talent_id") REFERENCES "public"."talent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting" ADD CONSTRAINT "job_posting_hr_responsible_user_id_user_id_fk" FOREIGN KEY ("hr_responsible_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_contact" ADD CONSTRAINT "job_posting_contact_job_posting_id_job_posting_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_posting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_contact" ADD CONSTRAINT "job_posting_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_location" ADD CONSTRAINT "job_posting_location_job_posting_id_job_posting_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_posting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_location" ADD CONSTRAINT "job_posting_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_tag" ADD CONSTRAINT "job_posting_tag_job_posting_id_job_posting_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_posting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_tag" ADD CONSTRAINT "job_posting_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submission" ADD CONSTRAINT "onboarding_submission_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submission" ADD CONSTRAINT "onboarding_submission_job_posting_id_job_posting_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_posting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submission" ADD CONSTRAINT "onboarding_submission_invitation_id_applicant_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."applicant_invitation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_data_version" ADD CONSTRAINT "personnel_data_version_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_data_version" ADD CONSTRAINT "personnel_data_version_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_data_version" ADD CONSTRAINT "personnel_data_version_ledger_block_id_personnel_ledger_block_id_fk" FOREIGN KEY ("ledger_block_id") REFERENCES "public"."personnel_ledger_block"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_ledger_block" ADD CONSTRAINT "personnel_ledger_block_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_ledger_block" ADD CONSTRAINT "personnel_ledger_block_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applicant_invitation_token_idx" ON "applicant_invitation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "applicant_invitation_talent_idx" ON "applicant_invitation" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "crypto_data_key_subject_idx" ON "crypto_data_key" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "crypto_data_key_status_idx" ON "crypto_data_key" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crypto_key_pair_owner_idx" ON "crypto_key_pair" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "crypto_key_pair_fingerprint_idx" ON "crypto_key_pair" USING btree ("key_fingerprint");--> statement-breakpoint
CREATE INDEX "interview_eval_talent_idx" ON "interview_evaluation" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "interview_eval_job_idx" ON "interview_evaluation" USING btree ("job_posting_id");--> statement-breakpoint
CREATE INDEX "job_posting_status_public_idx" ON "job_posting" USING btree ("status","is_public");--> statement-breakpoint
CREATE INDEX "job_posting_department_idx" ON "job_posting" USING btree ("department");--> statement-breakpoint
CREATE INDEX "onboarding_submission_talent_idx" ON "onboarding_submission" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "onboarding_submission_status_idx" ON "onboarding_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "personnel_version_talent_idx" ON "personnel_data_version" USING btree ("talent_id","version_number");--> statement-breakpoint
CREATE INDEX "personnel_version_entity_idx" ON "personnel_data_version" USING btree ("entity_type","entity_id","version_number");--> statement-breakpoint
CREATE INDEX "personnel_ledger_block_index_idx" ON "personnel_ledger_block" USING btree ("block_index");--> statement-breakpoint
CREATE INDEX "personnel_ledger_talent_idx" ON "personnel_ledger_block" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "personnel_ledger_contact_idx" ON "personnel_ledger_block" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "personnel_ledger_hash_idx" ON "personnel_ledger_block" USING btree ("block_hash");--> statement-breakpoint
CREATE INDEX "contact_encryption_status_idx" ON "contact" USING btree ("encryption_status");