import os
import time
import re
import copy
import math
from pathlib import Path
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer
from groq import Groq
from tavily import TavilyClient
from dotenv import load_dotenv

# ==========================================
# 1. IMPORT PDF EXTRACTION TOOLS
# ==========================================
from .part1_extract import extract_pdf_lines
from .part2_parse import parse_exam

# ==========================================
# 2. API KEYS & CONFIGURATION (LOADED FROM ENV)
# ==========================================
# Load backend/.env first (if present), then root .env without overriding existing values.
_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
if _BACKEND_ENV.exists():
    load_dotenv(_BACKEND_ENV)
if _ROOT_ENV.exists():
    load_dotenv(_ROOT_ENV, override=False)


def require_env(name: str, aliases: tuple[str, ...] = ()) -> str:
    keys = (name, *aliases)
    for key in keys:
        value = os.getenv(key)
        if value:
            return value
    alias_text = f" (aliases: {', '.join(aliases)})" if aliases else ""
    raise RuntimeError(f"Missing required environment variable: {name}{alias_text}")


# --- Supabase Config (Internal Database) ---
SUPABASE_URL = require_env("SUPABASE_URL", aliases=("VITE_SUPABASE_URL",))
SUPABASE_KEY = require_env(
    "SUPABASE_SERVICE_ROLE_KEY",
    aliases=("SUPABASE_KEY",),
)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Groq Config (AI Brain - Shared by both engines) ---
GROQ_API_KEY_SIMILARITY = require_env("GROQ_API_KEY_SIMILARITY")
GROQ_API_KEY_BLOOM = require_env("GROQ_API_KEY_BLOOM")
# We instantiate two clients to respect both original codes
groq_sim_client = Groq(api_key=GROQ_API_KEY_SIMILARITY)
groq_bloom_client = Groq(api_key=GROQ_API_KEY_BLOOM)

# --- Tavily Config (Live Internet Search) ---
TAVILY_API_KEY = require_env("TAVILY_API_KEY")
tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

print("🤖 SYSTEM BOOTING: Loading AI Engines...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ ALL RADARS ONLINE (Similarity RAG + Bloom LLM)\n")

