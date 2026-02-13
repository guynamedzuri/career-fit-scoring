#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF 이력서 1개를 구조 기반으로 파싱하여 JSON으로 출력하는 스크립트.

파싱 3단계:
  1단계: pdftotext(poppler) 등으로 PDF → raw 텍스트 추출
  2단계: 정규/섹션 분할로 블록·섹션 식별 후 basicInfo/careers/education 등 파싱
  3단계: (Electron 쪽) 파싱 결과를 DOCX와 동일한 applicationData·resumeText 형태로 재매핑

비교 관측용: --debug-dir DIR 지정 시 해당 폴더에 다음 파일을 저장합니다.
  <basename>.stage1_raw.txt   : 1단계 추출 원문 (첫 줄에 # engine: pdftotext|pdfminer|pymupdf)
  <basename>.stage1_meta.json : 1단계 메타 (engine, charCount)
  <basename>.stage2_sections.json : 2단계 중간 (blocks, sections, 블록별 할당 섹션명)
  (2단계 최종·3단계 결과는 Electron이 같은 폴더에 _python.json, _electron.json으로 저장)

사용법:
    python3 scripts/parse_pdf_resume.py <pdf_path>
    python3 scripts/parse_pdf_resume.py --pdftotext /path/to/pdftotext.exe <pdf_path>
    python3 scripts/parse_pdf_resume.py [--pdftotext PATH] --debug-dir ./debug <pdf_path>

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
        encoding='utf-8',
        errors='replace',  # 인코딩 오류 시 대체 문자로 처리
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


# 이력서 증명사진 표준 크기 (px)
PROFILE_PHOTO_WIDTH = 100
PROFILE_PHOTO_HEIGHT = 140


def _extract_profile_image_from_pdf(pdf_path: str, photo_dir: str) -> Optional[str]:
    """PDF에서 100x140 크기 이미지(증명사진)만 찾아 photo_dir에 저장. 저장된 파일명 반환, 없으면 None.
    PyMuPDF(fitz) 사용. 100x140이 없으면 추출하지 않음."""
    try:
        import fitz
    except ImportError:
        return None
    Path(photo_dir).mkdir(parents=True, exist_ok=True)
    try:
        doc = fitz.open(pdf_path)
        try:
            for page in doc:
                image_list = page.get_images(full=True)
                for img in image_list:
                    xref = img[0]
                    base = doc.extract_image(xref)
                    if not base or not base.get("image"):
                        continue
                    width = base.get("width", 0)
                    height = base.get("height", 0)
                    if width != PROFILE_PHOTO_WIDTH or height != PROFILE_PHOTO_HEIGHT:
                        continue
                    ext = base.get("ext", "png").lower()
                    if ext not in ("png", "jpg", "jpeg", "gif", "bmp"):
                        ext = "png"
                    out_name = f"profile.{ext}"
                    out_path = Path(photo_dir) / out_name
                    out_path.write_bytes(base["image"])
                    return out_name
        finally:
            doc.close()
    except Exception:
        pass
    return None


def extract_text_with_layout(
    pdf_path: str, pdftotext_exe: Optional[str] = None
) -> tuple[str, str]:
    """PDF에서 레이아웃 유사 텍스트 추출. pdftotext → pdfminer.six → PyMuPDF 순으로 시도.
    반환: (추출된_문자열, 사용된_엔진명 'pdftotext'|'pdfminer'|'pymupdf')."""
    errors: list[str] = []
    try:
        text = _extract_with_pdftotext(pdf_path, pdftotext_exe)
        if text and text.strip():
            return (text, "pdftotext")
        errors.append("pdftotext: 추출 결과가 비어 있음")
    except FileNotFoundError:
        errors.append("pdftotext: 실행 파일을 찾을 수 없음")
    except Exception as e:
        errors.append(f"pdftotext: {e}")
    try:
        text = _extract_with_pdfminer(pdf_path)
        if text and text.strip():
            return (text, "pdfminer")
        errors.append("pdfminer: 추출 결과가 비어 있음")
    except ImportError:
        errors.append("pdfminer: 모듈 미설치")
    except Exception as e:
        errors.append(f"pdfminer: {e}")
    try:
        text = _extract_with_pymupdf(pdf_path)
        if text and text.strip():
            return (text, "pymupdf")
        errors.append("pymupdf: 추출 결과가 비어 있음")
    except ImportError:
        errors.append("pymupdf: 모듈 미설치")
    except Exception as e:
        errors.append(f"pymupdf: {e}")
    raise RuntimeError(
        "PDF 텍스트 추출 실패 (모든 엔진 시도 완료). "
        + "; ".join(errors)
    )


# --- 섹션 분할 (연속 빈 줄 기준 vs 공통 헤더 리스트) ---
SECTION_HEADERS = [
    "경력 총 ",
    "경력기술서",
    "학력 ",
    "자격/어학/수상",
    "취업우대사항",
    "포트폴리오 및 기타문서",
    "자기소개서",
]

# 공통 헤더(코퍼스 추출) 문자열 → 내부 섹션명
CORPUS_HEADER_TO_SECTION = {
    "경력 총": "career_summary",
    "경력": "career_summary",
    "경력기술서": "career_detail_content",
    "학력 고등학교 졸업": "education_header",
    "학력 고등학교": "education_header",
    "학력": "education_header",
    "나의 스킬": "skills",
    "나의": "skills",
    "자격/어학/수상": "certifications",
    "취업우대사항": "employment_preference",
    "자기소개서": "self_introduction",
    "지원분야": "header",
    "입사지원일": "header",
    "주소": "header",
    "연봉": "header",
    "희망연봉": "header",
    "포트폴리오": "portfolio",
}


def _identify_section_name(block: str) -> str:
    """블록 내용을 보고 섹션 이름을 추론. 헤더 라벨 우선, 없으면 내용 패턴으로 판단."""
    block_lower = block.lower()
    lines = block.split("\n")
    first_lines = "\n".join(lines[:5])  # 처음 5줄만 확인
    
    # 헤더 라벨 확인
    for h in SECTION_HEADERS:
        if h in first_lines:
            if "경력기술서" in h:
                return "career_detail_content"
            if "경력 총" in h or "경력" in h:
                return "career_summary"
            elif "학력" in h:
                return "education_header"
            elif "자격" in h or "어학" in h or "수상" in h:
                return "certifications"
            elif "취업우대" in h:
                return "employment_preference"
            elif "포트폴리오" in h:
                return "portfolio"
            elif "자기소개" in h:
                return "self_introduction"
    
    # 헤더가 없으면 내용 패턴으로 추론 (학력을 경력보다 먼저 확인: 경력 없는 이력서에서 학력 블록이 날짜만으로 경력으로 오인되는 것 방지)
    if "나의 스킬" in first_lines or "스킬" in first_lines:
        return "skills"
    # 학력 패턴: "학력" 키워드 또는 학교명 + 졸업/재학 (경력 패턴보다 먼저)
    if "학력" in first_lines or re.search(r"(학교|대학교|대학|고등학교|중학교|초등학교).*(졸업|재학|중퇴)", block):
        return "education_header"
    # 경력 패턴: 날짜 범위 (예: "2017.08 ~ 재직중") + 회사/직무 느낌 (학력은 날짜+학교라 여기서 제외)
    if re.search(r"\d{4}\.\d{2}\s*~\s*(재직중|\d{4}\.\d{2})", block):
        # 학력과 겹치지 않도록: "고등학교"/"대학교"/"대학"이 있으면 학력으로 이미 위에서 처리됨. 남은 건 경력
        return "career_summary"
    # 자격증 패턴: 자격증명 + 합격/취득
    if re.search(r"(기능사|기사|산업기사|자격증|면허|OPIC|TOEIC|TOEFL).*(합격|취득|최종합격)", block):
        return "certifications"
    # 자기소개서 패턴: 긴 문단들
    if len(block) > 500 and not re.search(r"\d{4}\.\d{2}", block[:200]):
        return "self_introduction"
    
    return "unknown"


def load_section_headers_from_corpus(
    json_path: Optional[str] = None,
) -> Optional[list[dict] | list[str]]:
    """common_headers.json 에서 section_headers 로드.
    section_headers_with_trailing 이 있으면 [{text, trailing_min_empty_lines}, ...] 반환,
    없으면 기존 section_headers (문자열 리스트) 반환. 없으면 None."""
    if json_path is None:
        json_path = ""
        for base in (Path(__file__).resolve().parent.parent, Path.cwd()):
            for sub in ("pdf_resume", "scripts"):
                p = base / sub / "common_headers.json"
                if p.exists():
                    json_path = str(p)
                    break
            if json_path:
                break
    if not json_path or not Path(json_path).exists():
        return None
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        with_trailing = data.get("section_headers_with_trailing")
        if with_trailing and isinstance(with_trailing, list):
            return with_trailing
        headers = data.get("section_headers")
        if headers and isinstance(headers, list):
            return headers
    except Exception:
        pass
    return None


def split_into_sections_by_headers(
    full_text: str, headers: list[dict] | list[str]
) -> tuple[dict[str, str], list[str], list[str]]:
    """공통 헤더 리스트로 구간 분할. 헤더 문자열 + 그 뒤 줄넘김/공백까지 하나의 패턴으로 보면
    본문의 같은 단어(표 행 등)와 구분 가능. 반환: (sections, blocks, block_section_names)."""
    lines = full_text.split("\n")
    # 헤더가 dict 리스트면 trailing_min_empty_lines 조건 사용 (헤더+뒤 줄넘김까지 하나의 패턴)
    use_trailing = bool(
        headers and len(headers) > 0 and isinstance(headers[0], dict)
    )
    if use_trailing:
        sorted_headers = sorted(
            (h for h in headers if isinstance(h, dict) and h.get("text")),
            key=lambda h: (-len(h["text"]), h["text"]),
        )
    else:
        plain = [h for h in headers if isinstance(h, str)]
        sorted_headers = sorted(
            ({"text": h, "trailing_min_empty_lines": 0} for h in set(plain)),
            key=lambda h: (-len(h["text"]), h["text"]),
        )
    # (라인 인덱스, 매칭된 헤더 텍스트) — 한 줄에 하나만, trailing 조건 만족 시에만
    hits: list[tuple[int, str]] = []
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue
        for h in sorted_headers:
            text = h["text"]
            if not line.startswith(text):
                continue
            if use_trailing and h.get("trailing_min_empty_lines", 0) > 0:
                # 이 줄 뒤에 빈 줄이 최소 N개 이어지는지 확인 (표 행이면 0개)
                # 자격/어학/수상·자격: PDF에서 헤더 다음이 폼피드(\f)+날짜로 바로 오는 경우가 있어 빈 줄 0개도 인정
                # 학력·학력 고등학교 졸업: PDF에서 "학력 고등학교 졸업" 다음에 빈 줄 없이 날짜 줄이 오는 경우가 있어 빈 줄 0개 인정
                required = h["trailing_min_empty_lines"]
                if text.strip() == "자격/어학/수상":
                    required = 0
                elif text.strip() == "자격":
                    required = min(required, 1)
                elif text.strip() in ("학력 고등학교 졸업", "학력 고등학교", "학력"):
                    required = 0
                j = i + 1
                empty_count = 0
                while j < len(lines):
                    if lines[j].strip():
                        break
                    empty_count += 1
                    j += 1
                if empty_count < required:
                    continue
            hits.append((i, text))
            break
    hits.sort(key=lambda x: x[0])
    sections: dict[str, str] = {}
    blocks: list[str] = []
    block_section_names: list[str] = []
    if not hits:
        # 공통 헤더가 하나도 없으면 전체를 header 로
        sections["header"] = full_text.strip()
        blocks.append(full_text.strip())
        block_section_names.append("header")
        return sections, blocks, block_section_names
    # 첫 헤더 이전 = 상단(header)
    if hits:
        first_idx = hits[0][0]
        if first_idx > 0:
            header_block = "\n".join(lines[:first_idx]).strip()
            if header_block:
                sections["header"] = header_block
                blocks.append(header_block)
                block_section_names.append("header")
    for k, (idx, header) in enumerate(hits):
        section_name = CORPUS_HEADER_TO_SECTION.get(
            header.strip(), "unknown"
        )
        end_idx = hits[k + 1][0] if k + 1 < len(hits) else len(lines)
        # 헤더 라인 포함 (예: "경력 총 16년 9개월" 이 career_summary 에 들어가도록)
        content_lines = lines[idx:end_idx]
        content = "\n".join(content_lines).strip()
        if not content:
            continue
        if section_name in sections:
            sections[section_name] += "\n\n" + content
        else:
            sections[section_name] = content
        blocks.append(content)
        block_section_names.append(section_name)
    return sections, blocks, block_section_names


def split_into_sections(full_text: str):
    """전체 텍스트를 섹션별로 나눔. 연속 빈 줄(3개 이상)을 기준으로 블록 분리.
    반환: (sections, blocks, block_section_names). block_section_names[i]는 blocks[i]에 할당된 섹션명."""
    sections = {}
    block_section_names = []  # blocks와 동일 순서로 섹션명
    lines = full_text.split("\n")
    
    # 연속 빈 줄 기준으로 블록 분리
    blocks = []
    current_block = []
    consecutive_empty = 0
    MIN_EMPTY_LINES = 3  # 3개 이상의 연속 빈 줄이면 섹션 경계
    
    for i, line in enumerate(lines):
        is_empty = not line.strip()
        
        if is_empty:
            consecutive_empty += 1
            if consecutive_empty >= MIN_EMPTY_LINES:
                # 연속 빈 줄이 충분히 많으면 이전 블록 저장하고 새 블록 시작
                if current_block:
                    blocks.append("\n".join(current_block).strip())
                    current_block = []
                consecutive_empty = 0
                continue
        else:
            consecutive_empty = 0
        
        current_block.append(line)
    
    # 마지막 블록 추가
    if current_block:
        blocks.append("\n".join(current_block).strip())
    
    # 각 블록을 섹션으로 분류
    for idx, block in enumerate(blocks):
        section_name = _identify_section_name(block) if block else "empty"
        # 첫 번째 블록은 header로 처리 (명확한 섹션이 아니면)
        if idx == 0 and section_name == "unknown":
            section_name = "header"
        # 첫 블록은 항상 basicInfo(이름/나이/주소 등) 추출용으로 header에도 넣음
        # (첫 블록이 "나의 스킬" 등으로 skills로 분류돼도 상단에 이름·생년·주소가 있음)
        if idx == 0 and block:
            sections["header"] = block

        block_section_names.append(section_name)
        if not block:
            continue
        # 이미 같은 이름의 섹션이 있으면 병합 (예: 여러 경력 항목)
        if section_name in sections:
            sections[section_name] += "\n\n" + block
        else:
            sections[section_name] = block

    return sections, blocks, block_section_names


# --- 헤더 블록에서 기본 정보 추출 ---
def _classify_residence(address: str) -> str:
    """주소 문자열에서 거주지 분류 (서울/수도권/시흥/안산/지방)."""
    if not address or not isinstance(address, str):
        return ""
    a = address.strip()
    if "시흥" in a or "시흥시" in a:
        return "시흥"
    if "안산" in a or "안산시" in a:
        return "안산"
    if "서울" in a or "서울시" in a or "서울특별시" in a:
        return "서울"
    if any(x in a for x in ("경기", "경기도", "인천", "수원", "성남", "고양", "용인", "부천", "안양", "평택", "의정부", "광명", "과천", "구리", "남양주", "오산", "의왕", "이천", "하남", "화성", "분당", "판교")):
        return "수도권"
    return "지방"


def parse_header_block(block: str) -> dict:
    """상단 블록에서 이름, 성별, 생년, 나이, 이메일, 휴대폰, 주소, 지원분야, 입사지원일, 직전연봉, 거주지 추출."""
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
    for pattern in (r"([^\s]+)\s+경력\s*$", r"([^\s]+)\s+신입\s*$", r"([^\s]+)\s+경력\s", r"([^\s]+)\s+신입\s"):
        for m in re.finditer(pattern, block, re.MULTILINE):
            if idx_skill != -1 and m.start() > idx_skill:
                continue
            candidates.append((m.start(), m.group(1).strip()))
    candidates.sort(key=lambda x: x[0])
    for _, name in candidates:
        if _accept_name(name):
            info["name"] = name
            break
    # 이름 폴백: "남," / "여," 바로 앞 줄에서 2~4 한글 또는 영문 이름 추출
    if "name" not in info or not info["name"]:
        lines = block.split("\n")
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if re.match(r"^(남|여)\s*,\s*\d{4}", line_stripped):
                if i > 0:
                    prev = lines[i - 1].strip()
                    if _accept_name(prev):
                        info["name"] = prev
                    else:
                        # "강동화 경력" 형태면 앞 단어만
                        first_word = prev.split(None, 1)[0] if prev else ""
                        if _accept_name(first_word):
                            info["name"] = first_word
                break
            if re.match(r"^[\uac00-\ud7a3]{2,4}$", line_stripped) or re.match(r"^[A-Za-z]{2,20}$", line_stripped):
                if _accept_name(line_stripped):
                    info["name"] = line_stripped
                    break
    # 이름 폴백: 자격증 확인서 등 "성명     홍길동" 형식
    if "name" not in info or not info["name"]:
        m_name = re.search(r"성명\s+([\uac00-\ud7a3A-Za-z]{2,20})(?:\s|$)", text)
        if m_name and _accept_name(m_name.group(1).strip()):
            info["name"] = m_name.group(1).strip()

    # 남/여, 1991 (34세)
    m = re.search(r"(남|여)\s*,\s*(\d{4})\s*\((\d+)세\)", text)
    if m:
        info["gender"] = m.group(1)
        info["birthYear"] = m.group(2)
        info["age"] = int(m.group(3))
    # 폴백: "남,"/"여," 없이 "1998 (27세)" 형태만 있는 경우 (홍순철 등)
    if "birthYear" not in info or "age" not in info:
        m2 = re.search(r"\b(19[5-9]\d|20[0-1]\d)\s*\((\d{1,2})세\)", text)
        if m2:
            if "birthYear" not in info:
                info["birthYear"] = m2.group(1)
            if "age" not in info:
                try:
                    info["age"] = int(m2.group(2))
                except ValueError:
                    pass
    # 폴백: 자격증 확인서 등 "생년월일    1999년 10월 10일" (연도만 추출, 나이는 미기재)
    if "birthYear" not in info:
        m3 = re.search(r"생년월일\s+(\d{4})년", text)
        if m3:
            info["birthYear"] = m3.group(1)

    # 이메일
    m = re.search(r"이메일\s+(\S+@\S+)", text)
    if m:
        info["email"] = m.group(1).strip()
    # 휴대폰 / 전화번호
    m = re.search(r"(?:휴대폰|전화번호)\s+(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})", text)
    if m:
        info["phone"] = re.sub(r"\s+", "", m.group(1))
    # 주소: 5자리 우편 (괄호 선택) 또는 3-3 형식 (괄호 필수, 전화번호 xxx-xxxx-xxxx와 구분)
    m = re.search(
        r"주소\s+(?:\(?\d{5}\)?|\(\d{3}-\d{3}\))\s*([^\n]+?)(?=\s+경력\s|$)", text
    )
    if m:
        info["address"] = m.group(1).strip()
    # 주소 대체: "주소 " 다음 한 줄
    if "address" not in info:
        m = re.search(r"주소\s+([^\n]+)", block)
        if m:
            info["address"] = m.group(1).strip()
    # 거주지: 주소에서 분류 (서울/수도권/시흥/안산/지방)
    if info.get("address"):
        info["residence"] = _classify_residence(info["address"])

    # 경력 총 N년 N개월 (표에서 학력/경력 순서가 바뀌어도 경력 열 값만 쓰기)
    m = re.search(r"경력\s*총\s*(\d+년\s*\d*개월)", text)
    if m:
        info["totalCareer"] = m.group(1).strip()
    if "totalCareer" not in info:
        # 학력 먼저인 표: "총 4년"(학력)이 "총 6년 3개월"(경력)보다 앞에 있으면, "경력" 뒤의 "총 N년"만 쓴다
        career_pos = text.find("경력")
        if career_pos >= 0:
            m_after = re.search(
                r"총\s*(\d+년\s*\d*개월)",
                text[career_pos:],
            )
            if m_after:
                info["totalCareer"] = m_after.group(1).strip()
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
    # 직전 연봉: "직전 연봉 : 3,800 만원" (공백 허용)
    m = re.search(r"직전\s*연봉\s*:\s*([0-9,]+)\s*만\s*원", text)
    if m:
        info["lastSalary"] = m.group(1).strip() + "만원"
    if "lastSalary" not in info:
        m = re.search(r"직전\s*연봉\s*:\s*([0-9,]+)\s*만원", text)
        if m:
            info["lastSalary"] = m.group(1).strip() + "만원"
    if "lastSalary" not in info:
        m = re.search(r"직전\s*연봉\s*:\s*([^\s원]+만원?)", text)
        if m:
            info["lastSalary"] = m.group(1).strip().rstrip("원") + ("만원" if "만" in m.group(1) else "만원")
    if "lastSalary" not in info and "회사내규에 따름" in text:
        info["lastSalary"] = "회사내규에 따름"

    return info


def parse_summary_table_from_career_block(block: str) -> dict:
    """경력 섹션 상단 요약 표(경력 총, 희망연봉, 직전 연봉)에서 basicInfo 보강용 필드 추출."""
    out = {}
    text = block.replace("\n", " ")
    # 경력 총 N년 N개월 (표에서 학력/경력 순서 바뀌어도 경력 열 값만)
    m = re.search(r"경력\s*총\s*(\d+년\s*\d*개월)", text)
    if m:
        out["totalCareer"] = m.group(1).strip()
    if "totalCareer" not in out:
        career_pos = text.find("경력")
        if career_pos >= 0:
            m_after = re.search(r"총\s*(\d+년\s*\d*개월)", text[career_pos:])
            if m_after:
                out["totalCareer"] = m_after.group(1).strip()
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
    m = re.search(r"직전\s*연봉\s*:\s*([0-9,]+)\s*만\s*원", text)
    if m:
        out["lastSalary"] = m.group(1).strip() + "만원"
    if "lastSalary" not in out:
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
            # 첫 번째 ' · '를 구분자로: 앞 = 회사이름/부서 통째로, 뒤 = 직무(role)
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
                "companyNameAndDepartment": company,
                "role": role,
                "duration": duration,
                "description": description,
                "salary": salary,
                "region": region,
                "leaveReason": leave_reason,
            })
        i += 1
    return entries


