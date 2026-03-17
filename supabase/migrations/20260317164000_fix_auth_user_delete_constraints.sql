-- Fix foreign keys that block deleting users from auth.users.
-- user_sessions rows should be removed with the user.
-- system_settings audit should keep the row and null out updated_by.

DO $$
DECLARE
  fk_name text;
BEGIN
  FOR fk_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname = 'user_sessions'
      AND a.attname = 'user_id'
      AND c.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.user_sessions DROP CONSTRAINT %I', fk_name);
  END LOOP;

  ALTER TABLE public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END
$$;

DO $$
DECLARE
  fk_name text;
BEGIN
  FOR fk_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname = 'system_settings'
      AND a.attname = 'updated_by'
      AND c.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.system_settings DROP CONSTRAINT %I', fk_name);
  END LOOP;

  ALTER TABLE public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
END
$$;
