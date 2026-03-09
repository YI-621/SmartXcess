# SmartXcess Backend (FastAPI)

This backend wraps your existing analyzer modules:
- `app/services/master_analyzer.py`
- `app/services/part1_extract.py`
- `app/services/part2_parse.py`

## Environment variables

Create `backend/.env` from `backend/.env.example` and fill in the values:

```powershell
Copy-Item .env.example .env
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