# 학점 패턴: 3.46/4.5 또는 3.46 / 4.5 (슬래시 주변 공백 허용)
GPA_PATTERN = re.compile(r"\d+\.\d+\s*/\s*\d+\.\d+")


# --- 학력 블록 ---
def parse_education_entries(block: str) -> list:
    """학력 섹션에서 학교·기간·학위·전공·학점(GPA) 추출. 학점은 3.46/4.5 형태."""
    entries = []
    lines = block.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # YYYY.MM ~ YYYY.MM   학교명  학위  전공  [학점]
        m = re.match(r"(\d{4}\.\d{2})\s*~\s*(\d{4}\.\d{2})\s+(.+)", line.strip())
        if m:
            start_date = m.group(1)
            end_date = m.group(2)
            rest = m.group(3)
            # 같은 줄에서 학점(3.46/4.5) 추출 후 제거 (전공에 섞이지 않도록)
            gpa = ""
            gpa_match = GPA_PATTERN.search(rest)
            if gpa_match:
                gpa = gpa_match.group(0)
                rest = (rest[: gpa_match.start()] + rest[gpa_match.end() :]).strip()
            # 다음 몇 줄에 학점이 있는 경우 (예: 3.46/4.5 또는 "학점 3.46/4.5", 빈 줄 건너뛰기)
            if not gpa:
                date_line_re = re.compile(r"^\d{4}\.\d{2}\s*~\s*\d{4}\.\d{2}\s+")
                for j in range(i + 1, min(i + 4, len(lines))):
                    cand = lines[j].strip()
                    if date_line_re.match(cand):
                        break  # 다음 학력 항목이면 중단
                    gpa_m = GPA_PATTERN.search(cand)
                    if gpa_m:
                        gpa = gpa_m.group(0).replace(" ", "")  # "3.46 / 4.5" → "3.46/4.5"
                        i = j  # 해당 줄까지 소비
                        break
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
            # 날짜 줄에 졸업/재학/휴학이 없으면 이전 줄·다음 1~2줄에서 찾기 (PDF에서 "학력 고등학교 졸업" 다음에 날짜만 있는 경우)
            if not degree:
                # 이전 줄(헤더에 "학력 고등학교 졸업"이 있는 경우)
                if i > 0:
                    prev_line = lines[i - 1].strip()
                    for d in ("졸업", "재학", "휴학"):
                        if d in prev_line:
                            degree = d
                            break
                for j in range(i + 1, min(i + 3, len(lines))):
                    if degree:
                        break
                    next_line = lines[j].strip()
                    if re.match(r"^\d{4}\.\d{2}\s*~\s*\d{4}\.\d{2}\s+", next_line):
                        break  # 다음 학력 항목이면 중단
                    for d in ("졸업", "재학", "휴학"):
                        if d in next_line:
                            degree = d
                            break
            # 고등학교인데 major가 "고등학교"만 있으면 전공으로 중복 표기하지 않음
            if major.strip() == "고등학교" and (school.endswith("고등학교") or "고등학교" in school):
                major = ""
            entries.append({
                "startDate": start_date,
                "endDate": end_date,
                "school": school.strip(),
                "degree": degree,
                "major": major.strip(),
                "gpa": gpa or None,
            })
        i += 1
    # 날짜 없이 "고등학교 졸업"만 있는 블록 폴백: 항목이 없고 블록에 학교+졸업/재학이 있으면 1건 추가
    if not entries and block.strip():
        degree_cand = None
        for d in ("졸업", "재학", "휴학"):
            if d in block:
                degree_cand = d
                break
        school_cand = ""
        for raw_line in lines:
            line = raw_line.strip()
            if not line or (line.startswith("학력") and len(line) < 30):
                continue
            if not re.search(r"(고등학교|중학교|초등학교|대학교|대학)", line) or not degree_cand:
                continue
            # "○○고등학교 고등학교 졸업" 또는 "고등학교 졸업" 형태: 학교명은 학교 키워드 포함 토큰만 모음
            tokens = line.replace(",", " ").split()
            parts = []
            for t in tokens:
                if t in ("졸업", "재학", "휴학"):
                    break
                if "고등학교" in t or "중학교" in t or "초등학교" in t or "대학교" in t or "대학" in t:
                    parts.append(t)
            if parts:
                school_cand = " ".join(parts)
                break
        if degree_cand and (school_cand or "고등학교" in block or "중학교" in block or "대학교" in block):
            if not school_cand:
                school_cand = "고등학교" if "고등학교" in block else ("중학교" if "중학교" in block else "대학교")
            entries.append({
                "startDate": "",
                "endDate": "",
                "school": school_cand,
                "degree": degree_cand,
                "major": "",
                "gpa": None,
            })
    return entries