# =========================================================
# 3. FRIEND'S ENGINE: BLOOM TAXONOMY & GRAMMAR SECTION
# =========================================================
BLOOM_ROWS = [
    # ---------------- KNOWLEDGE ----------------
("acquire","knowledge","LO","U","LOTS"),
("cite","knowledge","LO","U","LOTS"),
("count","knowledge","LO","U","LOTS"),
("define","knowledge","LO","U","LOTS"),
("draw","knowledge","LO","O","LOTS"),
("describe","knowledge","LO","O","LOTS"),
("identify","knowledge","LO","U","LOTS"),
("indicate","knowledge","LO","U","LOTS"),
("label","knowledge","LO","U","LOTS"),
("list","knowledge","LO","U","LOTS"),
("name","knowledge","LO","U","LOTS"),
("point","knowledge","LO","U","LOTS"),
("quote","knowledge","LO","U","LOTS"),
("read","knowledge","LO","U","LOTS"),
("recall","knowledge","LO","U","LOTS"),
("recite","knowledge","LO","U","LOTS"),
("recognize","knowledge","LO","U","LOTS"),
("record","knowledge","LO","U","LOTS"),
("relate","knowledge","LO","O","LOTS"),
("repeat","knowledge","LO","U","LOTS"),
("reproduce","knowledge","LO","U","LOTS"),
("select","knowledge","LO","O","LOTS"),
("state","knowledge","LO","U","LOTS"),
("tabulate","knowledge","LO","U","LOTS"),
("tell","knowledge","LO","U","LOTS"),
("trace","knowledge","LO","U","LOTS"),
("write","knowledge","LO","O","LOTS"),
("fill","knowledge","LO","U","LOTS"),


# ---------------- COMPREHENSION ----------------
("associate","comprehension","LO","U","LOTS"),
("categorize","comprehension","LO","U","LOTS"),
("change","comprehension","LO","U","LOTS"),
("classify","comprehension","LO","U","LOTS"),
("compare","comprehension","LO","U","LOTS"),
("compute","comprehension","LO","U","LOTS"),
("contrast","comprehension","LO","U","LOTS"),
("convert","comprehension","LO","U","LOTS"),
("describe","comprehension","LO","U","LOTS"),
("discuss","comprehension","LO","U","LOTS"),
("differentiate","comprehension","LO","O","LOTS"),
("distinguish","comprehension","LO","O","LOTS"),
("draw","comprehension","LO","O","LOTS"),
("estimate","comprehension","LO","O","LOTS"),
("explain","comprehension","LO","U","LOTS"),
("express","comprehension","LO","U","LOTS"),
("extrapolate","comprehension","LO","O","LOTS"),
("illustrate","comprehension","LO","O","LOTS"),
("interpret","comprehension","LO","O","LOTS"),
("outline","comprehension","LO","U","LOTS"),
("paraphrase","comprehension","LO","U","LOTS"),
("predict","comprehension","LO","O","LOTS"),
("relate","comprehension","LO","O","LOTS"),
("rephrase","comprehension","LO","U","LOTS"),
("report","comprehension","LO","U","LOTS"),
("represent","comprehension","LO","U","LOTS"),
("restate","comprehension","LO","U","LOTS"),
("restructure","comprehension","LO","U","LOTS"),
("summarize","comprehension","LO","O","LOTS"),
("translate","comprehension","LO","O","LOTS"),
("give","comprehension","LO","U","LOTS"),
("provide","comprehension","LO","U","LOTS"),
("elaborate","comprehension","LO","U","LOTS"),
("simplify","comprehension","LO","U","LOTS"),
("highlight","comprehension","LO","U","LOTS"),
("find","comprehension","LO","U","LOTS"),

# ---------------- APPLICATION ----------------
("apply","application","LO","U","MOTS"),
("calculate","application","LO","U","MOTS"),
("complete","application","LO","U","MOTS"),
("compute","application","LO","U","MOTS"),
("demonstrate","application","LO","U","MOTS"),
("determine","application","LO","O","MOTS"),
("dramatize","application","LO","U","MOTS"),
("employ","application","LO","U","MOTS"),
("estimate","application","LO","O","MOTS"),
("examine","application","LO","U","MOTS"),
("illustrate","application","LO","O","MOTS"),
("interpolate","application","LO","O","MOTS"),
("interpret","application","LO","O","MOTS"),
("locate","application","LO","U","MOTS"),
("operate","application","LO","U","MOTS"),
("order","application","LO","U","MOTS"),
("practice","application","LO","U","MOTS"),
("predict","application","LO","O","MOTS"),
("relate","application","LO","O","MOTS"),
("report","application","LO","U","MOTS"),
("restate","application","LO","U","MOTS"),
("review","application","LO","U","MOTS"),
("schedule","application","LO","U","MOTS"),
("sketch","application","LO","U","MOTS"),
("solve","application","LO","U","MOTS"),
("prepare","application","LO","U","MOTS"),
("transfer","application","LO","U","MOTS"),
("transform","application","LO","U","MOTS"),
("translate","application","LO","U","MOTS"),
("use","application","LO","U","MOTS"),
("utilize","application","LO","U","MOTS"),
("show","application","HO","U","MOTS"),
("implement","application","LO","U","MOTS"),
("deploy","application","LO","U","MOTS"),

# ---------------- ANALYSIS ----------------
("analyze","analysis","HO","U","MOTS"),
("appraise","analysis","HO","O","MOTS"),
("contract","analysis","HO","U","MOTS"),
("criticize","analysis","HO","U","MOTS"),
("debate","analysis","HO","U","MOTS"),
("deduce","analysis","HO","U","MOTS"),
("detect","analysis","HO","U","MOTS"),
("diagram","analysis","HO","U","MOTS"),
("differentiate","analysis","HO","O","MOTS"),
("discriminate","analysis","HO","U","MOTS"),
("distinguish","analysis","HO","O","MOTS"),
("experiment","analysis","HO","U","MOTS"),
("extend","analysis","HO","U","MOTS"),
("extrapolate","analysis","HO","O","MOTS"),
("generalize","analysis","HO","U","MOTS"),
("infer","analysis","HO","U","MOTS"),
("inspect","analysis","HO","U","MOTS"),
("interpolate","analysis","HO","O","MOTS"),
("point out","analysis","HO","U","MOTS"),
("predict","analysis","HO","O","MOTS"),
("question","analysis","HO","U","MOTS"),
("rearrange","analysis","HO","U","MOTS"),
("reorder","analysis","HO","U","MOTS"),
("separate","analysis","HO","U","MOTS"),
("summarize","analysis","HO","O","MOTS"),

# ---------------- SYNTHESIS ----------------
("arrange","synthesis","HO","U","HOTS"),
("assemble","synthesis","HO","U","HOTS"),
("collect","synthesis","HO","U","HOTS"),
("combine","synthesis","HO","U","HOTS"),
("compose","synthesis","HO","U","HOTS"),
("constitute","synthesis","HO","U","HOTS"),
("construct","synthesis","HO","U","HOTS"),
("create","synthesis","HO","U","HOTS"),
("derive","synthesis","HO","U","HOTS"),
("design","synthesis","HO","U","HOTS"),
("develop","synthesis","HO","U","HOTS"),
("devise","synthesis","HO","U","HOTS"),
("document","synthesis","HO","U","HOTS"),
("formulate","synthesis","HO","U","HOTS"),
("integrate","synthesis","HO","U","HOTS"),
("manage","synthesis","HO","U","HOTS"),
("modify","synthesis","HO","U","HOTS"),
("originate","synthesis","HO","U","HOTS"),
("organize","synthesis","HO","U","HOTS"),
("plan","synthesis","HO","U","HOTS"),
("prepare","synthesis","HO","U","HOTS"),
("prescribe","synthesis","HO","U","HOTS"),
("produce","synthesis","HO","U","HOTS"),
("propose","synthesis","HO","U","HOTS"),
("reorganize","synthesis","HO","U","HOTS"),
("revise","synthesis","HO","O","HOTS"),
("rewrite","synthesis","HO","U","HOTS"),
("specify","synthesis","HO","U","HOTS"),
("synthesize","synthesis","HO","U","HOTS"),
("transmit","synthesis","HO","U","HOTS"),
("write","synthesis","HO","O","HOTS"),
("generate","synthesis","HO","U","HOTS"),
("suggest","synthesis","HO","U","HOTS"),
("advise","synthesis","HO","U","HOTS"),
("discover","synthesis","HO","U","HOTS"),
("speculate","synthesis","HO","U","HOTS"),

# ---------------- EVALUATION ----------------
("appraise","evaluation","HO","O","HOTS"),
("argue","evaluation","HO","U","HOTS"),
("assess","evaluation","HO","U","HOTS"),
("choose","evaluation","HO","U","HOTS"),
("conclude","evaluation","HO","U","HOTS"),
("critique","evaluation","HO","U","HOTS"),
("decide","evaluation","HO","U","HOTS"),
("determine","evaluation","HO","O","HOTS"),
("estimate","evaluation","HO","O","HOTS"),
("evaluate","evaluation","HO","U","HOTS"),
("grade","evaluation","HO","U","HOTS"),
("judge","evaluation","HO","U","HOTS"),
("measure","evaluation","HO","U","HOTS"),
("rank","evaluation","HO","U","HOTS"),
("rate","evaluation","HO","U","HOTS"),
("recommend","evaluation","HO","U","HOTS"),
("revise","evaluation","HO","O","HOTS"),
("score","evaluation","HO","U","HOTS"),
("select","evaluation","HO","O","HOTS"),
("standardize","evaluation","HO","U","HOTS"),
("test","evaluation","HO","U","HOTS"),
("validate","evaluation","HO","U","HOTS"),
("weigh","evaluation","HO","U","HOTS"),
("defend","evaluation","HO","U","HOTS"),
("justify","evaluation","HO","U","HOTS"),
("comment","evaluation","HO","U","HOTS"),
("prove","evaluation","HO","U","HOTS"),
]

