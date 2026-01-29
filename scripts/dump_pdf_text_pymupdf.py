#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pdftotext(poppler)로 PDF 텍스트를 -layout 기준으로 추출해 출력.
로컬 Poppler 설치/번들 동작 확인용.

사용:
  python3 scripts/dump_pdf_text_pymupdf.py <pdf_path>
  python3 scripts/dump_pdf_text_pymupdf.py --pdftotext poppler-windows/bin/pdftotext.exe <pdf_path>
"""
import sys
import subprocess
from pathlib import Path
from typing import Optional


def dump_text_with_pdftotext(pdf_path: str, pdftotext_exe: Optional[str] = None) -> None:
    """pdftotext -layout -enc UTF-8 로 텍스트 추출 후 stdout에 출력."""
    cmd = [pdftotext_exe or "pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        print(f"pdftotext failed (exit {result.returncode}): {err}", file=sys.stderr)
        sys.exit(1)
    print(result.stdout or "", end="")


if __name__ == "__main__":
    args = sys.argv[1:]
    pdftotext_exe = None
    if args and args[0] == "--pdftotext":
        if len(args) < 3:
            print("Usage: dump_pdf_text_pymupdf.py [--pdftotext PATH] <pdf_path>", file=sys.stderr)
            sys.exit(1)
        pdftotext_exe = args[1]
        args = args[2:]
    if not args:
        print("Usage: dump_pdf_text_pymupdf.py [--pdftotext PATH] <pdf_path>", file=sys.stderr)
        sys.exit(1)
    path = args[0]
    if not Path(path).exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    dump_text_with_pdftotext(path, pdftotext_exe)
