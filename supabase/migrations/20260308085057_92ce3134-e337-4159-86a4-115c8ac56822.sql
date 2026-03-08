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