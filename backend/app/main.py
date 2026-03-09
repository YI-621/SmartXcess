import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.services.master_analyzer import process_and_save_exam

app = FastAPI(title="SmartXcess Backend API")

allowed_origins = [
  "http://localhost:5173",
  "http://localhost:8080",
]

app.add_middleware(
  CORSMiddleware,
  allow_origins=allowed_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
  return {"ok": True}


@app.post("/api/moderation/analyze")
async def analyze_assessment(
  module_code: str = Form(...),
  uploaded_by: str = Form(...),
  pdf_name: str | None = Form(default=None),
  file: UploadFile = File(...),
) -> dict:
  if not file.filename or not file.filename.lower().endswith(".pdf"):
    raise HTTPException(status_code=400, detail="Only PDF files are supported")

  suffix = Path(file.filename).suffix or ".pdf"
  with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
    temp_path = tmp.name
    tmp.write(await file.read())

  try:
    result = process_and_save_exam(
      temp_path,
      module_code.strip().upper(),
      uploaded_by.strip(),
      custom_pdf_name=(pdf_name.strip() if pdf_name else None),
    )
    if not result:
      raise HTTPException(status_code=500, detail="Analyzer returned no result")
    if not result.get("saved", False):
      raise HTTPException(status_code=500, detail=result.get("reason", "analysis_failed"))
    return result
  finally:
    try:
      os.remove(temp_path)
    except OSError:
      pass
