# SmartXcess – Self-Hosted Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon (public) Key** from Settings → API

## 2. Run the Database Schema

1. Open the SQL Editor in your Supabase dashboard
2. Paste the entire contents of `supabase-schema.sql` and run it
3. This creates all tables, views, functions, triggers, RLS policies, and storage buckets

## 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=YOUR-PROJECT-REF
```

## 4. Deploy Edge Functions

This project uses two Supabase Edge Functions:

### `moderate-assessment`
Parses uploaded exam files, analyzes questions with AI, and stores moderation results.

**Required secrets** (set in Supabase Dashboard → Settings → Edge Functions → Secrets):
- `SUPABASE_URL` – Automatically available in Edge Functions (no need to set manually)
- `SUPABASE_SERVICE_ROLE_KEY` – Automatically available in Edge Functions (no need to set manually)
- `AI_API_KEY` – An API key for AI analysis (OpenAI or compatible provider)

Deploy:
```bash
supabase functions deploy moderate-assessment
```

### `audit-logger`
Sends audit events to Elasticsearch/Elastic Cloud.

**Required secrets:**
- `ELASTIC_URL` – Your Elasticsearch endpoint
- `ELASTIC_API_KEY` – Your Elasticsearch API key

Deploy:
```bash
supabase functions deploy audit-logger
```

## 5. AI Provider Configuration

The `moderate-assessment` edge function calls `https://ai.gateway.lovable.dev/v1/chat/completions`. You need to replace this with your own AI provider endpoint. Options:

- **OpenAI**: Change the URL to `https://api.openai.com/v1/chat/completions` and set `LOVABLE_API_KEY` to your OpenAI API key
- **Any OpenAI-compatible API**: Update the URL and API key accordingly

Edit `supabase/functions/moderate-assessment/index.ts` line 249.

## 6. Create an Admin User

After signing up your first user:

1. Open the SQL Editor in Supabase
2. Find the user's ID from `auth.users`
3. Add the admin role:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER-UUID-HERE', 'admin');
```

## 7. Run the App

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:8080`.
