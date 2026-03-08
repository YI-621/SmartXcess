-- Storage bucket for assessment files
INSERT INTO storage.buckets (id, name, public) VALUES ('assessments', 'assessments', false);

-- RLS: lecturers can upload to their own folder
CREATE POLICY "Lecturers can upload assessments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assessments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can read files they own or are assigned to moderate
CREATE POLICY "Users can read accessible assessments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assessments' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.moderator_id = auth.uid()
        AND a.file_url LIKE '%' || storage.filename(name)
    )
  )
);

-- Moderator-module mapping table
CREATE TABLE public.moderator_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_code)
);

ALTER TABLE public.moderator_modules ENABLE ROW LEVEL SECURITY;

-- Admins can manage moderator-module mappings
CREATE POLICY "Admins can manage moderator_modules"
ON public.moderator_modules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Moderators can view their own module assignments
CREATE POLICY "Moderators can view own module assignments"
ON public.moderator_modules FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Everyone authenticated can read (for assignment lookup)
CREATE POLICY "Authenticated can read moderator_modules"
ON public.moderator_modules FOR SELECT TO authenticated
USING (true);

-- Add module_code column to assessments table
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS module_code TEXT;