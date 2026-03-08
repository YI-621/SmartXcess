import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== PARSER ====================

const MAIN_Q_RE = /^Q(?:\d+|[IVXLCDM]+)\b/i;
const LETTER_RE = /^\(([a-hj-z])\)/i;
const ROMAN_RE = /^\((i{1,3}|iv|v|vi{0,3}|ix|x)\)/i;
const MARKS_RE = /\(\d+(\.\d+)?\s*marks?\)/gi;
const TOTAL_RE = /\[.*?Total.*?\]/gi;

function clean(text: string): string {
  return text.replace(MARKS_RE, "").replace(TOTAL_RE, "").replace(/' s/g, "'s").replace(/\s+/g, " ").trim();
}

function ensureSentenceEnd(text: string): string {
  text = text.trim();
  if (!text) return text;
  if (!".?!:".includes(text[text.length - 1])) text += ".";
  return text;
}

function parseExam(text: string): Record<string, string> {
  const lines = text.split("\n");
  const result: Record<string, string> = {};
  let currentQ: string | null = null;
  let currentLetter: string | null = null;
  let letterIntro = "";
  let letterHasRoman = false;
  let currentRoman: string | null = null;
  let romanText = "";

  function saveLetter() {
    if (currentQ && currentLetter && !letterHasRoman) {
      result[`${currentQ}_${currentLetter}`] = clean(letterIntro);
    }
  }
  function saveRoman() {
    if (currentQ && currentLetter && currentRoman) {
      const parent = ensureSentenceEnd(letterIntro);
      result[`${currentQ}_${currentLetter}_${currentRoman}`] = clean(parent + " " + romanText);
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let m = line.match(MAIN_Q_RE);
    if (m) {
      if (currentRoman) saveRoman(); else saveLetter();
      currentQ = m[0].toUpperCase();
      currentLetter = null; letterIntro = ""; letterHasRoman = false;
      currentRoman = null; romanText = "";
      continue;
    }

    m = line.match(LETTER_RE);
    if (m) {
      if (currentRoman) saveRoman(); else saveLetter();
      currentLetter = m[1].toLowerCase();
      letterIntro = line.slice(m[0].length).trim();
      letterHasRoman = false; currentRoman = null; romanText = "";
      continue;
    }

    m = line.match(ROMAN_RE);
    if (m && currentLetter) {
      if (currentRoman) saveRoman();
      letterHasRoman = true;
      currentRoman = m[1].toLowerCase();
      romanText = line.slice(m[0].length).trim();
      continue;
    }

    if (currentRoman) romanText += " " + line;
    else if (currentLetter) letterIntro += " " + line;
  }

  if (currentRoman) saveRoman(); else saveLetter();
  return result;
}

// ==================== BLOOM TAXONOMY ====================

type BloomEntry = { bloom_level: string; order_level: string; type: string; refine: string };

const BLOOM_ROWS: [string, string, string, string, string][] = [
  ["acquire","knowledge","LO","U","LOTS"],["cite","knowledge","LO","U","LOTS"],["count","knowledge","LO","U","LOTS"],
  ["define","knowledge","LO","U","LOTS"],["draw","knowledge","LO","O","LOTS"],["describe","knowledge","LO","O","LOTS"],
  ["identify","knowledge","LO","U","LOTS"],["indicate","knowledge","LO","U","LOTS"],["label","knowledge","LO","U","LOTS"],
  ["list","knowledge","LO","U","LOTS"],["name","knowledge","LO","U","LOTS"],["point","knowledge","LO","U","LOTS"],
  ["quote","knowledge","LO","U","LOTS"],["read","knowledge","LO","U","LOTS"],["recall","knowledge","LO","U","LOTS"],
  ["recite","knowledge","LO","U","LOTS"],["recognize","knowledge","LO","U","LOTS"],["record","knowledge","LO","U","LOTS"],
  ["relate","knowledge","LO","O","LOTS"],["repeat","knowledge","LO","U","LOTS"],["reproduce","knowledge","LO","U","LOTS"],
  ["select","knowledge","LO","O","LOTS"],["state","knowledge","LO","U","LOTS"],["tabulate","knowledge","LO","U","LOTS"],
  ["tell","knowledge","LO","U","LOTS"],["trace","knowledge","LO","U","LOTS"],["write","knowledge","LO","O","LOTS"],
  ["fill","knowledge","LO","U","LOTS"],
  ["associate","comprehension","LO","U","LOTS"],["categorize","comprehension","LO","U","LOTS"],
  ["change","comprehension","LO","U","LOTS"],["classify","comprehension","LO","U","LOTS"],
  ["compare","comprehension","LO","U","LOTS"],["compute","comprehension","LO","U","LOTS"],
  ["contrast","comprehension","LO","U","LOTS"],["convert","comprehension","LO","U","LOTS"],
  ["describe","comprehension","LO","U","LOTS"],["discuss","comprehension","LO","U","LOTS"],
  ["differentiate","comprehension","LO","O","LOTS"],["distinguish","comprehension","LO","O","LOTS"],
  ["draw","comprehension","LO","O","LOTS"],["estimate","comprehension","LO","O","LOTS"],
  ["explain","comprehension","LO","U","LOTS"],["express","comprehension","LO","U","LOTS"],
  ["extrapolate","comprehension","LO","O","LOTS"],["illustrate","comprehension","LO","O","LOTS"],
  ["interpret","comprehension","LO","O","LOTS"],["outline","comprehension","LO","U","LOTS"],
  ["paraphrase","comprehension","LO","U","LOTS"],["predict","comprehension","LO","O","LOTS"],
  ["relate","comprehension","LO","O","LOTS"],["rephrase","comprehension","LO","U","LOTS"],
  ["report","comprehension","LO","U","LOTS"],["represent","comprehension","LO","U","LOTS"],
  ["restate","comprehension","LO","U","LOTS"],["restructure","comprehension","LO","U","LOTS"],
  ["summarize","comprehension","LO","O","LOTS"],["translate","comprehension","LO","O","LOTS"],
  ["give","comprehension","LO","U","LOTS"],["provide","comprehension","LO","U","LOTS"],
  ["elaborate","comprehension","LO","U","LOTS"],["simplify","comprehension","LO","U","LOTS"],
  ["highlight","comprehension","LO","U","LOTS"],["find","comprehension","LO","U","LOTS"],
  ["apply","application","LO","U","MOTS"],["calculate","application","LO","U","MOTS"],
  ["complete","application","LO","U","MOTS"],["compute","application","LO","U","MOTS"],
  ["demonstrate","application","LO","U","MOTS"],["determine","application","LO","O","MOTS"],
  ["dramatize","application","LO","U","MOTS"],["employ","application","LO","U","MOTS"],
  ["estimate","application","LO","O","MOTS"],["examine","application","LO","U","MOTS"],
  ["illustrate","application","LO","O","MOTS"],["interpolate","application","LO","O","MOTS"],
  ["interpret","application","LO","O","MOTS"],["locate","application","LO","U","MOTS"],
  ["operate","application","LO","U","MOTS"],["order","application","LO","U","MOTS"],
  ["practice","application","LO","U","MOTS"],["predict","application","LO","O","MOTS"],
  ["relate","application","LO","O","MOTS"],["report","application","LO","U","MOTS"],
  ["restate","application","LO","U","MOTS"],["review","application","LO","U","MOTS"],
  ["schedule","application","LO","U","MOTS"],["sketch","application","LO","U","MOTS"],
  ["solve","application","LO","U","MOTS"],["prepare","application","LO","U","MOTS"],
  ["transfer","application","LO","U","MOTS"],["transform","application","LO","U","MOTS"],
  ["translate","application","LO","U","MOTS"],["use","application","LO","U","MOTS"],
  ["utilize","application","LO","U","MOTS"],["show","application","HO","U","MOTS"],
  ["implement","application","LO","U","MOTS"],["deploy","application","LO","U","MOTS"],
  ["analyze","analysis","HO","U","MOTS"],["appraise","analysis","HO","O","MOTS"],
  ["contract","analysis","HO","U","MOTS"],["criticize","analysis","HO","U","MOTS"],
  ["debate","analysis","HO","U","MOTS"],["deduce","analysis","HO","U","MOTS"],
  ["detect","analysis","HO","U","MOTS"],["diagram","analysis","HO","U","MOTS"],
  ["differentiate","analysis","HO","O","MOTS"],["discriminate","analysis","HO","U","MOTS"],
  ["distinguish","analysis","HO","O","MOTS"],["experiment","analysis","HO","U","MOTS"],
  ["extend","analysis","HO","U","MOTS"],["extrapolate","analysis","HO","O","MOTS"],
  ["generalize","analysis","HO","U","MOTS"],["infer","analysis","HO","U","MOTS"],
  ["inspect","analysis","HO","U","MOTS"],["interpolate","analysis","HO","O","MOTS"],
  ["point out","analysis","HO","U","MOTS"],["predict","analysis","HO","O","MOTS"],
  ["question","analysis","HO","U","MOTS"],["rearrange","analysis","HO","U","MOTS"],
  ["reorder","analysis","HO","U","MOTS"],["separate","analysis","HO","U","MOTS"],
  ["summarize","analysis","HO","O","MOTS"],
  ["arrange","synthesis","HO","U","HOTS"],["assemble","synthesis","HO","U","HOTS"],
  ["collect","synthesis","HO","U","HOTS"],["combine","synthesis","HO","U","HOTS"],
  ["compose","synthesis","HO","U","HOTS"],["constitute","synthesis","HO","U","HOTS"],
  ["construct","synthesis","HO","U","HOTS"],["create","synthesis","HO","U","HOTS"],
  ["derive","synthesis","HO","U","HOTS"],["design","synthesis","HO","U","HOTS"],
  ["develop","synthesis","HO","U","HOTS"],["devise","synthesis","HO","U","HOTS"],
  ["document","synthesis","HO","U","HOTS"],["formulate","synthesis","HO","U","HOTS"],
  ["integrate","synthesis","HO","U","HOTS"],["manage","synthesis","HO","U","HOTS"],
  ["modify","synthesis","HO","U","HOTS"],["originate","synthesis","HO","U","HOTS"],
  ["organize","synthesis","HO","U","HOTS"],["plan","synthesis","HO","U","HOTS"],
  ["prepare","synthesis","HO","U","HOTS"],["prescribe","synthesis","HO","U","HOTS"],
  ["produce","synthesis","HO","U","HOTS"],["propose","synthesis","HO","U","HOTS"],
  ["reorganize","synthesis","HO","U","HOTS"],["revise","synthesis","HO","O","HOTS"],
  ["rewrite","synthesis","HO","U","HOTS"],["specify","synthesis","HO","U","HOTS"],
  ["synthesize","synthesis","HO","U","HOTS"],["transmit","synthesis","HO","U","HOTS"],
  ["write","synthesis","HO","O","HOTS"],["generate","synthesis","HO","U","HOTS"],
  ["suggest","synthesis","HO","U","HOTS"],["advise","synthesis","HO","U","HOTS"],
  ["discover","synthesis","HO","U","HOTS"],["speculate","synthesis","HO","U","HOTS"],
  ["appraise","evaluation","HO","O","HOTS"],["argue","evaluation","HO","U","HOTS"],
  ["assess","evaluation","HO","U","HOTS"],["choose","evaluation","HO","U","HOTS"],
  ["conclude","evaluation","HO","U","HOTS"],["critique","evaluation","HO","U","HOTS"],
  ["decide","evaluation","HO","U","HOTS"],["determine","evaluation","HO","O","HOTS"],
  ["estimate","evaluation","HO","O","HOTS"],["evaluate","evaluation","HO","U","HOTS"],
  ["grade","evaluation","HO","U","HOTS"],["judge","evaluation","HO","U","HOTS"],
  ["measure","evaluation","HO","U","HOTS"],["rank","evaluation","HO","U","HOTS"],
  ["rate","evaluation","HO","U","HOTS"],["recommend","evaluation","HO","U","HOTS"],
  ["revise","evaluation","HO","O","HOTS"],["score","evaluation","HO","U","HOTS"],
  ["select","evaluation","HO","O","HOTS"],["standardize","evaluation","HO","U","HOTS"],
  ["test","evaluation","HO","U","HOTS"],["validate","evaluation","HO","U","HOTS"],
  ["weigh","evaluation","HO","U","HOTS"],["defend","evaluation","HO","U","HOTS"],
  ["justify","evaluation","HO","U","HOTS"],["comment","evaluation","HO","U","HOTS"],
  ["prove","evaluation","HO","U","HOTS"],
];

function buildBloomDict(): Record<string, BloomEntry[]> {
  const dict: Record<string, BloomEntry[]> = {};
  for (const [keyword, level, order, typ, refine] of BLOOM_ROWS) {
    const k = keyword.toLowerCase();
    if (!dict[k]) dict[k] = [];
    dict[k].push({ bloom_level: level, order_level: order, type: typ, refine });
  }
  return dict;
}

function preScanBloom(questionText: string, bloomDict: Record<string, BloomEntry[]>): Record<string, string[]> {
  const potential: Record<string, string[]> = {};
  const lower = questionText.toLowerCase();
  for (const keyword of Object.keys(bloomDict)) {
    const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) {
      potential[keyword] = [...new Set(bloomDict[keyword].map((e) => e.bloom_level))];
    }
  }
  return potential;
}

// Map bloom level name to the 6-level Bloom names used in DB
function normalizeBloomLevel(level: string): string {
  const l = level.toLowerCase().trim();
  if (l.includes("knowledge") || l === "remember" || l === "remembering") return "Knowledge";
  if (l.includes("comprehension") || l === "understand" || l === "understanding") return "Comprehension";
  if (l.includes("application") || l === "apply" || l === "applying") return "Application";
  if (l.includes("analysis") || l === "analyze" || l === "analysing" || l === "analyzing") return "Analysis";
  if (l.includes("synthesis") || l === "create" || l === "creating") return "Synthesis";
  if (l.includes("evaluation") || l === "evaluate" || l === "evaluating") return "Evaluation";
  return "Knowledge";
}

function complexityToNumber(c: string): number {
  const l = c.toLowerCase().trim();
  if (l === "high") return 80;
  if (l === "medium") return 50;
  if (l === "low") return 25;
  return 50;
}

function bloomToDifficulty(bloomLevel: string): string {
  const l = bloomLevel.toLowerCase();
  if (["knowledge", "comprehension", "remember", "understand"].some((x) => l.includes(x))) return "Easy";
  if (["application", "analysis", "apply", "analyze"].some((x) => l.includes(x))) return "Medium";
  return "Hard";
}

// ==================== AI ANALYSIS ====================

async function getComprehensiveAnalysis(
  questionText: string,
  potentialBloom: Record<string, string[]>,
  moduleName: string
): Promise<Record<string, string>> {
  const keywordsStr = Object.keys(potentialBloom).length > 0
    ? Object.entries(potentialBloom).map(([k, v]) => `'${k}' (${v.join("/")})`).join(", ")
    : "None";

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an educational quality auditor for the module: ${moduleName}.\nAnalyze the question and strictly return the following fields. Do not include any introductory or concluding remarks.`,
        },
        {
          role: "user",
          content: `Question: "${questionText}"\nPotential Bloom Keywords Found: ${keywordsStr}\n\nReturn exactly in this format:\nComplexity: [High/Medium/Low]\nValidated Bloom Keywords: [Keywords from list acting as commands]\nFinal Bloom Level: [Level Name]\nGrammar spelling error: [List errors or None]\nGrammar Structure suggestion: [Grammar structure suggestion]\nRelevancy to Module Scope: [Yes/No]\nGrammar Suggestion: [Revised question]`,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI Gateway error:", errText);
    return { error: errText, final_bloom_level: "Error" };
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content ?? "";

  const analysis: Record<string, string> = {
    complexity: "N/A",
    validated_bloom_keywords: "None",
    final_bloom_level: "Unclassified",
    grammar_errors: "N/A",
    grammar_structure: "N/A",
    relevancy_to_scope: "N/A",
    suggestion: "N/A",
  };

  const patterns: Record<string, RegExp> = {
    complexity: /Complexity:\s*(.*)/i,
    validated_bloom_keywords: /Validated Bloom Keywords:\s*(.*)/i,
    final_bloom_level: /Final Bloom Level:\s*(.*)/i,
    grammar_errors: /Grammar spelling error:\s*(.*)/i,
    grammar_structure: /Grammar Structure(?:\s*suggestion)?:\s*(.*)/i,
    relevancy_to_scope: /Relevancy to Module Scope:\s*(.*)/i,
    suggestion: /Grammar Suggestion:\s*(.*)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = responseText.match(pattern);
    if (match) {
      analysis[key] = match[1].trim().replace(/\*\*/g, "");
    }
  }

  return analysis;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assessment_id } = await req.json();
    if (!assessment_id) {
      return new Response(JSON.stringify({ error: "assessment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch assessment
    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessment_id)
      .single();
    if (aErr || !assessment) {
      return new Response(JSON.stringify({ error: "Assessment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("assessments")
      .download(assessment.file_url);
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Could not download file: " + (dlErr?.message ?? "unknown") }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileText = await fileData.text();

    // Parse exam questions
    const parsedQuestions = parseExam(fileText);
    const questionIds = Object.keys(parsedQuestions);

    if (questionIds.length === 0) {
      // Update assessment with 0 score
      await supabase.from("assessments").update({ overall_score: 0, status: "Pending" }).eq("id", assessment_id);
      return new Response(JSON.stringify({ message: "No questions parsed from file", questions: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bloomDict = buildBloomDict();
    const moduleName = assessment.module_code || assessment.course || "General";

    // Analyze each question with AI
    const questionsToInsert = [];
    let totalComplexity = 0;
    let totalSimilarity = 0;

    for (let i = 0; i < questionIds.length; i++) {
      const qid = questionIds[i];
      const text = parsedQuestions[qid];

      // Pre-scan bloom keywords
      const potentialBloom = preScanBloom(text, bloomDict);

      // AI analysis
      const analysis = await getComprehensiveAnalysis(text, potentialBloom, moduleName);

      const bloomLevel = normalizeBloomLevel(analysis.final_bloom_level);
      const complexity = complexityToNumber(analysis.complexity);
      const difficulty = bloomToDifficulty(analysis.final_bloom_level);
      const validatedKeywords = analysis.validated_bloom_keywords !== "None"
        ? analysis.validated_bloom_keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        : Object.keys(potentialBloom);

      totalComplexity += complexity;

      questionsToInsert.push({
        assessment_id,
        text,
        marks: 0, // marks not available from parser
        bloom_level: bloomLevel,
        difficulty,
        complexity,
        similarity_score: 0,
        similar_to: null,
        keywords: validatedKeywords,
        question_order: i + 1,
        moderation_details: {
          question_id: qid,
          grammar_errors: analysis.grammar_errors,
          grammar_structure: analysis.grammar_structure,
          relevancy_to_scope: analysis.relevancy_to_scope,
          suggestion: analysis.suggestion,
          validated_bloom_keywords: analysis.validated_bloom_keywords,
          raw_complexity: analysis.complexity,
        },
      });
    }

    // Insert questions
    const { error: insertErr } = await supabase.from("questions").insert(questionsToInsert);
    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to insert questions: " + insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate overall score based on average complexity and bloom coverage
    const avgComplexity = totalComplexity / questionIds.length;
    const bloomCoverage = new Set(questionsToInsert.map((q) => q.bloom_level)).size;
    const overallScore = Math.round((avgComplexity * 0.6) + (bloomCoverage / 6 * 100 * 0.4));

    // Update assessment
    await supabase
      .from("assessments")
      .update({ overall_score: Math.min(overallScore, 100), status: "Pending" })
      .eq("id", assessment_id);

    return new Response(
      JSON.stringify({
        message: "Moderation complete",
        questions: questionIds.length,
        overall_score: Math.min(overallScore, 100),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
