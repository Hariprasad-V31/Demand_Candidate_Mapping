"""
Eliminate E0 competencies from an Excel workbook.

For every row, the script inspects the "Primary" and "Secondary" columns and
removes any competency entry whose bracketed details contain the "[ E0 ... ]"
level (e.g. "Service Operations [ E0 1 Yrs ]"). Entries with E1/E2/E3/... are
kept untouched. Remaining competencies are rejoined cleanly so there are no
trailing, leading, or doubled semicolons.

Usage:
    python eliminate_e0.py [input.xlsx] [output.xlsx]

Defaults:
    input  = input.xlsx
    output = output.xlsx
"""

import re
import sys

import pandas as pd

# Columns to clean.
TARGET_COLUMNS = ["Primary", "Secondary"]

# Matches a bracketed level block that is E0 (E00, E01 etc. are NOT matched
# because of the word boundary after the digit 0).
E0_PATTERN = re.compile(r"\[\s*E0\b[^\]]*\]")


def clean_competency_cell(value):
    """Remove every ';'-separated competency that carries an [ E0 ... ] level."""
    if value is None:
        return value

    text = str(value)

    # Split on ';', drop any segment that contains an E0 level, keep the rest.
    kept = []
    for segment in text.split(";"):
        stripped = segment.strip()
        if not stripped:
            continue
        if E0_PATTERN.search(stripped):
            continue
        kept.append(stripped)

    # Rejoin with a clean, consistent separator.
    return " ; ".join(kept)


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else "input.xlsx"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "output.xlsx"

    df = pd.read_excel(input_path)

    for column in TARGET_COLUMNS:
        if column in df.columns:
            df[column] = df[column].apply(clean_competency_cell)
        else:
            print(f"Warning: column '{column}' not found; skipping it.")

    df.to_excel(output_path, index=False)
    print(f"Done. Cleaned data written to '{output_path}'.")


if __name__ == "__main__":
    main()