def build_bloom_dict():
    bloom_dict = {}
    for keyword, level, order, typ, refine in BLOOM_ROWS:
        record = {"bloom_level": level, "order_level": order, "type": typ, "refine_order_level": refine}
        bloom_dict.setdefault(keyword.lower(), []).append(record)
    return bloom_dict

def compile_keyword_patterns(bloom_dict):
    return {k: re.compile(r'\b' + re.escape(k) + r'\b', re.I) for k in bloom_dict}

def pre_scan_bloom(question_text, bloom_dict, patterns):
    """Detects potential keywords using regex to pass to LLM for validation."""
    potential = {}
    for keyword, pattern in patterns.items():
        if pattern.search(question_text):
            levels = list(set([item["bloom_level"] for item in bloom_dict[keyword]]))
            potential[keyword] = levels
    return potential

def get_comprehensive_analysis(question_text, potential_bloom, module):
    keywords_str = ", ".join([f"'{k}' ({'/'.join(v)})" for k, v in potential_bloom.items()]) if potential_bloom else "None"
    try:
        completion = groq_bloom_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are an educational quality auditor for the module: {module}.\n"
                        "Analyze the question and strictly return the requested fields. "
                        "Do not include any introductory or concluding remarks."
                        "There will be no Bloom Levels if no validated Bloom Keywords"
                        "If there are two or more validated Bloom Keywords that belong to different levels, assign the higher level as the Final Bloom Level. "
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Question: \"{question_text}\"\n"
                        f"Potential Bloom Keywords Found: {keywords_str}\n\n"
                        "Return exactly in this format:\n"
                        "Complexity (Difficulty): [Very Easy/Easy/Medium/Hard/Very Hard]\n"
                        "Reason of Complexity: [Explain why this difficulty level was assigned based on the cognitive effort required]\n"
                        "Validated Bloom Keywords: [Keywords from list filtered according to rules: Select the instructional verb that directs the student’s task.Ignore verbs inside explanatory phrases or subordinate clauses.Ignore verbs that describe concepts, processes, or objects in the question.]\n"
                        "Final Bloom Level: [Knowledge/Comprehension/Application/Analysis/Synthesis/Evaluation]\n"
                        "Grammar spelling error: [List errors or None]\n"
                        "Grammar Structure: [Analysis of sentence structure]\n"
                        "Relevancy to Module Scope: [Rate in 1-5]\n"
                        "Suggestion: [Suggest how to improve the question without changing its meaning, especially if no bloom keywords were validated]"
                    )
                }
            ],
            temperature=0.1
        )
        response_text = completion.choices[0].message.content
        
        analysis = {
            "difficulty": "Medium", "difficulty_reason": "N/A", "validated_bloom_keywords": "None", "final_bloom_level": "Unclassified",
            "grammar_errors": "N/A", "grammar_structure": "N/A", "relevancy_to_scope": "N/A", "suggestion": "N/A"
        }
        
        patterns = {
            "difficulty": [
                r"^\s*(?:Complexity\s*\(\s*Difficulty\s*\)|Difficulty)\s*:\s*(.+)$",
            ],
            "difficulty_reason": [
                r"^\s*Reason\s+of\s+Complexity\s*:\s*(.+)$",
                r"^\s*Reason\s+of\s+Difficulty\s*:\s*(.+)$",
                r"^\s*Reason\s+of\s+Diffculty\s*:\s*(.+)$",
            ],
            "validated_bloom_keywords": [
                r"^\s*Validated\s+Bloom\s+Keywords\s*:\s*(.+)$",
            ],
            "final_bloom_level": [
                r"^\s*Final\s+Bloom\s+Level\s*:\s*(.+)$",
            ],
            "grammar_errors": [
                r"^\s*Grammar\s+spelling\s+error\s*:\s*(.+)$",
            ],
            "grammar_structure": [
                r"^\s*Grammar\s+Structure\s*:\s*(.+)$",
            ],
            "relevancy_to_scope": [
                r"^\s*Relevancy\s+to\s+Module\s+Scope\s*:\s*(.+)$",
            ],
            "suggestion": [
                r"^\s*Suggestion\s*:\s*(.+)$",
                r"^\s*Grammar\s+Suggestion\s*:\s*(.+)$",
            ],
        }

        for key, pattern_list in patterns.items():
            for pattern in pattern_list:
                match = re.search(pattern, response_text, re.IGNORECASE | re.MULTILINE)
                if match:
                    analysis[key] = match.group(1).strip().replace("**", "")
                    break
        return analysis
    except Exception as e:
        return {"error": str(e), "final_bloom_level": "Error"}

