#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
자체 이력서 폼(DOCX 양식)을 PDF로 제출한 파일을 파싱합니다.
pdftotext로 텍스트 추출 후, 섹션(▣ 기본 인적사항, ▣ 학력사항 등)별로 파싱하여
DOCX 파서와 동일한 applicationData 형식(flat key)으로 출력합니다.

사용법:
    python3 scripts/parse_docx_form_pdf.py <pdf_path>
    python3 scripts/parse_docx_form_pdf.py --text <pdftotext_output.txt>   # 이미 추출된 텍스트 사용

의존: pdftotext (poppler-utils)
"""

import re
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional


# --- pdftotext 추출 ---
def extract_text_with_pdftotext(pdf_path: str, pdftotext_exe: Optional[str] = None) -> str:
    cmd = [pdftotext_exe or "pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pdftotext failed: {result.stderr or result.stdout}")
    return result.stdout or ""


# --- 섹션 분할 (자체 폼 고정 헤더) ---
SECTION_MARKERS = [
    "▣ 기본 인적사항",
    "▣ 학력사항",
    "▣ 경력사항",
    "▣ 어학",  # ▣ 어학(최근2년 취득) / 자격사항 / 수상경력
    "자 기 소 개 서",
    "경 력 기 술 서",
]


def split_sections(text: str) -> dict[str, str]:
    """고정 헤더로 구간을 나누어 dict로 반환. 키: section 이름(간략), 값: 해당 구간 텍스트."""
    sections = {}
    lines = text.split("\n")
    current_key = "header"
    current_lines = []

    for line in lines:
        matched = None
        for marker in SECTION_MARKERS:
            if marker in line:
                if current_key != "header" or current_lines:
                    sections[current_key] = "\n".join(current_lines).strip()
                if "기본 인적사항" in marker:
                    current_key = "basic"
                elif "학력사항" in marker:
                    current_key = "education"
                elif "경력사항" in marker and "경력기술" not in line:
                    current_key = "career"
                elif "어학" in marker:
                    current_key = "cert_lang_award"
                elif "자 기 소 개 서" in marker or "자기소개" in marker:
                    current_key = "self_intro"
                elif "경 력 기 술 서" in marker or "경력기술" in marker:
                    current_key = "career_detail"
                else:
                    current_key = marker[:20]
                current_lines = [line]
                matched = True
                break
        if not matched:
            current_lines.append(line)

    if current_lines:
        sections[current_key] = "\n".join(current_lines).strip()
    return sections


# --- 기본 인적사항 ---
def parse_basic(section: str) -> dict:
    out = {}
    if not section:
        return out
    text = section.replace("\n", " ")
    # 지원분야: 같은 줄에 "지원분야            공무, 시설관리"
    m = re.search(r"지원분야\s+([^\n]+)", section)
    if m:
        out["supportField"] = re.sub(r"\s+", " ", m.group(1)).strip()

    m = re.search(r"희망연봉\s+(\d+)\s*\(?만원\)?", section)
    if m:
        out["desiredSalary"] = m.group(1).strip() + " (만원)"
    if "desiredSalary" not in out:
        m = re.search(r"희망연봉\s+(\d+)\s*", section)
        if m:
            out["desiredSalary"] = m.group(1).strip() + " (만원)"

    # (한글) 이름 (한문) ... (영문) ...
    m = re.search(r"\(한글\)\s*([^\s(]+(?:\s+[^\s(]+)*)\s*\(한문\)", section)
    if m:
        name = m.group(1).strip()
        out["name"] = re.sub(r"\s+", " ", name)
    m = re.search(r"\(영문\)\s*([A-Za-z\s]+?)(?:\s*$|\n)", section)
    if m:
        out["nameEnglish"] = m.group(1).strip()

    m = re.search(r"생년월일\s+(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)", section)
    if m:
        out["birthDate"] = m.group(1).strip()
    if "birthDate" not in out:
        m = re.search(r"생년월일\s+(\d{4}\.\d{1,2}\.\d{1,2})", section)
        if m:
            out["birthDate"] = m.group(1).strip()

    m = re.search(r"e-mail\s*(\S+@\S+)", section, re.IGNORECASE)
    if m:
        out["email"] = m.group(1).strip()

    m = re.search(r"현\s*주\s*소\s*([^\n]+?)(?=연\s*락|$)", section)
    if m:
        out["address"] = re.sub(r"\s+", " ", m.group(1)).strip()
    if "address" not in out:
        m = re.search(r"현\s*주\s*소\s*([^\n]+)", section)
        if m:
            out["address"] = re.sub(r"\s+", " ", m.group(1)).strip()

    m = re.search(r"연\s*락\s*처\s*([0-9.\-\s]+)", section)
    if m:
        out["phone"] = re.sub(r"\s+", "", m.group(1).strip())

    m = re.search(r"병역사항\s*(\S+)", section)
    if m:
        out["militaryService"] = m.group(1).strip()

    # residence: address 기반 간단 분류 (선택)
    addr = out.get("address", "") or ""
    if "서울" in addr or "서울시" in addr:
        out["residence"] = "서울"
    elif "경기" in addr or "인천" in addr or "수원" in addr:
        out["residence"] = "수도권"
    elif "시흥" in addr:
        out["residence"] = "시흥"
    elif "안산" in addr:
        out["residence"] = "안산"
    elif addr:
        out["residence"] = "지방"
    return out


# --- 학력 (입학년월 졸업년월 학교명 전공 학점 소재지 졸업구분) ---
EDU_ROW_RE = re.compile(
    r"^(\d{4}\.\d{2})\s+(\d{4}\.\d{2})\s+(.+?)\s+([^\s/]+(?:\s+[^\s/]+)*?)\s+([\d.]+\s*/\s*[\d.]+|/)\s+(\S+)\s+(졸업|재학|휴학|중퇴)",
    re.MULTILINE,
)


def parse_education(section: str) -> dict:
    out = {}
    if not section:
        return out
    edu_index = 1
    for line in section.split("\n"):
        line = line.strip()
        if not line or "입학년월" in line or "졸업년월" in line:
            continue
        # YYYY.MM  YYYY.MM  학교명  전공  학점  소재지  졸업구분
        m = re.match(r"(\d{4}\.\d{2})\s+(\d{4}\.\d{2})\s+(.+?)\s{2,}(.+?)\s{2,}([\d.]+\s*/\s*[\d.]+|/)\s+(\S+)\s+(졸업|재학|휴학|중퇴)", line)
        if not m:
            m = re.match(r"(\d{4}\.\d{2})\s+(\d{4}\.\d{2})\s+(.+)", line)
            if m:
                rest = m.group(3)
                parts = re.split(r"\s{2,}", rest, maxsplit=4)
                if len(parts) >= 4:
                    school = parts[0].strip()
                    if school in ("대학원", "대학교", "고등학교") and len(parts) == 1:
                        continue
                    out[f"educationStartDate{edu_index}"] = m.group(1)
                    out[f"educationEndDate{edu_index}"] = m.group(2)
                    out[f"universityName{edu_index}"] = school
                    if len(parts) >= 2:
                        out[f"universityMajor{edu_index}_1"] = parts[1].strip()
                    if len(parts) >= 3 and "/" in parts[2]:
                        gpa_parts = parts[2].strip().split("/")
                        if len(gpa_parts) == 2:
                            out[f"universityGPA{edu_index}"] = gpa_parts[0].strip()
                            out[f"universityGPAMax{edu_index}"] = gpa_parts[1].strip()
                    if len(parts) >= 4:
                        out[f"universityLocation{edu_index}"] = parts[3].strip()
                    if len(parts) >= 5:
                        out[f"universityGraduationType{edu_index}"] = parts[4].strip()
                    edu_index += 1
            continue
        start_date, end_date, school, major, gpa, location, grad = m.groups()
        if school.strip() in ("대학원", "대학교", "고등학교"):
            continue
        out[f"educationStartDate{edu_index}"] = start_date
        out[f"educationEndDate{edu_index}"] = end_date
        out[f"universityName{edu_index}"] = school.strip()
        out[f"universityMajor{edu_index}_1"] = major.strip()
        if gpa and gpa != "/":
            gpa_parts = gpa.split("/")
            if len(gpa_parts) == 2:
                out[f"universityGPA{edu_index}"] = gpa_parts[0].strip()
                out[f"universityGPAMax{edu_index}"] = gpa_parts[1].strip()
        out[f"universityLocation{edu_index}"] = location.strip()
        out[f"universityGraduationType{edu_index}"] = grad.strip()
        edu_index += 1
        if edu_index > 6:
            break
    return out


# --- 경력 (입사년월 퇴사년월 회사명 근무부서 직위 연봉 이직사유) ---
def parse_career(section: str) -> dict:
    out = {}
    if not section:
        return out
    career_index = 1
    lines = section.split("\n")
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped or "입사년월" in line_stripped or "퇴사년월" in line_stripped:
            continue
        m = re.match(r"(\d{4}\.\d{2})\s+(\d{4}\.\d{2})\s+(.+)", line_stripped)
        if not m:
            continue
        start_date, end_date, rest = m.groups()
        parts = re.split(r"\s{2,}", rest.strip(), maxsplit=5)
        if len(parts) < 3:
            continue
        company = parts[0].strip()
        if not company or company.startswith("(") and ")" not in company:
            continue
        out[f"careerStartDate{career_index}"] = start_date
        out[f"careerEndDate{career_index}"] = end_date
        out[f"careerCompanyName{career_index}"] = company
        if len(parts) >= 2:
            out[f"careerDepartment{career_index}"] = parts[1].strip()
        if len(parts) >= 3:
            out[f"careerJobType{career_index}"] = parts[2].strip()
        if len(parts) >= 4:
            out[f"careerSalary{career_index}"] = parts[3].strip()
        if len(parts) >= 5:
            out[f"careerEmploymentStatus{career_index}"] = parts[4].strip()
        career_index += 1
        if career_index > 5:
            break
    return out


# --- 자격/어학/수상 (테이블 3에 해당하는 복합 섹션) ---
def parse_cert_lang_award(section: str) -> dict:
    out = {}
    if not section:
        return out
    lines = [ln.strip() for ln in section.split("\n") if ln.strip()]
    cert_index = 1
    lang_index = 1
    award_index = 1
    in_award_section = False
    for i, line in enumerate(lines):
        if "수상명" in line and "수상기관" in line:
            in_award_section = True
            continue
        if "자격명" in line and "발행기관" in line:
            in_award_section = False
            continue
        if "해외연수국가" in line:
            continue
        if in_award_section:
            parts = re.split(r"\s{2,}", line, maxsplit=2)
            if len(parts) >= 2 and not re.match(r"^\d{4}\.\d{2}", line):
                name = parts[0].strip() if len(parts) > 0 else ""
                org = parts[1].strip() if len(parts) > 1 else ""
                detail = parts[2].strip() if len(parts) > 2 else ""
                if name or org or detail:
                    out[f"awardName{award_index}"] = name
                    out[f"awardOrganization{award_index}"] = org
                    out[f"awardDetail{award_index}"] = detail
                    award_index += 1
                    if award_index > 3:
                        break
            continue
        if re.match(r"^\d{4}\.\d{2}", line):
            continue
        parts = re.split(r"\s{2,}", line)
        if len(parts) >= 3:
            a, b, c = parts[0].strip(), parts[1].strip(), parts[2].strip()
            if not a and not b and not c:
                continue
            if any(x in a for x in ("산업기사", "기사", "기능사", "1급", "2급", "면허", "자격")):
                out[f"certificateName{cert_index}"] = a or b or c
                if len(parts) >= 2:
                    out[f"certificateGrade{cert_index}"] = b if b and b != a else (c if len(parts) > 2 else "")
                if len(parts) >= 3:
                    out[f"certificateIssuer{cert_index}"] = c
                cert_index += 1
                if cert_index > 10:
                    break
            elif any(x in c for x in ("공단", "청", "협회", "원")):
                out[f"certificateName{cert_index}"] = a
                out[f"certificateGrade{cert_index}"] = b
                out[f"certificateIssuer{cert_index}"] = c
                cert_index += 1
                if cert_index > 10:
                    break
    return out


# --- 자기소개서 (4개 블록) ---
# PDF에서는 "  자기소개     본문...", "  지원동기     본문..." 처럼 줄 시작에 라벨+본문이 옴
SELF_INTRO_LABELS = ["자기소개", "지원동기", "성과목표", "장래포부"]
SELF_INTRO_HEADER_RE = re.compile(r"^\s{2,}(자기소개|지원동기|성과목표|장래포부)\s{2,}(.*)$")


def parse_self_intro(section: str) -> dict:
    out = {}
    if not section:
        return out
    lines = section.split("\n")
    # 라벨이 있는 줄 인덱스와 라벨명 (달성경험은 성과목표와 같이 취급)
    block_starts = []
    for i, line in enumerate(lines):
        m = SELF_INTRO_HEADER_RE.match(line)
        if m:
            block_starts.append((i, m.group(1), m.group(2).strip()))
    if not block_starts:
        return out
    for idx, want_label in enumerate(SELF_INTRO_LABELS):
        start_i = None
        same_line_content = ""
        for pos_i, (li, lb, rest) in enumerate(block_starts):
            if lb == want_label:
                start_i = li
                same_line_content = rest
                break
        if start_i is None:
            continue
        end_i = len(lines)
        for pos_i, (li, lb, _) in enumerate(block_starts):
            if li > start_i and lb in SELF_INTRO_LABELS:
                end_i = li
                break
        parts = [same_line_content] if same_line_content else []
        for k in range(start_i + 1, end_i):
            parts.append(lines[k].strip())
        block = " ".join(p for p in parts if p).strip()
        block = re.sub(r"\s*\(700자이내\)\s*", " ", block).strip()
        out[f"selfIntroduction{idx + 1}"] = block[:2000]
    return out


# --- 경력기술서 (회사별 블록 + 상세내용) ---
def parse_career_detail(section: str) -> dict:
    out = {}
    if not section:
        return out
    lines = section.split("\n")
    detail_index = 1
    i = 0
    while i < len(lines) and detail_index <= 4:
        line = lines[i]
        m = re.match(r"(\d{4}\.\d{2})\s+(\d{4}\.\d{2})\s+(.+)", line.strip())
        if m:
            start_date, end_date, rest = m.groups()
            parts = re.split(r"\s{2,}", rest.strip(), maxsplit=5)
            out[f"careerDetailStartDate{detail_index}"] = start_date
            out[f"careerDetailEndDate{detail_index}"] = end_date
            if parts:
                out[f"careerDetailCompanyName{detail_index}"] = parts[0].strip()
            if len(parts) >= 2:
                out[f"careerDetailDepartment{detail_index}"] = parts[1].strip()
            if len(parts) >= 3:
                out[f"careerDetailPosition{detail_index}"] = parts[2].strip()
            if len(parts) >= 4:
                out[f"careerDetailSalary{detail_index}"] = parts[3].strip()
            if len(parts) >= 5:
                out[f"careerDetailReason{detail_index}"] = parts[4].strip()
            i += 1
            detail_lines = []
            while i < len(lines):
                if re.match(r"^\d{4}\.\d{2}\s+\d{4}\.\d{2}", lines[i].strip()):
                    break
                if "상세내용" in lines[i] or "담당업무" in lines[i]:
                    i += 1
                    continue
                detail_lines.append(lines[i].strip())
                i += 1
            out[f"careerDetailDescription{detail_index}"] = "\n".join(detail_lines).strip()[:5000]
            detail_index += 1
        else:
            i += 1
    return out


def parse_docx_form_pdf_text(text: str) -> dict:
    """pdftotext로 추출한 텍스트를 applicationData 형식(flat key)으로 파싱."""
    sections = split_sections(text)
    app = {}
    app.update(parse_basic(sections.get("basic", "")))
    app.update(parse_education(sections.get("education", "")))
    app.update(parse_career(sections.get("career", "")))
    app.update(parse_cert_lang_award(sections.get("cert_lang_award", "")))
    app.update(parse_self_intro(sections.get("self_intro", "")))
    app.update(parse_career_detail(sections.get("career_detail", "")))
    return app


def main():
    args = sys.argv[1:]
    pdftotext_exe = None
    text_path = None
    while args:
        if args[0] == "--pdftotext" and len(args) >= 3:
            pdftotext_exe = args[1]
            args = args[2:]
        elif args[0] == "--text" and len(args) >= 2:
            text_path = args[1]
            args = args[2:]
        else:
            break
    if not args and not text_path:
        print(json.dumps({"error": "Usage: parse_docx_form_pdf.py [--pdftotext PATH] [--text <txt>] <pdf_path>"}))
        sys.exit(1)
    pdf_path = args[0] if args else None
    try:
        if text_path:
            with open(text_path, "r", encoding="utf-8") as f:
                text = f.read()
        elif pdf_path and Path(pdf_path).exists():
            text = extract_text_with_pdftotext(pdf_path, pdftotext_exe)
        else:
            print(json.dumps({"error": f"File not found: {pdf_path}"}))
            sys.exit(1)
        data = parse_docx_form_pdf_text(text)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
