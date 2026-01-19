#!/usr/bin/env python3
"""
이력서 양식(DOCX)에서 모든 테이블과 셀을 추출하여 위치 정보를 출력하는 스크립트

사용법:
    python3 scripts/extract_resume_form_structure.py resume_form.docx
"""

import sys
import json
from pathlib import Path

try:
    from docx import Document
    from docx.table import Table
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
except ImportError:
    print("ERROR: python-docx 라이브러리가 필요합니다.")
    print("설치 방법: pip3 install python-docx")
    sys.exit(1)


def extract_table_structure(doc_path: str) -> dict:
    """
    DOCX 파일에서 모든 테이블과 셀의 구조를 추출
    
    Returns:
        dict: 테이블 구조 정보
    """
    doc = Document(doc_path)
    
    result = {
        "file_path": doc_path,
        "total_tables": 0,
        "tables": []
    }
    
    # 문서의 모든 요소를 순회하면서 테이블 찾기
    table_index = 0
    
    for element in doc.element.body:
        if isinstance(element, CT_Tbl):
            table = Table(element, doc)
            table_data = extract_table_data(table, table_index)
            result["tables"].append(table_data)
            table_index += 1
    
    result["total_tables"] = table_index
    
    return result


def extract_table_data(table: Table, table_index: int) -> dict:
    """
    테이블에서 모든 행과 셀 데이터 추출
    
    Args:
        table: docx Table 객체
        table_index: 테이블 인덱스
        
    Returns:
        dict: 테이블 데이터
    """
    table_data = {
        "table_index": table_index,
        "row_count": len(table.rows),
        "rows": []
    }
    
    for row_idx, row in enumerate(table.rows):
        row_data = {
            "row_index": row_idx,
            "cell_count": len(row.cells),
            "cells": []
        }
        
        for cell_idx, cell in enumerate(row.cells):
            # 셀의 모든 텍스트 추출 (여러 단락이 있을 수 있음)
            cell_text = "\n".join([para.text for para in cell.paragraphs])
            cell_text = cell_text.strip()
            
            cell_data = {
                "cell_index": cell_idx,
                "text": cell_text,
                "is_empty": len(cell_text) == 0,
                "position": {
                    "table_index": table_index,
                    "row_index": row_idx,
                    "cell_index": cell_idx
                }
            }
            
            row_data["cells"].append(cell_data)
        
        table_data["rows"].append(row_data)
    
    return table_data


def print_structure_summary(structure: dict):
    """
    구조 정보를 읽기 쉬운 형식으로 출력
    """
    print("=" * 80)
    print(f"이력서 양식 구조 분석: {structure['file_path']}")
    print("=" * 80)
    print(f"\n총 테이블 개수: {structure['total_tables']}\n")
    
    for table in structure["tables"]:
        print(f"\n{'=' * 80}")
        print(f"테이블 {table['table_index']} (총 {table['row_count']}행)")
        print(f"{'=' * 80}")
        
        for row in table["rows"]:
            print(f"\n  행 {row['row_index']} (총 {row['cell_count']}개 셀):")
            
            for cell in row["cells"]:
                status = "빈칸" if cell["is_empty"] else "내용 있음"
                text_preview = cell["text"][:50] + "..." if len(cell["text"]) > 50 else cell["text"]
                
                print(f"    셀 [{row['row_index']}, {cell['cell_index']}]: {status}")
                if cell["text"]:
                    print(f"      내용: {text_preview}")
                print(f"      위치: 테이블{cell['position']['table_index']}, 행{cell['position']['row_index']}, 열{cell['position']['cell_index']}")


def print_mapping_template(structure: dict):
    """
    매핑 설정을 위한 템플릿 출력
    """
    print("\n\n" + "=" * 80)
    print("매핑 설정 템플릿 (resumeMapping.ts용)")
    print("=" * 80)
    print("\n다음 형식으로 각 칸에 어떤 데이터가 들어가야 하는지 알려주세요:\n")
    
    for table in structure["tables"]:
        print(f"\n// 테이블 {table['table_index']}")
        
        # 헤더 행 찾기 (첫 번째 행이 보통 헤더)
        if table["rows"]:
            header_row = table["rows"][0]
            print(f"// 헤더 행 {header_row['row_index']}:")
            for cell in header_row["cells"]:
                if cell["text"]:
                    print(f"//   열 {cell['cell_index']}: '{cell['text']}'")
        
        # 데이터 행들
        if len(table["rows"]) > 1:
            print(f"// 데이터 행: {table['rows'][1]['row_index']} ~ {table['rows'][-1]['row_index']}")
            print(f"// 각 행의 셀 내용:")
            for row in table["rows"][1:]:  # 헤더 제외
                print(f"//   행 {row['row_index']}:")
                for cell in row["cells"]:
                    print(f"//     열 {cell['cell_index']}: '{cell['text']}' (빈칸일 수 있음)")


def save_json_output(structure: dict, output_path: str = "resume_form_structure.json"):
    """
    구조 정보를 JSON 파일로 저장
    """
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structure, f, ensure_ascii=False, indent=2)
    print(f"\n\n구조 정보가 {output_path}에 저장되었습니다.")


def main():
    if len(sys.argv) < 2:
        print("사용법: python3 scripts/extract_resume_form_structure.py <docx_file>")
        print("예시: python3 scripts/extract_resume_form_structure.py resume_form.docx")
        sys.exit(1)
    
    docx_path = sys.argv[1]
    
    if not Path(docx_path).exists():
        print(f"ERROR: 파일을 찾을 수 없습니다: {docx_path}")
        sys.exit(1)
    
    try:
        # 구조 추출
        structure = extract_table_structure(docx_path)
        
        # 출력
        print_structure_summary(structure)
        print_mapping_template(structure)
        
        # JSON 저장
        save_json_output(structure)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
