-- ============================================================
-- SmartXcess / AssessWise – Full Supabase Schema Export
-- Run this SQL in your own Supabase project's SQL Editor
-- ============================================================

-- ==================== 1. ENUMS ====================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'lecturer');

-- ==================== 2. TABLES ====================

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  email text,
  department text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Assessments
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  course text NOT NULL,
  module_code text,
  lecturer_id uuid NOT NULL,
  moderator_id uuid,
  status text NOT NULL DEFAULT 'Pending',
  overall_score integer DEFAULT 0,
  flagged boolean DEFAULT false,
  flag_reason text,
  file_url text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  text text NOT NULL,
  marks integer NOT NULL DEFAULT 0,
  bloom_level text NOT NULL DEFAULT 'Remember',
  difficulty text NOT NULL DEFAULT 'Medium',
  complexity integer NOT NULL DEFAULT 50,
  similarity_score integer NOT NULL DEFAULT 0,
  similar_to text,
  keywords text[] DEFAULT '{}',
  question_order integer NOT NULL DEFAULT 0,
  moderation_details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Moderation Comments
CREATE TABLE public.moderation_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id),
  user_id uuid NOT NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Activity Logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  type text NOT NULL,
  description text NOT NULL,
  assessment_id uuid REFERENCES public.assessments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Exam Questions (reference bank)
CREATE TABLE public.exam_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id text NOT NULL,
  question_text text NOT NULL
);

-- Moderator Modules
CREATE TABLE public.moderator_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User Modules
CREATE TABLE public.user_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- System Settings
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==================== 3. VIEWS ====================

CREATE OR REPLACE VIEW public.user_details_view AS
SELECT
  p.user_id,
  p.full_name,
  p.email,
  p.department,
  ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id;

-- ==================== 4. FUNCTIONS ====================

-- Role checker (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle new user signup (creates profile + default lecturer role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, department, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'department', NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lecturer'::public.app_role);

  RETURN NEW;
END;
$$;

-- ==================== 5. TRIGGERS ====================

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update timestamps
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_assessments
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_moderation_comments
  BEFORE UPDATE ON public.moderation_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==================== 6. RLS POLICIES ====================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- assessments
CREATE POLICY "Lecturers can view own assessments" ON public.assessments FOR SELECT USING (lecturer_id = auth.uid());
CREATE POLICY "Lecturers can insert own assessments" ON public.assessments FOR INSERT WITH CHECK (lecturer_id = auth.uid());
CREATE POLICY "Moderators can view assigned assessments" ON public.assessments FOR SELECT USING (moderator_id = auth.uid());
CREATE POLICY "Moderators can update assigned assessments" ON public.assessments FOR UPDATE USING (moderator_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all assessments" ON public.assessments FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all assessments" ON public.assessments FOR ALL USING (has_role(auth.uid(), 'admin'));

-- questions
CREATE POLICY "Users can view questions of visible assessments" ON public.questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM assessments a WHERE a.id = questions.assessment_id AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Lecturers can insert questions" ON public.questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM assessments a WHERE a.id = questions.assessment_id AND a.lecturer_id = auth.uid()));
CREATE POLICY "Authenticated can update questions on accessible assessments" ON public.questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM assessments a WHERE a.id = questions.assessment_id AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- moderation_comments
CREATE POLICY "Users can view comments on accessible questions" ON public.moderation_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM questions q JOIN assessments a ON a.id = q.assessment_id WHERE q.id = moderation_comments.question_id AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users can insert own comments" ON public.moderation_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON public.moderation_comments FOR UPDATE USING (user_id = auth.uid());

-- activity_logs
CREATE POLICY "Authenticated users can read activity logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- exam_questions
CREATE POLICY "Authenticated users can read exam_questions" ON public.exam_questions FOR SELECT USING (true);
CREATE POLICY "Lecturers can insert exam_questions" ON public.exam_questions FOR INSERT WITH CHECK (has_role(auth.uid(), 'lecturer'));
CREATE POLICY "Admins can manage exam_questions" ON public.exam_questions FOR ALL USING (has_role(auth.uid(), 'admin'));

-- moderator_modules
CREATE POLICY "Authenticated can read moderator_modules" ON public.moderator_modules FOR SELECT USING (true);
CREATE POLICY "Moderators can view own module assignments" ON public.moderator_modules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage moderator_modules" ON public.moderator_modules FOR ALL USING (has_role(auth.uid(), 'admin'));

-- user_modules
CREATE POLICY "Users can view own modules" ON public.user_modules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own modules" ON public.user_modules FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own modules" ON public.user_modules FOR DELETE USING (user_id = auth.uid());

-- system_settings
CREATE POLICY "Anyone authenticated can read settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.system_settings FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ==================== 7. STORAGE ====================

-- Create a private storage bucket for assessment files
INSERT INTO storage.buckets (id, name, public) VALUES ('assessments', 'assessments', false);

-- Storage policies (adjust as needed)
CREATE POLICY "Authenticated users can upload assessments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessments');

CREATE POLICY "Authenticated users can read assessments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assessments');

-- ==================== 8. REALTIME (optional) ====================
-- Uncomment if you need realtime on any table:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.assessments;