# =========================================================
# 4. YOUR ENGINE: SIMILARITY CHECK SECTION
# =========================================================
def check_internal(query_vector, target_module):
    target_module = (target_module or "").strip().upper()

    def _to_float_list(value):
        if isinstance(value, list):
            try:
                return [float(x) for x in value]
            except Exception:
                return None
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("[") and text.endswith("]"):
                try:
                    parts = [p.strip() for p in text[1:-1].split(",") if p.strip()]
                    return [float(p) for p in parts]
                except Exception:
                    return None
        return None

    def _cosine(a, b):
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    normalized_query = _to_float_list(query_vector)
    if not normalized_query:
        return []

    # Preferred path: RPC if available in deployed DB.
    try:
        response = supabase.rpc('match_questions', {
            'query_embedding': normalized_query, 'match_threshold': 0.6, 'match_count': 1, 'target_module': target_module
        }).execute()
        if response.data:
            return response.data
    except Exception as e:
        print(f"⚠ RPC match_questions unavailable/failed, using table fallback: {e}")

    # Fallback path: table scan with local cosine for environments missing RPC.
    try:
        rows_response = (
            supabase
            .table("internal_questions")
            .select("question_id,module_code,embedding")
            .eq("module_code", target_module)
            .limit(500)
            .execute()
        )
        rows = rows_response.data or []
        if not rows:
            return []

        best = None
        for row in rows:
            embedding = _to_float_list(row.get("embedding"))
            if not embedding:
                continue
            sim = _cosine(normalized_query, embedding)
            if best is None or sim > best["similarity"]:
                best = {
                    "question_id": row.get("question_id", "unknown"),
                    "module_code": row.get("module_code", target_module),
                    "similarity": float(sim),
                }

        if not best or best["similarity"] < 0.6:
            return []
        return [best]
    except Exception as e:
        print(f"❌ Internal similarity fallback failed: {e}")
        return []

