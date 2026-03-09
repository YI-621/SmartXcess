import fitz
import re

# ==============================
# REGEX PATTERNS
# ==============================

# Q2. (a) text
Q_WITH_SUB_RE = re.compile(r'^\s*(Q[0-9]+|Q[IVXLCDM]+)\.?\s*(\([a-z]\))(.*)', re.I)

# Standalone Q
MAIN_Q_RE = re.compile(r'^\s*(Q[0-9]+|Q[IVXLCDM]+)\.?\s*$', re.I)

# (a)
LETTER_RE = re.compile(r'^\(\s*[a-z]\s*\)$', re.I)

# (i)
ROMAN_RE = re.compile(r'^\(\s*(i{1,4}|v|x)\s*\)$', re.I)

# Page number (only number in whole line)
PAGE_NUMBER_RE = re.compile(r'^\d+$')


# ==============================
# NORMALIZE FUNCTION
# ==============================

def normalize_q_label(text):
    """
    Convert Roman numerals to standard numbers:
    QI -> Q1, QII -> Q2, QIII -> Q3, etc.
    """
    match = re.match(r'^Q([IVXLCDM]+)$', text, re.I)
    if not match:
        return text

    roman = match.group(1).upper()

    roman_map = {
        "I": 1, "II": 2, "III": 3, "IV": 4,
        "V": 5, "VI": 6, "VII": 7, "VIII": 8,
        "IX": 9, "X": 10
    }

    if roman in roman_map:
        return f"Q{roman_map[roman]}"

    return text


# ==============================
# MAIN EXTRACT FUNCTION
# ==============================

def extract_pdf_lines(pdf_path):
    doc = fitz.open(pdf_path)
    result = []

    for page in doc:
        page_dict = page.get_text("dict")

        for block in page_dict["blocks"]:
            # Type 0 means text (ignore images/drawings)
            if block["type"] != 0:
                continue

            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"]).strip()

                if not text:
                    continue

                # Ignore page headers/footers
                if "(Continued)" in text:
                    continue
                
                # Clean multiple spaces into a single space
                text = re.sub(r'\s+', ' ', text)

                # Remove isolated page numbers like: 2, 3, 4
                if PAGE_NUMBER_RE.match(text):
                    continue

                # Remove trailing dot like "Q2."
                text = text.rstrip('.')

                # Normalize QI -> Q1
                text = normalize_q_label(text)

                # ------------------------------
                # Case 1: Q2 (a) text
                # ------------------------------
                match = Q_WITH_SUB_RE.match(text)
                if match:
                    q_part = match.group(1).rstrip('.')
                    sub_part = match.group(2)
                    remaining = match.group(3).strip()

                    result.append(q_part.upper())
                    result.append(sub_part.lower() + (" " + remaining if remaining else ""))
                    continue

                # ------------------------------
                # Case 2: Standalone Q
                # ------------------------------
                if MAIN_Q_RE.match(text):
                    result.append(text.upper())
                    continue

                # ------------------------------
                # Case 3: (a)
                # ------------------------------
                if LETTER_RE.match(text):
                    result.append(text.lower())
                    continue

                # ------------------------------
                # Case 4: (i)
                # ------------------------------
                if ROMAN_RE.match(text):
                    result.append(text.lower())
                    continue

                # Append normal text content
                result.append(text)

    doc.close()
    return result


# ==============================
# USAGE TESTING
# ==============================
if __name__ == "__main__":
    # The code inside here will ONLY run if you execute this file directly.
    # It will NOT run when master_run.py imports the function!
    
    pdf_path = "test3.pdf"
    output_path = "text3.txt"

    print(f"Testing extraction on {pdf_path}...")
    
    try:
        lines = extract_pdf_lines(pdf_path)

        # Save exactly as printed
        with open(output_path, "w", encoding="utf-8") as f:
            for line in lines:
                f.write(line + "\n")

        print(f"✅ Extraction complete. Saved to {output_path}")
    
    except FileNotFoundError:
        print(f"❌ Error: Could not find '{pdf_path}'. Please check the file name.")