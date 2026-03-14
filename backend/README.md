# SmartXcess Backend (FastAPI)

This backend wraps your existing analyzer modules:
- `app/services/master_analyzer.py`
- `app/services/part1_extract.py`
- `app/services/part2_parse.py`

## Environment variables

Create `backend/.env` from `backend/env.example` and fill in the values:

```powershell
Copy-Item env.example .env
```

Required keys:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY_SIMILARITY`
- `GROQ_API_KEY_BLOOM`
- `TAVILY_API_KEY`

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoint

- `POST /api/moderation/analyze`
  - form fields: `module_code`, `uploaded_by`, `file` (PDF)

Example using curl:

```bash
curl -X POST "http://localhost:8000/api/moderation/analyze" \
  -F "module_code=BUS201" \
  -F "uploaded_by=lecturer_name" \
  -F "file=@assessment.pdf"
```

## Deploy to Google Cloud Run

This backend is now Cloud Run ready via `backend/Dockerfile`.

1. Prerequisites

```powershell
gcloud auth login
gcloud config set project <YOUR_GCP_PROJECT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

2. Deploy from source (builds container with Cloud Build)

Run this from the repository root:

```powershell
gcloud run deploy smartxcess-backend \
  --source backend \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

3. Set environment variables in Cloud Run

In the Cloud Run service settings, add:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY_SIMILARITY`
- `GROQ_API_KEY_BLOOM`
- `TAVILY_API_KEY`
- `ALLOWED_ORIGINS` (example: `https://yi-621.github.io,http://localhost:5173,http://localhost:8080`)

4. Verify deployment

- Open `https://<your-cloud-run-url>/health` and confirm you get `{"ok": true}`.
- Update frontend env: `VITE_API_BASE_URL=https://<your-cloud-run-url>`.

5. Redeploy frontend after backend URL change

```powershell
npm run deploy
```