def check_external(test_text):
    try:
        tavily_response = tavily_client.search(query=test_text, search_depth="basic", max_results=2)
        internet_context = ""
        for result in tavily_response.get('results', []):
            internet_context += f"- Source: {result['url']}\n- Content: {result['content'][:300]}\n\n"
            
        if not internet_context.strip():
            return 0.0, "None", "No exact internet matches found."

        prompt = f"Act as a strict academic plagiarism detector.\nQuestion: \"{test_text}\"\nInternet Evidence: {internet_context}\nFormat your response exactly like this:\n[Probability: X%] | [Source: URL or 'None'] | [Reason: 1 short sentence]"
        
        chat_completion = groq_sim_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}], model="llama-3.3-70b-versatile", temperature=0.1, max_tokens=150
        )
        report_text = chat_completion.choices[0].message.content.strip()
        
        prob_match = re.search(r'Probability:\s*(\d+)', report_text, re.IGNORECASE)
        source_match = re.search(r'Source:\s*([^|\]]+)', report_text, re.IGNORECASE)
        reason_match = re.search(r'Reason:\s*([^\]]+)', report_text, re.IGNORECASE)
        
        ext_prob = float(prob_match.group(1)) if prob_match else 0.0
        ext_source = source_match.group(1).strip() if source_match else "None"
        ext_reason = reason_match.group(1).strip() if reason_match else "AI analysis failed to provide a reason."
        
        return ext_prob, ext_source, ext_reason
    except Exception as e:
        return 0.0, "Error", str(e)


def normalize_difficulty(value: str | None) -> str:
    if not value:
        return "Medium"

    cleaned = str(value).strip().lower()
    mapping = {
        "very easy": "Very Easy",
        "easy": "Easy",
        "medium": "Medium",
        "high": "Hard",
        "very high": "Very Hard",
        "hard": "Hard",
        "very hard": "Very Hard",
    }
    direct = mapping.get(cleaned)
    if direct:
        return direct

    collapsed = cleaned.replace("-", " ").replace("_", " ")
    if "very hard" in collapsed:
        return "Very Hard"
    if "very high" in collapsed:
        return "Very Hard"
    if "very easy" in collapsed:
        return "Very Easy"
    if "high" in collapsed:
        return "Hard"
    if "hard" in collapsed:
        return "Hard"
    if "easy" in collapsed:
        return "Easy"
    if "medium" in collapsed:
        return "Medium"

    return "Medium"


def _insert_with_schema_fallback(table_name: str, rows: list[dict], warning_prefix: str) -> None:
    """Insert rows and drop unknown columns reported by PostgREST schema drift errors."""
    candidate_rows = copy.deepcopy(rows)

    while True:
        try:
            supabase.table(table_name).insert(candidate_rows).execute()
            return
        except Exception as insert_error:
            error_text = str(insert_error)
            missing_col_match = re.search(r"Could not find the '([^']+)' column", error_text)
            if not missing_col_match:
                raise

            missing_col = missing_col_match.group(1)
            print(f"   ⚠ {warning_prefix}: dropping unknown column '{missing_col}' and retrying...")
            for row in candidate_rows:
                row.pop(missing_col, None)

