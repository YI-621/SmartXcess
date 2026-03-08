-- =============================================================================
-- SmartXcess Consolidated Schema
-- Matches current Supabase setup: profiles, roles, exam_questions (with vector),
-- assessments, questions, moderation, activity logs, storage.
-- =============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'lecturer');

-- 3. Core tables (auth-related)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  department TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 4. exam_questions (with vector for plagiarism detection)
DROP TABLE IF EXISTS public.exam_questions;
CREATE TABLE public.exam_questions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  question_id TEXT NOT NULL,
  module_code TEXT NOT NULL,
  exam_year TEXT NOT NULL,
  exam_month TEXT NOT NULL,
  question_text TEXT NOT NULL,
  embedding vector(384)
);

ALTER TABLE public.exam_questions DISABLE ROW LEVEL SECURITY;

-- 5. match_questions function (vector similarity for plagiarism)
CREATE OR REPLACE FUNCTION public.match_questions(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  target_module text
)
RETURNS TABLE (
  question_id text,
  question_text text,
  similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    eq.question_id,
    eq.question_text,
    1 - (eq.embedding <=> query_embedding) AS similarity
  FROM public.exam_questions eq
  WHERE 1 - (eq.embedding <=> query_embedding) > match_threshold
    AND eq.module_code = target_module
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 6. Assessments table
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL,
  lecturer_id UUID NOT NULL,
  moderator_id UUID,
  module_code TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Reviewed', 'Approved', 'Rejected')),
  overall_score INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 0,
  bloom_level TEXT NOT NULL DEFAULT 'Remember' CHECK (bloom_level IN ('Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create')),
  difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard')),
  complexity INTEGER NOT NULL DEFAULT 50,
  similarity_score INTEGER NOT NULL DEFAULT 0,
  similar_to TEXT,
  keywords TEXT[] DEFAULT '{}',
  question_order INTEGER NOT NULL DEFAULT 0,
  moderation_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Moderation comments
CREATE TABLE public.moderation_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. User modules
CREATE TABLE public.user_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_name)
);

-- 10. Activity logs
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('upload', 'moderation_complete', 'flagged', 'approved', 'rejected')),
  description TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Moderator modules
CREATE TABLE public.moderator_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_code)
);

-- 12. Helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, department, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'department', NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lecturer'::public.app_role);

  RETURN NEW;
END;
$$;

-- 13. Triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_moderation_comments_updated_at
  BEFORE UPDATE ON public.moderation_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 14. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_modules ENABLE ROW LEVEL SECURITY;

-- 15. RLS Policies - profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 16. RLS Policies - user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 17. RLS Policies - system_settings
CREATE POLICY "Anyone authenticated can read settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 18. RLS Policies - assessments
CREATE POLICY "Lecturers can view own assessments" ON public.assessments
  FOR SELECT TO authenticated USING (lecturer_id = auth.uid());
CREATE POLICY "Moderators can view assigned assessments" ON public.assessments
  FOR SELECT TO authenticated USING (moderator_id = auth.uid());
CREATE POLICY "Admins can view all assessments" ON public.assessments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Lecturers can insert own assessments" ON public.assessments
  FOR INSERT TO authenticated WITH CHECK (lecturer_id = auth.uid());
CREATE POLICY "Moderators can update assigned assessments" ON public.assessments
  FOR UPDATE TO authenticated USING (moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all assessments" ON public.assessments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 19. RLS Policies - questions
CREATE POLICY "Users can view questions of visible assessments" ON public.questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id
    AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Lecturers can insert questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id AND a.lecturer_id = auth.uid()
  ));
CREATE POLICY "Authenticated can update questions on accessible assessments" ON public.questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = questions.assessment_id
    AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- 20. RLS Policies - moderation_comments
CREATE POLICY "Users can view comments on accessible questions" ON public.moderation_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.assessments a ON a.id = q.assessment_id
    WHERE q.id = question_id
    AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Users can insert own comments" ON public.moderation_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON public.moderation_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 21. RLS Policies - user_modules
CREATE POLICY "Users can view own modules" ON public.user_modules
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own modules" ON public.user_modules
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own modules" ON public.user_modules
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 22. RLS Policies - activity_logs
CREATE POLICY "Authenticated users can read activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 23. RLS Policies - moderator_modules
CREATE POLICY "Admins can manage moderator_modules" ON public.moderator_modules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can view own module assignments" ON public.moderator_modules
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated can read moderator_modules" ON public.moderator_modules
  FOR SELECT TO authenticated USING (true);

-- 24. user_details_view
CREATE OR REPLACE VIEW public.user_details_view WITH (security_invoker = true) AS
  SELECT
    p.user_id,
    p.full_name,
    p.department,
    p.email,
    ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id;

-- 25. Storage bucket (skip if already exists)
INSERT INTO storage.buckets (id, name, public)
SELECT 'assessments', 'assessments', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'assessments');

CREATE POLICY "Lecturers can upload assessments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read accessible assessments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assessments' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.moderator_id = auth.uid()
          AND a.file_url LIKE '%' || storage.filename(name)
      )
    )
  );

-- 26. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- 27. Seed system_settings (your Supabase values)
INSERT INTO public.system_settings (key, value) VALUES
  ('bloom_levels', '["Knowledge", "Comprehension", "Application", "Analysis", "Synthesis", "Evaluation"]'),
  ('difficulty_level', '["Low", "Medium", "High"]'),
  ('similarity_threshold', '75'),
  ('overall_indicator', '40')
ON CONFLICT (key) DO NOTHING;
