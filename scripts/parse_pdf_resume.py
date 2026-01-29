#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF 이력서 1개를 구조 기반으로 파싱하여 JSON으로 출력하는 스크립트.

사용법:
    python3 scripts/parse_pdf_resume.py <pdf_path>
    python3 scripts/parse_pdf_resume.py --pdftotext /path/to/pdftotext.exe <pdf_path>

의존: pdftotext (poppler) / pdfminer.six / PyMuPDF 중 하나.
      추출 순서: pdftotext → pdfminer.six → PyMuPDF (레이아웃 품질 우선).
"""

import sys
import re
import json
import subprocess
from pathlib import Path
from typing import Optional


def _extract_with_pdftotext(pdf_path: str, pdftotext_exe: Optional[str] = None) -> str:
    """pdftotext -layout 로 텍스트 추출 (poppler 필요). pdftotext_exe가 있으면 해당 실행 파일 사용."""
    cmd = [pdftotext_exe or "pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pdftotext failed: {result.stderr or result.stdout}")
    return result.stdout or ""


def _extract_with_pdfminer(pdf_path: str) -> str:
    """pdfminer.six로 레이아웃 유지 텍스트 추출 (구분자/순서가 안정적)."""
    from pdfminer.high_level import extract_text as pdfminer_extract_text
    from pdfminer.layout import LAParams
    laparams = LAParams(
        line_margin=0.3,
        word_margin=0.1,
        char_margin=2.0,
    )
    return pdfminer_extract_text(pdf_path, laparams=laparams) or ""


def _extract_with_pymupdf(pdf_path: str) -> str:
    """PyMuPDF(fitz)로 텍스트 추출 (폴백)."""
    import fitz
    doc = fitz.open(pdf_path)
    try:
        parts = []
        for page in doc:
            parts.append(page.get_text("text"))
        return "\n".join(parts)
    finally:
        doc.close()


def extract_text_with_layout(pdf_path: str, pdftotext_exe: Optional[str] = None) -> str:
    """PDF에서 레이아웃 유사 텍스트 추출. pdftotext → pdfminer.six → PyMuPDF 순으로 시도."""
    try:
        return _extract_with_pdftotext(pdf_path, pdftotext_exe)
    except FileNotFoundError:
        pass
    try:
        return _extract_with_pdfminer(pdf_path)
    except ImportError:
        pass
    try:
        return _extract_with_pymupdf(pdf_path)
    except ImportError:
        pass
    raise RuntimeError(
        "PDF 텍스트 추출에 pdftotext(poppler), pdfminer.six, PyMuPDF 중 하나가 필요합니다. "
        "예: pip install pdfminer.six 또는 pip install pymupdf"
    )


# --- 섹션 분할 (헤더 라벨 기준) ---
SECTION_HEADERS = [
    "경력 총 ",
    "학력 ",
    "자격/어학/수상",
    "취업우대사항",
    "포트폴리오 및 기타문서",
    "자기소개서",
]


def split_into_sections(full_text: str) -> dict:
    """전체 텍스트를 섹션별로 나눔. 헤더 라인을 기준으로 블록 분리."""
    sections = {}
    lines = full_text.split("\n")
    current_section = "header"  # 최상단 ~ 첫 번째 섹션 전
    current_lines = []

    for line in lines:
        line_stripped = line.strip()
        matched_header = None
        for h in SECTION_HEADERS:
            if h in line_stripped or line_stripped == h.strip():
                matched_header = h.strip()
                break
        if matched_header:
            if current_section:
                sections[current_section] = "\n".join(current_lines).strip()
            # 정규화된 키 (공백/특수문자 제거)
            key = re.sub(r"\s+", "_", matched_header).strip("_")
            if key.startswith("경력_총"):
                key = "career_summary"
            elif "학력" in key:
                key = "education_header"
            elif "자격" in key or "어학" in key or "수상" in key:
                key = "certifications"
            elif "취업우대" in key:
                key = "employment_preference"
            elif "포트폴리오" in key:
                key = "portfolio"
            elif "자기소개" in key:
                key = "self_introduction"
            else:
                key = key[:50]
            current_section = key
            current_lines = [line]
            continue
        current_lines.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_lines).strip()
    return sections


# --- 헤더 블록에서 기본 정보 추출 ---
def parse_header_block(block: str) -> dict:
    """상단 블록에서 이름, 성별, 생년, 나이, 이메일, 휴대폰, 주소, 지원분야, 입사지원일 추출."""
    info = {}
    text = block.replace("\n", " ")

    # 지원분야 : ... 입사지원일 : ...
    m = re.search(r"지원분야\s*:\s*([^\s입]+)", text)
    if m:
        info["supportField"] = m.group(1).strip()
    m = re.search(r"입사지원일\s*:\s*([^)]+\))", text)
    if m:
        info["applicationDate"] = m.group(1).strip()

    # "홍길동 경력" 또는 "PRASETYO 신입" 형태에서 이름 (나의 스킬 이전 라인만, 잘못된 매칭 제외)
    NAME_BLOCK = ("스킬", "소프트스킬", "경력", "학력", "나의", "-", "소프트스킬입니다", "입니다")
    idx_skill = block.find("나의 스킬")

    def _accept_name(word: str) -> bool:
        if not word or word == "스킬":
            return False
        if any(word.startswith(x) or x in word for x in NAME_BLOCK):
            return False
        return bool(re.match(r"^[\uac00-\ud7a3]{2,4}$", word) or re.match(r"^[A-Za-z]{2,20}$", word))

    # 나의 스킬 이전에 나오는 모든 "XXX 경력" / "XXX 신입" 후보를 모은 뒤, 첫 번째 유효한 이름만 사용
    candidates = []
    for pattern in (r"([^\s]+)\s+경력\s*$", r"([^\s]+)\s+신입\s*$"):
        for m in re.finditer(pattern, block, re.MULTILINE):
            if idx_skill != -1 and m.start() > idx_skill:
                continue
            candidates.append((m.start(), m.group(1).strip()))
    candidates.sort(key=lambda x: x[0])
    for _, name in candidates:
        if _accept_name(name):
            info["name"] = name
            break

    # 남/여, 1991 (34세)
    m = re.search(r"(남|여)\s*,\s*(\d{4})\s*\((\d+)세\)", text)
    if m:
        info["gender"] = m.group(1)
        info["birthYear"] = m.group(2)
        info["age"] = int(m.group(3))

    # 이메일
    m = re.search(r"이메일\s+(\S+@\S+)", text)
    if m:
        info["email"] = m.group(1).strip()
    # 휴대폰 / 전화번호
    m = re.search(r"(?:휴대폰|전화번호)\s+(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})", text)
    if m:
        info["phone"] = re.sub(r"\s+", "", m.group(1))
    # 주소 (괄호 숫자로 시작하는 우편 형식)
    m = re.search(r"주소\s+\(?\d{5}\)?\s*([^\n]+?)(?=\s+경력\s|$)", text)
    if m:
        info["address"] = m.group(1).strip()
    # 주소 대체: "주소 " 다음 한 줄
    if "address" not in info:
        m = re.search(r"주소\s+([^\n]+)", block)
        if m:
            info["address"] = m.group(1).strip()

    # 경력 총 N년 N개월 / 희망연봉 / 직전 연봉 (basicInfo 아래 요약 표가 헤더에 있을 때)
    m = re.search(r"경력\s*총\s*(\d+년\s*\d*개월)", text)
    if m:
        info["totalCareer"] = m.group(1).strip()
    if "totalCareer" not in info:
        m = re.search(r"총\s*(\d+년\s*\d*개월)", text)
        if m:
            info["totalCareer"] = m.group(1).strip()
    m = re.search(r"희망연봉\s*[:\s]*([0-9,]+)\s*만원", text)
    if m:
        info["desiredSalary"] = m.group(1).strip() + "만원"
    if "desiredSalary" not in info and "회사내규에 따름" in text:
        idx_desired = text.find("회사내규에 따름")
        idx_last = text.find("직전 연봉")
        if idx_desired != -1 and (idx_last == -1 or idx_desired < idx_last):
            info["desiredSalary"] = "회사내규에 따름"
    m = re.search(r"직전\s*연봉\s*:\s*([^\s원]+만원?)", text)
    if m:
        info["lastSalary"] = m.group(1).strip() + ("원" if "원" in m.group(1) else "만원")
    if "lastSalary" not in info and "회사내규에 따름" in text:
        info["lastSalary"] = "회사내규에 따름"

    return info


def parse_summary_table_from_career_block(block: str) -> dict:
    """경력 섹션 상단 요약 표(경력 총, 희망연봉, 직전 연봉)에서 basicInfo 보강용 필드 추출."""
    out = {}
    text = block.replace("\n", " ")
    # 경력 총 N년 N개월 (요약 표 또는 섹션 제목)
    m = re.search(r"경력\s*총\s*(\d+년\s*\d*개월)", text)
    if m:
        out["totalCareer"] = m.group(1).strip()
    if "totalCareer" not in out:
        m = re.search(r"총\s*(\d+년\s*\d*개월)", text)
        if m:
            out["totalCareer"] = m.group(1).strip()
    # 희망연봉: 요약 표 1행(회사내규에 따름) / 2행(직전 연봉 : N만원)
    m = re.search(r"희망연봉\s*[:\s]*([0-9,]+)\s*만원", text)
    if m:
        out["desiredSalary"] = m.group(1).strip() + "만원"
    if "desiredSalary" not in out and "회사내규에 따름" in text:
        idx_desired = text.find("회사내규에 따름")
        idx_last = text.find("직전 연봉")
        if idx_desired != -1 and (idx_last == -1 or idx_desired < idx_last):
            out["desiredSalary"] = "회사내규에 따름"
    # 직전 연봉 (요약 표 2행, "3,800 만원"처럼 공백 허용)
    m = re.search(r"직전\s*연봉\s*:\s*([0-9,]+)\s*만원", text)
    if m:
        out["lastSalary"] = m.group(1).strip() + "만원"
    if "lastSalary" not in out and "회사내규에 따름" in text:
        out["lastSalary"] = "회사내규에 따름"
    return out


# --- 경력 블록 파싱 (기간 회사 직무 ...) ---
CAREER_PATTERN = re.compile(
    r"(\d{4}\.\d{2}\s*~\s*(?:재직중|\d{4}\.\d{2}))\s+(.+?)\s+·\s+(.+?)(?:\n|$)",
    re.DOTALL,
)


def parse_career_entries(block: str) -> list:
    """경력 요약 + 상세 블록에서 항목 리스트 추출."""
    entries = []
    # "YYYY.MM ~ 재직중" 또는 "YYYY.MM ~ YYYY.MM" 라인 찾기
    lines = block.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # 기간 패턴: 2017.08 ~ 재직중  또는  2017.05 ~ 2017.08
        m = re.match(r"(\d{4}\.\d{2})\s*~\s*(재직중|\d{4}\.\d{2})\s+(.+)", line.strip())
        if m:
            start_date = m.group(1)
            end_raw = m.group(2)
            rest = m.group(3)
            # 회사명 · 직무 (첫 줄)
            parts = rest.split("·", 1)
            company = parts[0].strip() if parts else ""
            role = parts[1].strip() if len(parts) > 1 else ""
            # 다음 줄에 "N개월" 또는 "N년 N개월", 연봉/근무지역/퇴사사유 있을 수 있음
            duration = ""
            desc_lines = []
            salary = ""
            region = ""
            leave_reason = ""
            i += 1
            while i < len(lines):
                next_line = lines[i]
                if re.match(r"\d{4}\.\d{2}\s*~\s*(?:재직중|\d{4}\.\d{2})", next_line.strip()):
                    i -= 1
                    break
                if re.match(r"^\d+개월$|^\d+년\s*\d*개월$", next_line.strip()):
                    duration = next_line.strip()
                    i += 1
                    continue
                if next_line.strip() and not next_line.strip().startswith("연봉"):
                    desc_lines.append(next_line.strip())
                if "연봉" in next_line or "근무지역" in next_line or "퇴사사유" in next_line:
                    # 현재 줄에서 연봉/근무지역/퇴사사유 추출 (이 줄을 건너뛰지 않음)
                    sm = re.search(r"연봉\s+([^\s근]+)", next_line)
                    if sm:
                        salary = sm.group(1).strip()
                    rm = re.search(r"근무지역\s+([^\s퇴]+?)(?=\s*퇴사사유|\s*$)", next_line)
                    if not rm:
                        rm = re.search(r"근무지역\s+(\S+)", next_line)
                    if rm:
                        region = rm.group(1).strip()
                    lm = re.search(r"퇴사사유\s+(.+)", next_line)
                    if lm:
                        leave_reason = lm.group(1).strip()
                    break
                i += 1
            description = " ".join(desc_lines) if desc_lines else ""
            # 첫 번째 루프에서 연봉/근무지역 줄을 만나 break한 경우 salary/region은 이미 채워짐.
            # 다음 줄들에서 추가로 있을 수 있으므로 계속 스캔.
            while i + 1 < len(lines):
                i += 1
                l = lines[i]
                if re.match(r"\d{4}\.\d{2}\s*~\s*(?:재직중|\d{4}\.\d{2})", l.strip()):
                    i -= 1
                    break
                sm = re.search(r"연봉\s+([^\s근]+)", l)
                if sm:
                    salary = sm.group(1).strip()
                rm = re.search(r"근무지역\s+([^\s퇴]+?)(?=\s*퇴사사유|\s*$)", l)
                if not rm:
                    rm = re.search(r"근무지역\s+(\S+)", l)
                if rm:
                    region = rm.group(1).strip()
                lm = re.search(r"퇴사사유\s+(.+)", l)
                if lm:
                    leave_reason = lm.group(1).strip()
            entries.append({
                "startDate": start_date,
                "endDate": "재직중" if end_raw == "재직중" else end_raw,
                "company": company,
                "role": role,
                "duration": duration,
                "description": description,
                "salary": salary,
                "region": region,
                "leaveReason": leave_reason,
            })
        i += 1
    return entries


# --- 학력 블록 ---
def parse_education_entries(block: str) -> list:
    """학력 섹션에서 학교·기간·학위·전공 추출."""
    entries = []
    lines = block.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # YYYY.MM ~ YYYY.MM   학교명  학위  전공
        m = re.match(r"(\d{4}\.\d{2})\s*~\s*(\d{4}\.\d{2})\s+(.+)", line.strip())
        if m:
            start_date = m.group(1)
            end_date = m.group(2)
            rest = m.group(3)
            # 학교명 전문(실업)계 전문(실업)계 전자계산기과 졸업 (고등학교도 ~과 있으면 전공에 포함)
            school = ""
            degree = ""
            major = ""
            for part in rest.split():
                if part in ("졸업", "재학", "휴학"):
                    degree = part
                    break
                if not school and part not in ("전문(실업)계", "전문계", "실업계"):
                    school = part
                elif part in ("전문(실업)계", "전문계", "실업계") or ("계" in part and not part.endswith("과")):
                    continue
                else:
                    major = major + " " + part if major else part
            entries.append({
                "startDate": start_date,
                "endDate": end_date,
                "school": school.strip(),
                "degree": degree,
                "major": major.strip(),
            })
        i += 1
    return entries


# --- 자격/어학/수상 ---
def parse_certification_entries(block: str) -> list:
    """자격증/어학/수상 라인: YYYY.MM  자격명  발급기관 형태만 수집 (경력/학력 문단이 섞이지 않도록)."""
    entries = []
    for line in block.split("\n"):
        line = line.strip()
        if not line or len(line) < 5:
            continue
        # YYYY.MM  자격명  발급기관 (날짜로 시작하는 라인만 자격으로 인정)
        m = re.match(r"(\d{4}\.\d{2})\s+(.+?)\s+([^\d].+)$", line)
        if m:
            entries.append({
                "date": m.group(1),
                "name": m.group(2).strip(),
                "issuer": m.group(3).strip(),
            })
    return entries


# --- 취업우대 (병역 등) ---
def parse_employment_preference(block: str) -> dict:
    """병역 등 취업우대사항."""
    out = {}
    if "병역" in block:
        m = re.search(r"병역\s*:\s*(\S+).*?(\S+/\S+).*?(\d{4}\.\d{2}\s*~\s*\d{4}\.\d{2})", block)
        if m:
            out["militaryStatus"] = m.group(1)
            out["militaryDetail"] = m.group(2)
            out["militaryPeriod"] = m.group(3)
    return out


# --- 포트폴리오: 파일명 나열 ---
def parse_portfolio(block: str) -> list:
    """첨부 파일명만 추출."""
    names = []
    for line in block.split("\n"):
        line = line.strip()
        if line.endswith((".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx")):
            names.append(line)
    return names


def parse_pdf_resume(pdf_path: str, pdftotext_exe: Optional[str] = None) -> dict:
    """PDF 한 개를 파싱해 구조화된 dict 반환."""
    text = extract_text_with_layout(pdf_path, pdftotext_exe)
    sections = split_into_sections(text)

    header_block = sections.get("header", "")
    basic = parse_header_block(header_block)

    # basicInfo 아래 요약 표(경력 총, 희망연봉, 직전 연봉)는 "나의 스킬" 이전 또는 경력 섹션 상단에 있음
    career_block = sections.get("career_summary", "") or ""
    summary_region = text[: text.find("나의 스킬")] if "나의 스킬" in text else text[: text.find("경력 총") or len(text)]
    summary = parse_summary_table_from_career_block(summary_region)
    summary.update(parse_summary_table_from_career_block(career_block))  # career 블록에도 있으면 덮어씀
    for k, v in summary.items():
        if v and (k not in basic or not basic.get(k)):
            basic[k] = v

    # 스킬 라인은 헤더 블록에 있을 수 있음
    skill_match = re.search(r"나의 스킬\s*\n(.+?)(?=경력 총|\Z)", text, re.DOTALL)
    skills_text = skill_match.group(1).strip() if skill_match else ""
    skills = [s.strip() for s in re.split(r"\s{2,}", skills_text) if s.strip()]

    careers = parse_career_entries(career_block)

    education_block = (sections.get("education_header", "") or "") + "\n" + (sections.get("education_header", "") or "")
    # 학력 헤더 다음에 오는 블록에서 실제 기간 있는 라인만
    edu_entries = parse_education_entries(sections.get("education_header", ""))

    cert_block = sections.get("certifications", "")
    certs = parse_certification_entries(cert_block) if cert_block else []

    pref_block = sections.get("employment_preference", "")
    employment_pref = parse_employment_preference(pref_block) if pref_block else {}

    portfolio_block = sections.get("portfolio", "")
    portfolio_files = parse_portfolio(portfolio_block) if portfolio_block else []

    self_intro = sections.get("self_introduction", "").strip() or ""

    return {
        "basicInfo": basic,
        "skills": skills,
        "careers": careers,
        "education": edu_entries,
        "certifications": certs,
        "employmentPreference": employment_pref,
        "portfolio": portfolio_files,
        "selfIntroduction": self_intro,
    }


def main():
    args = sys.argv[1:]
    pdftotext_exe = None
    if args and args[0] == "--pdftotext":
        if len(args) < 3:
            print(json.dumps({"error": "Usage: parse_pdf_resume.py [--pdftotext PATH] <pdf_path>"}, ensure_ascii=False, indent=2))
            sys.exit(1)
        pdftotext_exe = args[1]
        args = args[2:]
    if not args:
        print(json.dumps({"error": "Usage: parse_pdf_resume.py [--pdftotext PATH] <pdf_path>"}, ensure_ascii=False, indent=2))
        sys.exit(1)
    pdf_path = args[0]
    if not Path(pdf_path).exists():
        print(json.dumps({"error": f"File not found: {pdf_path}"}, ensure_ascii=False, indent=2))
        sys.exit(1)
    try:
        data = parse_pdf_resume(pdf_path, pdftotext_exe)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
