-- Add tables for lecturer-uploaded assessments and related data
-- Run this in Supabase SQL Editor if you manage schema manually

-- 1. Assessments table (stores each uploaded assessment)
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

-- 2. Questions table (individual questions within an assessment)
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 0,
  bloom_level TEXT NOT NULL DEFAULT 'Remember',
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  complexity INTEGER NOT NULL DEFAULT 50,
  similarity_score INTEGER NOT NULL DEFAULT 0,
  similar_to TEXT,
  keywords TEXT[] DEFAULT '{}',
  question_order INTEGER NOT NULL DEFAULT 0,
  moderation_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Moderation comments
CREATE TABLE public.moderation_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. User modules (lecturer's assigned modules)
CREATE TABLE public.user_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_name)
);

-- 5. Activity logs
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('upload', 'moderation_complete', 'flagged', 'approved', 'rejected')),
  description TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Moderator-module mapping (for assigning moderators to modules)
CREATE TABLE public.moderator_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_code)
);

-- 7. Ensure has_role exists (used by RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 8. Ensure update_updated_at exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. Triggers for updated_at
CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_moderation_comments_updated_at
  BEFORE UPDATE ON public.moderation_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 10. Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_modules ENABLE ROW LEVEL SECURITY;

-- 11. RLS policies - assessments (lecturers see own, moderators see assigned, admins see all)
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

-- 12. RLS policies - questions
CREATE POLICY "Users can view questions of visible assessments" ON public.questions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id
      AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Lecturers can insert questions" ON public.questions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.lecturer_id = auth.uid())
  );
CREATE POLICY "Authenticated can update questions on accessible assessments" ON public.questions
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = questions.assessment_id
      AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- 13. RLS policies - moderation_comments
CREATE POLICY "Users can view comments on accessible questions" ON public.moderation_comments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.questions q
      JOIN public.assessments a ON a.id = q.assessment_id
      WHERE q.id = question_id
      AND (a.lecturer_id = auth.uid() OR a.moderator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Users can insert own comments" ON public.moderation_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON public.moderation_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 14. RLS policies - user_modules
CREATE POLICY "Users can view own modules" ON public.user_modules
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own modules" ON public.user_modules
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own modules" ON public.user_modules
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 15. RLS policies - activity_logs
CREATE POLICY "Authenticated users can read activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 16. RLS policies - moderator_modules
CREATE POLICY "Admins can manage moderator_modules" ON public.moderator_modules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can view own module assignments" ON public.moderator_modules
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated can read moderator_modules" ON public.moderator_modules
  FOR SELECT TO authenticated USING (true);

-- 17. Realtime for assessments and activity
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- 18. Storage bucket for assessment files (if not exists)
INSERT INTO storage.buckets (id, name, public)
SELECT 'assessments', 'assessments', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'assessments');

-- 19. Storage RLS
DROP POLICY IF EXISTS "Lecturers can upload assessments" ON storage.objects;
CREATE POLICY "Lecturers can upload assessments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read accessible assessments" ON storage.objects;
CREATE POLICY "Users can read accessible assessments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assessments' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.moderator_id = auth.uid() AND a.file_url LIKE '%' || storage.filename(name)
      )
    )
  );
