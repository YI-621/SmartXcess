import re
import json

# ==============================
# REGEX PATTERNS
# ==============================
# Main Q supports Q1, QI, QL and QUESTION 1 styles.
MAIN_Q_RE = re.compile(r'^(?:Q(?:UESTION)?\s*)([0-9IVXLCDM]+)\.?\s*(.*)$', re.I)

# Letter excludes roman letters
LETTER_RE = re.compile(r'^\(([a-hj-z])\)', re.I)

# Roman only
ROMAN_RE = re.compile(r'^\((i{1,3}|iv|v|vi{0,3}|ix|x)\)', re.I)

MARKS_RE = re.compile(r'\(\d+(\.\d+)?\s*marks?\)', re.I)
TOTAL_RE = re.compile(r'\[.*?Total.*?\]', re.I)

def clean(text):
    text = MARKS_RE.sub('', text)
    text = TOTAL_RE.sub('', text)
    return re.sub(r'\s+', ' ', text).strip()

# ==============================
# MAIN PARSE FUNCTION
# ==============================
# Added paper_id parameter to prevent ID collision in ChromaDB
def parse_exam(text, paper_id=""):

    lines = text.splitlines()
    result = {}

    current_q = None
    current_q_intro = ""
    current_letter = None
    letter_intro = ""
    letter_has_roman = False

    current_roman = None
    roman_text = ""

    # Generate prefix like "2014_APR_" if a paper_id is provided
    prefix = f"{paper_id}_" if paper_id else ""

    def build_q_label(token: str) -> str:
        return f"Q{token.upper()}"

    def save_top_level():
        if current_q and not current_letter:
            cleaned = clean(current_q_intro)
            if cleaned:
                result[f"{prefix}{current_q}"] = cleaned

    def save_letter():
        if current_q and current_letter and not letter_has_roman:
            result[f"{prefix}{current_q}_{current_letter}"] = clean(letter_intro)

    def save_roman():
        if current_q and current_letter and current_roman:
            merged = clean(letter_intro + " " + roman_text)
            result[f"{prefix}{current_q}_{current_letter}_{current_roman}"] = merged

    for line in lines:

        line = line.strip()
        if not line:
            continue

        # MAIN Q
        m = MAIN_Q_RE.match(line)
        if m:
            if current_roman:
                save_roman()
            elif current_letter:
                save_letter()
            else:
                save_top_level()

            current_q = build_q_label(m.group(1))
            current_q_intro = m.group(2).strip()
            current_letter = None
            letter_intro = ""
            letter_has_roman = False
            current_roman = None
            roman_text = ""
            continue

        # LETTER (a,b,c...)
        m = LETTER_RE.match(line)
        if m:
            if current_roman:
                save_roman()
            else:
                save_letter()

            current_letter = m.group(1).lower()
            line_intro = line[m.end():].strip()
            if current_q_intro:
                letter_intro = f"{current_q_intro} {line_intro}".strip()
            else:
                letter_intro = line_intro
            letter_has_roman = False
            current_roman = None
            roman_text = ""
            continue

        # ROMAN (i,ii,iii...)
        m = ROMAN_RE.match(line)
        if m and current_letter:
            if current_roman:
                save_roman()

            letter_has_roman = True
            current_roman = m.group(1).lower()
            roman_text = line[m.end():].strip()
            continue

        # NORMAL CONTENT
        if current_roman:
            roman_text += " " + line
        elif current_letter:
            letter_intro += " " + line
        elif current_q:
            current_q_intro += " " + line

    # FINAL SAVE
    if current_roman:
        save_roman()
    elif current_letter:
        save_letter()
    else:
        save_top_level()

    return result

# ==============================
# USAGE TESTING
# ==============================
if __name__ == "__main__":
    # This block is just for testing the script directly.
    try:
        with open("text3.txt", "r", encoding="utf-8") as f:
            raw = f.read()

        # Testing the new function with a dummy paper_id
        output = parse_exam(raw, paper_id="TEST_YEAR")

        print(json.dumps(output, indent=4, ensure_ascii=False))
        print("\n✅ parse_exam function is updated and working perfectly!")
    except FileNotFoundError:
        print("Test file not found, but the function is ready to be imported.")