# =========================================================
# 5. CORE SYSTEM: MERGE & SAVE (ONE ROW PER QUESTION)
# =========================================================
def process_and_save_exam(pdf_filename, target_module, user_name, custom_pdf_name=None):
    print(f"\n🚀 SYSTEM INITIATED: Processing {pdf_filename}...")

    source_filename = os.path.basename(pdf_filename)
    if custom_pdf_name:
        normalized_name = os.path.basename(custom_pdf_name.strip())
        if normalized_name and not normalized_name.lower().endswith(".pdf"):
            normalized_name = f"{normalized_name}.pdf"
        if normalized_name:
            source_filename = normalized_name
    
    lines = extract_pdf_lines(pdf_filename)
    raw_text = "\n".join(lines)
    clean_paper_name = source_filename.replace(".pdf", "").replace(" ", "_") 
    exam_data = parse_exam(raw_text, paper_id=clean_paper_name)
    
    if not exam_data:
        print("❌ ERROR: Failed to extract questions. Please check the PDF format.")
        return {"saved": False, "reason": "no_questions_extracted", "rows": 0, "overall_similarity": 0}

    bloom_dict = build_bloom_dict()
    bloom_patterns = compile_keyword_patterns(bloom_dict)

    total_paper_words = 0
    total_internal_plagiarized_words = 0
    total_external_plagiarized_words = 0
    all_questions_data = []

    for q_id, q_text in exam_data.items():
        words_in_question = len(q_text.split())
        total_paper_words += words_in_question

        final_q_id = q_id.replace("QL", "Q1")
        
        print(f"   🔍 Analyzing: {final_q_id}...")
        query_vector = model.encode(q_text).tolist()
        
        # --- Engine 1 Logic ---
        internal_score = 0.0
        internal_source = "None"
        internal_reason = "No matching past papers found in Taylor's database."
        
        internal_results = check_internal(query_vector, target_module)
        if internal_results:
            match = internal_results[0]
            internal_score = round(match['similarity'] * 100, 1)
            internal_source = f"Taylor's Past Paper: {match['question_id']}"
            internal_reason = "High semantic similarity found in internal database."
        
        external_score = 0.0
        external_source = "None"
        external_reason = "No internet plagiarism detected."

        if internal_score > 80.0:
            external_reason = "The internal database already confirmed plagiarism."
        elif words_in_question < 8:
            external_reason = "Question too short for accurate internet search."
        else:
            time.sleep(1.2)
            external_score, external_source, external_reason = check_external(q_text)

        final_sim_score = max(internal_score, external_score)
        if internal_score >= external_score:
            final_source, final_reason = internal_source, internal_reason
        else:
            final_source, final_reason = external_source, external_reason
            
        # Accumulate internal and external plagiarized words separately
        total_internal_plagiarized_words += words_in_question * (internal_score / 100)
        total_external_plagiarized_words += words_in_question * (external_score / 100)

        # --- Engine 2 Logic ---
        potential_bloom = pre_scan_bloom(q_text, bloom_dict, bloom_patterns)
        llm_info = get_comprehensive_analysis(q_text, potential_bloom, target_module)

        # --- Prepare Data ---
        question_row_data = {
            "module_code": target_module,
            "filename": source_filename,
            "uploaded_by": user_name,
            "question_id": final_q_id,
            "question_text": q_text,
            "word_count": words_in_question,
            "internal_similarity_score": internal_score,
            "external_similarity_score": external_score,
            "final_sim_score": final_sim_score,
            "similarity_source": final_source,
            "similarity_reason": final_reason,
            "regex_detected_potential": str(potential_bloom) if potential_bloom else "N/A",
            "validated_bloom_keywords": llm_info.get("validated_bloom_keywords", "None"),
            "final_bloom_level": llm_info.get("final_bloom_level", "Unclassified"),
            "difficulty": normalize_difficulty(llm_info.get("difficulty", "Medium")),
            "difficulty_reason": llm_info.get("difficulty_reason", "N/A"),
            "grammar_spelling_error": llm_info.get("grammar_errors", "N/A"),
            "grammar_structure": llm_info.get("grammar_structure", "N/A"),
            "relevancy_to_scope": llm_info.get("relevancy_to_scope", "N/A"),
            "suggestion": llm_info.get("suggestion", "N/A")
        }
        
        all_questions_data.append(question_row_data)
        print(f"   ✅ Processed: {final_q_id}")

    # ==========================================
    # 6. FINAL REPORT CALCULATION 
    # ==========================================
    print("\n" + "=" * 80)
    if total_paper_words > 0:
        overall_internal = (total_internal_plagiarized_words / total_paper_words) * 100
        overall_external = (total_external_plagiarized_words / total_paper_words) * 100
        overall_score = max(overall_internal, overall_external)
        
        for item in all_questions_data:
            item["overall_internal_similarity"] = round(overall_internal, 1)
            item["overall_external_similarity"] = round(overall_external, 1)
        
        print("   💾 Saving all results to Supabase...")
        try:
            _insert_with_schema_fallback(
                "question_analysis_results",
                all_questions_data,
                "Schema mismatch",
            )

            print(f"🏆 OVERALL PAPER SIMILARITY: {overall_score:.1f}%")
            print("   ✅ SUCCESS: All data securely stored!")
            return {
                "saved": True,
                "reason": "ok",
                "rows": len(all_questions_data),
                "overall_similarity": round(overall_score, 1),
                "filename": source_filename,
                "module_code": target_module,
            }
        except Exception as e:
            print(f"❌ DATABASE ERROR: {e}")
            return {
                "saved": False,
                "reason": f"database_error: {e}",
                "rows": len(all_questions_data),
                "overall_similarity": round(overall_score, 1),
            }
    else:
        print("⚠️ WARNING: No questions were processed. Check your PDF text extraction.")
        return {"saved": False, "reason": "no_words_processed", "rows": 0, "overall_similarity": 0}
    print("=" * 80)


