#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF 한 개에서 이미지를 모두 나열하고, 각 이미지의 크기(가로x세로)만 출력.

사용법:
    python3 scripts/list_pdf_images.py <pdf_path>
    python3 scripts/list_pdf_images.py   # pdf_resume 폴더에서 첫 PDF 사용
"""

import sys
from pathlib import Path


def main():
    if len(sys.argv) >= 2:
        pdf_path = Path(sys.argv[1])
    else:
        base = Path(__file__).resolve().parent.parent / "pdf_resume"
        pdfs = sorted(base.glob("*.pdf"))
        if not pdfs:
            print("Usage: python3 scripts/list_pdf_images.py <pdf_path>", file=sys.stderr)
            print("  or put a PDF in pdf_resume/ and run without args.", file=sys.stderr)
            sys.exit(1)
        pdf_path = pdfs[0]
        print(f"[자동 선택] {pdf_path}\n", file=sys.stderr)

    if not pdf_path.exists():
        print(f"File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        import fitz
    except ImportError:
        print("PyMuPDF 필요: pip install pymupdf", file=sys.stderr)
        sys.exit(1)

    doc = fitz.open(str(pdf_path))
    try:
        total = 0
        for page_idx, page in enumerate(doc):
            image_list = page.get_images(full=True)
            for img_idx, img in enumerate(image_list):
                xref = img[0]
                base = doc.extract_image(xref)
                if not base:
                    continue
                w = base.get("width", 0)
                h = base.get("height", 0)
                ext = base.get("ext", "?")
                n_bytes = len(base.get("image") or b"")
                total += 1
                print(f"page={page_idx} img={img_idx}  {w} x {h}  ext={ext}  bytes={n_bytes}")
        print(f"\n총 이미지 수: {total}")
    finally:
        doc.close()


if __name__ == "__main__":
    main()
