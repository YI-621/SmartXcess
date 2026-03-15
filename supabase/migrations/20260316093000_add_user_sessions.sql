CREATE TABLE IF NOT EXISTS public.user_sessions (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  is_logged_in BOOLEAN DEFAULT false,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_sessions'
      AND policyname = 'Users can view own session'
  ) THEN
    CREATE POLICY "Users can view own session" ON public.user_sessions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_sessions'
      AND policyname = 'Users can update own session'
  ) THEN
    CREATE POLICY "Users can update own session" ON public.user_sessions
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_sessions'
      AND policyname = 'Users can insert own session'
  ) THEN
    CREATE POLICY "Users can insert own session" ON public.user_sessions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
