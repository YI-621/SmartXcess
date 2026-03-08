
-- Add email column to profiles to match external DB
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Create exam_questions table matching external DB schema
CREATE TABLE public.exam_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read exam questions
CREATE POLICY "Authenticated users can read exam_questions" ON public.exam_questions
  FOR SELECT TO authenticated USING (true);

-- Admins can manage exam questions
CREATE POLICY "Admins can manage exam_questions" ON public.exam_questions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lecturers can insert exam questions
CREATE POLICY "Lecturers can insert exam_questions" ON public.exam_questions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'lecturer'));

-- Create user_details_view matching external DB
CREATE OR REPLACE VIEW public.user_details_view WITH (security_invoker=on) AS
  SELECT 
    p.user_id,
    p.full_name,
    p.department,
    p.email,
    ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id;

-- Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lecturer');
  
  RETURN NEW;
END;
$function$;
