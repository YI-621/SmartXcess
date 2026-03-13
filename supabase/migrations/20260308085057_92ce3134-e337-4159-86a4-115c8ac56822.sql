-- Add internal_questions table
CREATE TABLE public.internal_questions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id text NOT NULL,
  module_code text NOT NULL,
  exam_year text NOT NULL,
  exam_month text NOT NULL,
  question_text text NOT NULL,
  embedding USER-DEFINED,
  uploaded_by text DEFAULT 'Unknown Lecturer'::text,
  upload_time timestamp with time zone DEFAULT timezone('utc'::text, now()),
  module_name text,
  CONSTRAINT internal_questions_pkey PRIMARY KEY (id)
);

-- Add question_analysis_results table
CREATE TABLE public.question_analysis_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_code text,
  filename text,
  uploaded_by text,
  question_id text,
  question_text text,
  word_count integer,
  similarity_source text,
  similarity_reason text,
  regex_detected_potential text,
  validated_bloom_keywords text,
  final_bloom_level text,
  difficulty text CHECK (difficulty = ANY (ARRAY['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'])),
  grammar_spelling_error text,
  grammar_structure text,
  relevancy_to_scope bigint,
  suggestion text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  internal_similarity_score double precision,
  external_similarity_score double precision,
  final_sim_score double precision,
  overall_internal_similarity double precision,
  overall_external_similarity double precision,
  difficulty_reason text,
  CONSTRAINT question_analysis_results_pkey PRIMARY KEY (id)
);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS moderation_details jsonb DEFAULT '{}'::jsonb;

CREATE POLICY "Authenticated can update questions on accessible assessments"
ON public.questions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = questions.assessment_id
    AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);