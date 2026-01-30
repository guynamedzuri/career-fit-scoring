#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
20건(또는 지정 폴더) pdftotext(stage1) 출력물을 비교해,
여러 건에서 공통으로 등장하는 텍스트를 헤더 후보로 뽑아 리스트화한다.

사용법:
  python3 scripts/build_common_headers.py [stage1_텍스트_폴더]
  폴더 생략 시 pdf_resume/debug (stage1_raw.txt 기준)

출력:
  - 공통 헤더 후보 리스트 (등장 횟수 순)
  - common_headers.json 에 저장 (parse_pdf_resume 등에서 사용 가능)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def collect_lines_from_file(path: Path, max_line_len: int = 60) -> set[str]:
    """한 파일에서 헤더 후보가 될 수 있는 라인만 수집 (빈 줄/주석/너무 긴 줄 제외)."""
    lines = set()
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("# "):
                continue
            if len(line) > max_line_len:
                continue
            lines.add(line)
    return lines


def collect_header_with_trailing(path: Path, section_like: re.Pattern, max_line_len: int = 35) -> list[tuple[str, int]]:
    """한 파일에서 '헤더 후보 라인 + 그 뒤 줄넘김 개수' 수집.
    반환: [(헤더_문자열, 뒤에_이어진_빈줄_개수), ...]. 빈 줄 = strip() 후 비어 있는 줄."""
    out: list[tuple[str, int]] = []
    with open(path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()
    lines = [r.rstrip("\n") for r in raw_lines]
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith("# "):
            i += 1
            continue
        if len(line) > max_line_len:
            i += 1
            continue
        if not section_like.search(line) and line not in ("지원분야", "입사지원일", "주소", "나의"):
            i += 1
            continue
        # 이 줄 뒤에 빈 줄이 몇 개 이어지는지
        j = i + 1
        empty_count = 0
        while j < len(lines):
            if lines[j].strip():
                break
            empty_count += 1
            j += 1
        # 빈 줄 개수 = 줄바꿈으로 치면 empty_count 개 (줄과 줄 사이)
        out.append((line, empty_count))
        i += 1
    return out


def normalize_for_header(s: str) -> str | None:
    """헤더 매칭용 정규화: 앞뒤 공백 제거, 연속 공백을 하나로. None이면 후보에서 제외."""
    t = " ".join(s.split()).strip()
    if not t or len(t) < 2:
        return None
    return t


def extract_prefix_candidates(line: str, max_prefix_len: int = 25) -> list[str]:
    """한 라인에서 '헤더처럼 쓰일 수 있는' 접두어 후보 추출.
    예: '경력 총 16년 9개월' -> ['경력 총 16년 9개월', '경력 총 16년', '경력 총 16', '경력 총', '경력']
    """
    t = " ".join(line.split()).strip()
    if not t:
        return []
    out = []
    # 공백/· 기준으로 잘라서 접두어 생성 (너무 짧지 않게)
    parts = re.split(r"\s+|[·]", t)
    acc = []
    for p in parts:
        acc.append(p)
        prefix = " ".join(acc)
        if 2 <= len(prefix) <= max_prefix_len:
            out.append(prefix)
    if t not in out and len(t) <= max_prefix_len:
        out.append(t)
    return out


def main() -> None:
    if len(sys.argv) > 1:
        base_dir = Path(sys.argv[1])
    else:
        base_dir = Path(__file__).resolve().parent.parent / "pdf_resume" / "debug"

    if not base_dir.is_dir():
        print(f"오류: 폴더가 없습니다: {base_dir}", file=sys.stderr)
        sys.exit(1)

    # stage1_raw.txt 만 사용
    files = sorted(base_dir.glob("*.stage1_raw.txt"))
    if not files:
        print(f"경고: stage1_raw.txt 없음: {base_dir}", file=sys.stderr)
        sys.exit(0)

    # (정규화된 라인) -> 등장한 파일 수
    exact_count: dict[str, int] = {}
    # (접두어) -> 등장한 파일 수 (한 파일에서 같은 접두어가 여러 번 나와도 1회로 카운트)
    prefix_count: dict[str, int] = {}

    for path in files:
        line_set = collect_lines_from_file(path)
        seen_prefix: set[str] = set()
        for line in line_set:
            norm = normalize_for_header(line)
            if norm:
                exact_count[norm] = exact_count.get(norm, 0) + 1
            for prefix in extract_prefix_candidates(line):
                if prefix not in seen_prefix:
                    seen_prefix.add(prefix)
                    prefix_count[prefix] = prefix_count.get(prefix, 0) + 1

    n_files = len(files)
    # 50% 이상 등장한 정확 라인
    min_occur = max(2, n_files // 2)
    common_exact = [
        (line, cnt)
        for line, cnt in exact_count.items()
        if cnt >= min_occur
    ]
    common_exact.sort(key=lambda x: (-x[1], x[0]))

    # 50% 이상 등장한 접두어 (헤더로 쓰기 좋은 짧은 것 위주)
    common_prefix = [
        (p, cnt)
        for p, cnt in prefix_count.items()
        if cnt >= min_occur and 2 <= len(p) <= 40
    ]
    common_prefix.sort(key=lambda x: (-x[1], -len(x[0]), x[0]))

    # 필드 라벨성 제거: "이메일 xxx", "주소 xxx" 는 내용이 달라서 정확 라인은 안 묶이지만,
    # "이메일", "주소", "휴대폰" 같은 짧은 접두어는 많이 나옴. 섹션 헤더로 쓸 후보만 남기려면
    # "경력", "학력", "나의 스킬", "연봉", "포트폴리오", "자기소개", "자격" 등 포함하는 것 우선.
    section_like = re.compile(
        r"경력|학력|스킬|연봉|희망|포트폴리오|자기소개|자격|어학|수상|취업|경험|활동|교육|간략\s*소개|나의"
    )

    header_candidates = []
    seen = set()
    for p, cnt in common_prefix:
        if p in seen:
            continue
        # 너무 일반적인 단어만 있는 건 제외 (선택)
        if section_like.search(p) or cnt >= n_files * 3 // 4:
            seen.add(p)
            header_candidates.append({"text": p, "count": cnt, "files": n_files})

    # 정확 라인도 헤더 후보에 (섹션 구분에 쓸 수 있는 것)
    for line, cnt in common_exact[:80]:
        if line in seen or len(line) > 35:
            continue
        if section_like.search(line) or re.search(r"^\s*[경학자나]|총\s*\d+년", line):
            seen.add(line)
            header_candidates.append({"text": line, "count": cnt, "files": n_files})

    # 사용할 때 순서가 중요할 수 있음: 문서에서 자주 나오는 순서대로 정렬 (경력/학력/스킬 등)
    order_key = [
        "지원분야", "입사지원일", "이메일", "휴대폰", "주소",
        "경력", "학력", "희망", "포트폴리오", "나의 스킬", "스킬",
        "자격", "어학", "수상", "취업", "자기소개", "간략", "경험", "활동",
    ]

    def sort_key(item: dict) -> tuple:
        t = item["text"]
        for i, k in enumerate(order_key):
            if k in t:
                return (i, -item["count"], t)
        return (len(order_key), -item["count"], t)

    header_candidates.sort(key=sort_key)

    # 섹션 구분용: 짧고, 하단 경고 문구 제외
    exclude = re.compile(
        r"위조|사람인|구직\s*목적|위의\s*모든\s*내용|첨부된\s*문서|이용\s*시\s*이력서"
    )
    section_order = [
        "경력 총", "경력",
        "학력 고등학교 졸업", "학력 고등학교", "학력",
        "나의 스킬", "나의",
        "희망연봉", "희망",
        "포트폴리오",
        "자격/어학/수상", "자격",
        "취업우대사항", "취업",
        "자기소개서", "자기소개",
        "간략 소개", "간략",
        "지원분야", "입사지원일", "주소",
        # "연봉" 단독은 경력 본문(연봉 3,800만원 등)에서 잘리므로 제외. "희망연봉"만 사용
    ]
    # 헤더 문자열 + 그 뒤 빈 줄 개수까지 하나의 패턴으로 수집 (표의 "경력  학력"은 뒤에 빈 줄이 없음)
    key_to_trailing: dict[str, list[int]] = {}
    for path in files:
        for line_stripped, trailing_empty in collect_header_with_trailing(path, section_like):
            if exclude.search(line_stripped) or len(line_stripped) > 28:
                continue
            # 라인을 canonical key로 매핑 (긴 것 우선)
            key = None
            for k in section_order:
                if line_stripped.startswith(k) or line_stripped == k:
                    key = k
                    break
            if key is None:
                continue
            if key not in key_to_trailing:
                key_to_trailing[key] = []
            key_to_trailing[key].append(trailing_empty)
    # key별로 가장 흔한 trailing_empty 개수 → 최소 요구값으로 사용 (과반 이상이 만족하는 값)
    section_headers_with_trailing: list[dict] = []
    for k in section_order:
        if k not in key_to_trailing:
            continue
        counts = key_to_trailing[k]
        if not counts:
            continue
        # 최소 2빈줄 이상인 비율이 높으면 그걸 요구값으로 (표 행은 0빈줄)
        sorted_n = sorted(set(counts), reverse=True)
        min_empty = 2
        for n in sorted_n:
            if n >= 2 and sum(1 for c in counts if c >= n) >= n_files // 2:
                min_empty = n
                break
            if n >= 1 and sum(1 for c in counts if c >= n) >= n_files // 2:
                min_empty = max(min_empty, 1)
        section_headers_with_trailing.append({
            "text": k,
            "trailing_min_empty_lines": min_empty,
        })
    # 기존 단순 문자열 리스트도 유지 (하위 호환)
    section_headers_plain = [h["text"] for h in section_headers_with_trailing]

    out_path = base_dir.parent / "common_headers.json"
    out_data = {
        "source": str(base_dir),
        "num_files": n_files,
        "min_occurrence": min_occur,
        "headers": [h["text"] for h in header_candidates],
        "headers_with_count": header_candidates,
        "section_headers": section_headers_plain,
        "section_headers_with_trailing": section_headers_with_trailing,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, ensure_ascii=False, indent=2)

    print(f"분석: {n_files}개 파일, 등장 {min_occur}회 이상")
    print(f"저장: {out_path}")
    print("\n[섹션 구분용 헤더 + 뒤 빈 줄 최소 개수 (헤더와 뒤 줄넘김까지 하나의 패턴)]")
    for h in out_data["section_headers_with_trailing"]:
        print(f"  text={h['text']!r}  trailing_min_empty_lines={h['trailing_min_empty_lines']}")
    print("\n[전체 헤더 후보 상위 20개]")
    for h in out_data["headers"][:20]:
        print(f"  {h}")


if __name__ == "__main__":
    main()
