#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyMuPDF로 PDF 텍스트를 추출 순서(텍스트 객체 순서)대로 출력.
사용: pip install pymupdf 후  python3 scripts/dump_pdf_text_pymupdf.py pdf_resume/강동화_이력서.pdf
"""
import sys
from pathlib import Path

try:
    import fitz
except ImportError:
    print("PyMuPDF 필요: pip install pymupdf", file=sys.stderr)
    sys.exit(1)


def dump_text_in_order(pdf_path: str) -> None:
    doc = fitz.open(pdf_path)
    for page_num, page in enumerate(doc):
        print(f"=== Page {page_num + 1} ===")
        blocks = page.get_text("dict")["blocks"]
        for bi, block in enumerate(blocks):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    t = span.get("text", "").strip()
                    if t:
                        # 옵션: bbox로 위치도 보려면 아래 주석 해제
                        # bbox = span.get("bbox", (0,0,0,0))
                        # print(f"[{bi}] {t}  # bbox={bbox}")
                        print(t)
        if page_num == 0:
            break  # 1페이지만 (전체 보려면 이 break 제거)
    doc.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 dump_pdf_text_pymupdf.py <pdf_path>", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    if not Path(path).exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    dump_text_in_order(path)