def _is_admin_user(user_id: str) -> bool:
    try:
        response = (
            supabase
            .table("user_roles")
            .select("user_id")
            .eq("user_id", user_id)
            .eq("role", "admin")
            .limit(1)
            .execute()
        )
        return bool(response.data)
    except Exception:
        return False


def process_and_save_internal_questions(
    pdf_filename,
    module_code,
    module_name,
    exam_year,
    exam_month,
    uploaded_by,
):
    if not _is_admin_user(uploaded_by):
        return {
            "saved": False,
            "reason": "forbidden_admin_only",
            "rows": 0,
        }

    print(f"\n📚 INTERNAL BANK INGEST: Processing {pdf_filename}...")

    lines = extract_pdf_lines(pdf_filename)
    raw_text = "\n".join(lines)
    paper_prefix = f"{module_code}_{exam_year}_{exam_month}"
    exam_data = parse_exam(raw_text, paper_id=paper_prefix)

    if not exam_data:
        return {
            "saved": False,
            "reason": "no_questions_extracted",
            "rows": 0,
        }

    rows_to_insert = []
    for q_id, q_text in exam_data.items():
        final_q_id = q_id.replace("QL", "Q1")
        query_vector = model.encode(q_text).tolist()
        rows_to_insert.append({
            "question_id": final_q_id,
            "question_text": q_text,
            "module_code": module_code,
            "module_name": module_name,
            "exam_year": exam_year,
            "exam_month": exam_month,
            "uploaded_by": uploaded_by,
            "embedding": query_vector,
        })

    try:
        _insert_with_schema_fallback(
            "internal_questions",
            rows_to_insert,
            "Schema mismatch on internal_questions",
        )

        return {
            "saved": True,
            "reason": "ok",
            "rows": len(rows_to_insert),
            "module_code": module_code,
            "module_name": module_name,
            "exam_year": exam_year,
            "exam_month": exam_month,
        }
    except Exception as e:
        return {
            "saved": False,
            "reason": f"database_error: {e}",
            "rows": len(rows_to_insert),
        }

# ==========================================
# 7. MAIN LECTURER INTERFACE
# ==========================================
if __name__ == "__main__":
    print("=" * 80)
    print("   🚨 AI EXAM MODERATION SYSTEM 🚨")
    print("=" * 80)
    
    user_name = input("\n👉 Enter your Name: ").strip()
    
    while True:
        target_module = input("\n👉 Enter Module Code (or 'exit'): ").strip().upper()
        if target_module.lower() == 'exit':
            break
            
        pdf_file = input("👉 Enter the PDF filename: ").strip()
        
        if os.path.exists(pdf_file):
            process_and_save_exam(pdf_file, target_module, user_name)
        else:
            print(f"❌ ERROR: File '{pdf_file}' not found.")