# --- 자격/어학/수상 ---
def parse_certification_entries(block: str) -> list:
    """자격증/어학/수상 라인: YYYY.MM  자격명  합격여부/등급/점수  시행처 형태만 수집."""
    entries = []
    for raw_line in block.split("\n"):
        # 폼피드·제어문자 제거 후 한 줄로
        line = re.sub(r"[\f\r]+", " ", raw_line).strip()
        if not line or len(line) < 5:
            continue
        # "자격/어학/수상" 헤더 라인 스킵
        if line.startswith("자격") and ("어학" in line or "수상" in line) and len(line) < 30:
            continue
        # YYYY.MM  자격명  합격여부/등급/점수  시행처 (날짜로 시작하는 라인만 자격으로 인정)
        m = re.match(r"(\d{4}\.\d{2})\s+(.+?)\s+([^\d].+)$", line)
        if m:
            issuer_full = m.group(3).strip()
            issuer_parts = re.split(r"\s{3,}|\t+", issuer_full)
            if len(issuer_parts) >= 2:
                grade_status = issuer_parts[0].strip()
                issuer_org = " ".join(issuer_parts[1:]).strip()
            else:
                grade_status = ""
                issuer_org = issuer_full
            entries.append({
                "date": m.group(1),
                "name": m.group(2).strip(),
                "grade": grade_status,
                "issuer": issuer_org,
            })
            continue
        # 날짜 + 자격명만 있는 라인 (합격/시행처 없음). 경력 형식(YYYY.MM ~ ...) 제외
        m2 = re.match(r"(\d{4}\.\d{2})\s+(.+)", line)
        if m2:
            rest = m2.group(2).strip()
            if rest and " ~ " not in rest and not re.match(r"^\d{4}\.\d{2}", rest):
                entries.append({
                    "date": m2.group(1),
                    "name": rest,
                    "grade": "",
                    "issuer": "",
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
    """첨부 파일명만 추출. 라벨과 파일명이 같은 라인에 있어도 파일명만 추출."""
    names = []
    for line in block.split("\n"):
        line = line.strip()
        if not line:
            continue
        # 파일 확장자로 끝나는 경우
        if line.endswith((".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx")):
            # "포트폴리오                  운전면허증.jpg" 같은 경우 파일명만 추출
            # 라벨(포트폴리오, 자격증 등) 제거
            parts = re.split(r"\s{3,}", line)  # 3개 이상 공백으로 분리
            for part in parts:
                part = part.strip()
                if part.endswith((".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx")):
                    # 라벨 키워드 제거
                    cleaned = re.sub(r"^(포트폴리오|자격증|증명서)\s*", "", part, flags=re.IGNORECASE).strip()
                    if cleaned:
                        names.append(cleaned)
                    break
            else:
                # 분리되지 않았으면 전체 라인 사용 (라벨 제거)
                cleaned = re.sub(r"^(포트폴리오|자격증|증명서)\s*", "", line, flags=re.IGNORECASE).strip()
                if cleaned:
                    names.append(cleaned)
    # 중복 제거
    seen = set()
    unique_names = []
    for name in names:
        if name not in seen:
            seen.add(name)
            unique_names.append(name)
    return unique_names


def _write_debug_stage1(debug_dir: str, base_name: str, raw_text: str, engine: str) -> None:
    """1단계(pdftotext 등 추출) 출력: raw 텍스트 + 사용 엔진."""
    import os
    os.makedirs(debug_dir, exist_ok=True)
    raw_path = os.path.join(debug_dir, f"{base_name}.stage1_raw.txt")
    with open(raw_path, "w", encoding="utf-8") as f:
        f.write(f"# engine: {engine}\n")
        f.write(raw_text)
    meta_path = os.path.join(debug_dir, f"{base_name}.stage1_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"engine": engine, "charCount": len(raw_text)}, f, ensure_ascii=False, indent=2)


def _write_debug_stage2(
    debug_dir: str, base_name: str, blocks: list, block_section_names: list, sections: dict
) -> None:
    """2단계(정규/섹션 분할) 중간 출력: 블록별 텍스트와 할당된 섹션명."""
    import os
    os.makedirs(debug_dir, exist_ok=True)
    out = {
        "blocks": [
            {"section": name, "text": block}
            for block, name in zip(blocks, block_section_names)
        ],
        "sections_keys": list(sections.keys()),
        "sections": {k: v for k, v in sections.items()},
    }
    path = os.path.join(debug_dir, f"{base_name}.stage2_sections.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


def parse_pdf_resume(
    pdf_path: str,
    pdftotext_exe: Optional[str] = None,
    debug_dir: Optional[str] = None,
    use_corpus_headers: bool = False,
    photo_dir: Optional[str] = None,
) -> dict:
    """PDF 한 개를 파싱해 구조화된 dict 반환.
    debug_dir이 있으면 1단계(raw 텍스트), 2단계(섹션/블록) 중간 결과를 해당 폴더에 저장.
    use_corpus_headers=True 이면 common_headers.json 의 section_headers 로 구간 구분 (헤더=구간 시작).
    참고: 같은 헤더(예: 학력)가 표와 본문에 둘 다 나오면 구간이 조기 끊길 수 있음. 기본은 연속 빈 줄 기준 분할."""
    text, engine = extract_text_with_layout(pdf_path, pdftotext_exe)
    corpus_headers = load_section_headers_from_corpus() if use_corpus_headers else None
    if corpus_headers:
        # 경력기술서 섹션도 감지하도록 헤더 목록에 추가 (PDF에 해당 항목이 있으면 파싱)
        merged_headers = list(corpus_headers) if corpus_headers else []
        if merged_headers and isinstance(merged_headers[0], dict):
            if not any(h.get("text") == "경력기술서" for h in merged_headers if isinstance(h, dict)):
                merged_headers.append({"text": "경력기술서", "trailing_min_empty_lines": 0})
        elif merged_headers and isinstance(merged_headers[0], str):
            if "경력기술서" not in merged_headers:
                merged_headers.append("경력기술서")
        sections, blocks, block_section_names = split_into_sections_by_headers(
            text, merged_headers
        )
    else:
        sections, blocks, block_section_names = split_into_sections(text)

    if debug_dir:
        base_name = Path(pdf_path).stem
        _write_debug_stage1(debug_dir, base_name, text, engine)
        _write_debug_stage2(debug_dir, base_name, blocks, block_section_names, sections)

    # basicInfo: 첫 블록만 있으면 이름/이메일/주소가 둘째 블록에 있어 빈 basic이 됨 → 첫 두 블록 합쳐서 추출
    header_for_basic = "\n\n".join(blocks[:2]) if len(blocks) >= 2 else (blocks[0] if blocks else "")
    basic = parse_header_block(header_for_basic)
    header_block = sections.get("header", "")

    # basicInfo 아래 요약 표(경력 총, 희망연봉, 직전 연봉)는 header 블록 또는 career 섹션 상단에 있음
    career_block = sections.get("career_summary", "") or ""
    summary_region = header_block  # header 블록에서 요약 정보 추출
    summary = parse_summary_table_from_career_block(summary_region)
    summary.update(parse_summary_table_from_career_block(career_block))  # career 블록에도 있으면 덮어씀
    for k, v in summary.items():
        if v and (k not in basic or not basic.get(k)):
            basic[k] = v

    # 스킬: skills 섹션에서 추출, 없으면 header에서 찾기
    skills_block = sections.get("skills", "")
    if skills_block:
        # "나의 스킬" 헤더 제거하고 내용만
        skills_text = re.sub(r"^나의\s*스킬\s*\n?", "", skills_block, flags=re.MULTILINE).strip()
    else:
        # 헤더 블록에서 찾기 (하위 호환)
        skill_match = re.search(r"나의\s*스킬\s*\n(.+?)(?=경력\s*총|\Z)", header_block, re.DOTALL)
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

    self_intro = sections.get("self_introduction", "").strip() or ""

    # PDF 전용: '경력기술서' 섹션이 있으면 통째로 추출 (경력세부내용으로 전달)
    career_detail_content = (sections.get("career_detail_content", "") or "").strip()
    if career_detail_content and career_detail_content.startswith("경력기술서"):
        first_nl = career_detail_content.find("\n")
        if first_nl >= 0:
            career_detail_content = career_detail_content[first_nl + 1 :].strip()
        else:
            career_detail_content = ""

    out = {
        "basicInfo": basic,
        "skills": skills,
        "careers": careers,
        "education": edu_entries,
        "certifications": certs,
        "employmentPreference": employment_pref,
        "selfIntroduction": self_intro,
    }
    if career_detail_content:
        out["careerDetailContent"] = career_detail_content
    # 증명사진 후보 이미지 추출 (있으면 한 장만 저장)
    if photo_dir:
        profile_filename = _extract_profile_image_from_pdf(pdf_path, photo_dir)
        if profile_filename:
            out["profilePhotoFilename"] = profile_filename
    return out


def main():
    args = sys.argv[1:]
    pdftotext_exe = None
    debug_dir = None
    use_corpus_headers = False
    photo_dir = None
    while args:
        if args[0] == "--pdftotext" and len(args) >= 3:
            pdftotext_exe = args[1]
            args = args[2:]
        elif args[0] == "--debug-dir" and len(args) >= 2:
            debug_dir = args[1]
            args = args[2:]
        elif args[0] == "--use-corpus-headers":
            use_corpus_headers = True
            args = args[1:]
        elif args[0] == "--photo-dir" and len(args) >= 2:
            photo_dir = args[1]
            args = args[2:]
        else:
            break
    if not args:
        print(
            json.dumps(
                {
                    "error": "Usage: parse_pdf_resume.py [--pdftotext PATH] [--debug-dir DIR] [--use-corpus-headers] [--photo-dir DIR] <pdf_path>"
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        sys.exit(1)
    pdf_path = args[0]
    if not Path(pdf_path).exists():
        print(json.dumps({"error": f"File not found: {pdf_path}"}, ensure_ascii=False, indent=2))
        sys.exit(1)
    try:
        data = parse_pdf_resume(
            pdf_path, pdftotext_exe, debug_dir, use_corpus_headers, photo_dir
        )
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(json.dumps({"error": str(e), "traceback": tb}, ensure_ascii=False, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
