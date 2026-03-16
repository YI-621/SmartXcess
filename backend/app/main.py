import os
import tempfile
import base64
from pathlib import Path
from threading import Lock, Thread

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes, serialization

app = FastAPI(title="SmartXcess Backend API")

raw_allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
if raw_allowed_origins.strip():
  # Normalize to plain origins (no trailing slash) because CORS origin matching is exact.
  allowed_origins = [origin.strip().rstrip("/") for origin in raw_allowed_origins.split(",") if origin.strip()]
else:
  allowed_origins = [
    "https://yi-621.github.io",
    "http://localhost:8080",
    "http://localhost:5173",
  ]

app.add_middleware(
  CORSMiddleware,
  allow_origins=allowed_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

_analyzer_lock = Lock()
_analyzer_loading = False
_analyzer_ready = False
_analyzer_error: str | None = None
_process_and_save_exam = None
_process_and_save_internal_questions = None


def _load_analyzer_once() -> None:
  global _analyzer_loading, _analyzer_ready, _analyzer_error
  global _process_and_save_exam, _process_and_save_internal_questions

  try:
    try:
      from app.services.master_analyzer import process_and_save_exam, process_and_save_internal_questions
    except Exception:
      from backend.app.services.master_analyzer import process_and_save_exam, process_and_save_internal_questions

    _process_and_save_exam = process_and_save_exam
    _process_and_save_internal_questions = process_and_save_internal_questions
    _analyzer_ready = True
    _analyzer_error = None
  except Exception as import_error:
    _analyzer_ready = False
    _analyzer_error = str(import_error)
  finally:
    with _analyzer_lock:
      _analyzer_loading = False


def _ensure_analyzer_loading() -> None:
  global _analyzer_loading
  if _analyzer_ready:
    return

  with _analyzer_lock:
    if _analyzer_ready or _analyzer_loading:
      return
    _analyzer_loading = True
    Thread(target=_load_analyzer_once, daemon=True).start()


def _get_loaded_analyzers() -> tuple:
  _ensure_analyzer_loading()

  if _analyzer_ready:
    return _process_and_save_exam, _process_and_save_internal_questions

  if _analyzer_error:
    raise HTTPException(status_code=500, detail=f"Analyzer initialization failed: {_analyzer_error}")

  raise HTTPException(status_code=503, detail="Analyzer is warming up. Please retry in 15-30 seconds.")


@app.on_event("startup")
def warm_analyzer() -> None:
  preload_enabled = os.getenv("ANALYZER_PRELOAD_ON_STARTUP", "false").strip().lower() in {"1", "true", "yes", "on"}
  if preload_enabled:
    _ensure_analyzer_loading()


@app.get("/health")
def health() -> dict:
  return {
    "ok": True,
    "analyzer_ready": _analyzer_ready,
    "analyzer_loading": _analyzer_loading,
  }


@app.get("/")
def root() -> dict:
  return {"ok": True, "service": "SmartXcess Backend API"}


@app.post("/api/moderation/analyze")
async def analyze_assessment(
  module_code: str = Form(...),
  uploaded_by: str = Form(...),
  pdf_name: str | None = Form(default=None),
  file: UploadFile | None = File(default=None),
  encrypted_file: UploadFile | None = File(default=None),
  encrypted_aes_key: str | None = Form(default=None),
  iv: str | None = Form(default=None),
) -> dict:
  process_and_save_exam, _ = _get_loaded_analyzers()

  has_plain = file is not None
  has_encrypted = encrypted_file is not None
  if has_plain == has_encrypted:
    raise HTTPException(status_code=400, detail="Provide either 'file' or encrypted upload fields")

  payload_bytes: bytes
  filename: str

  if has_encrypted:
    if not encrypted_aes_key or not iv:
      raise HTTPException(status_code=400, detail="Missing encrypted_aes_key or iv")
    if not encrypted_file or not encrypted_file.filename:
      raise HTTPException(status_code=400, detail="Missing encrypted_file")

    encrypted_bytes = await encrypted_file.read()
    if len(encrypted_bytes) > 5 * 1024 * 1024:
      raise HTTPException(status_code=413, detail="File exceeds 5MB limit")

    try:
      raw_rsa_key = os.getenv("RSA_PRIVATE_KEY", "")
      if not raw_rsa_key:
        raise ValueError("Server missing RSA_PRIVATE_KEY configuration")

      formatted_rsa_key = raw_rsa_key.replace("\\n", "\n").encode("utf-8")
      private_key = serialization.load_pem_private_key(formatted_rsa_key, password=None)

      raw_encrypted_aes_key = base64.b64decode(encrypted_aes_key)
      aes_key = private_key.decrypt(
        raw_encrypted_aes_key,
        padding.OAEP(
          mgf=padding.MGF1(algorithm=hashes.SHA256()),
          algorithm=hashes.SHA256(),
          label=None,
        ),
      )

      raw_iv = base64.b64decode(iv)
      aesgcm = AESGCM(aes_key)
      payload_bytes = aesgcm.decrypt(raw_iv, encrypted_bytes, None)
      filename = encrypted_file.filename
    except Exception as decryption_error:
      raise HTTPException(status_code=400, detail="Decryption failed. Invalid keys or payload compromised.") from decryption_error
  else:
    if not file or not file.filename or not file.filename.lower().endswith(".pdf"):
      raise HTTPException(status_code=400, detail="Only PDF files are supported")
    payload_bytes = await file.read()
    filename = file.filename

  if len(payload_bytes) > 5 * 1024 * 1024:
    raise HTTPException(status_code=413, detail="File exceeds 5MB limit")

  if not payload_bytes.startswith(b"%PDF-"):
    raise HTTPException(status_code=400, detail="Invalid file type. Only PDFs are supported")

  suffix = Path(filename).suffix or ".pdf"
  with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
    temp_path = tmp.name
    tmp.write(payload_bytes)

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


@app.post("/api/internal-questions/upload")
async def upload_internal_questions(
  module_code: str = Form(...),
  module_name: str = Form(...),
  exam_year: str = Form(...),
  exam_month: str = Form(...),
  uploaded_by: str = Form(...),
  file: UploadFile = File(...),
) -> dict:
  _, process_and_save_internal_questions = _get_loaded_analyzers()

  if not file.filename or not file.filename.lower().endswith(".pdf"):
    raise HTTPException(status_code=400, detail="Only PDF files are supported")

  cleaned_module_code = module_code.strip().upper()
  cleaned_module_name = module_name.strip()
  cleaned_exam_year = exam_year.strip()
  cleaned_exam_month = exam_month.strip().upper()
  cleaned_uploaded_by = uploaded_by.strip()

  if not cleaned_module_code:
    raise HTTPException(status_code=400, detail="module_code is required")
  if not cleaned_module_name:
    raise HTTPException(status_code=400, detail="module_name is required")
  if not cleaned_exam_year:
    raise HTTPException(status_code=400, detail="exam_year is required")
  if not cleaned_exam_month:
    raise HTTPException(status_code=400, detail="exam_month is required")
  if not cleaned_uploaded_by:
    raise HTTPException(status_code=400, detail="uploaded_by is required")

  suffix = Path(file.filename).suffix or ".pdf"
  with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
    temp_path = tmp.name
    tmp.write(await file.read())

  try:
    result = process_and_save_internal_questions(
      temp_path,
      cleaned_module_code,
      cleaned_module_name,
      cleaned_exam_year,
      cleaned_exam_month,
      cleaned_uploaded_by,
    )
    if not result:
      raise HTTPException(status_code=500, detail="Analyzer returned no result")
    if not result.get("saved", False):
      reason = result.get("reason", "internal_upload_failed")
      if reason == "forbidden_admin_only":
        raise HTTPException(status_code=403, detail="Admin role required")
      raise HTTPException(status_code=500, detail=reason)
    return result
  finally:
    try:
      os.remove(temp_path)
    except OSError:
      pass
