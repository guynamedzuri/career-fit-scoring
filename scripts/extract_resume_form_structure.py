#!/usr/bin/env python3
"""
이력서 양식(DOCX)에서 모든 테이블과 셀을 추출하여 위치 정보를 출력하는 스크립트

사용법:
    python3 scripts/extract_resume_form_structure.py resume_form.docx
"""

import sys
import json
import os
from pathlib import Path
from io import BytesIO

try:
    from docx import Document
    from docx.table import Table
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.oxml.ns import qn
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


def extract_images_from_cell(cell) -> list:
    """
    셀에서 이미지 추출
    
    Args:
        cell: docx Table Cell 객체
        
    Returns:
        list: 이미지 정보 리스트
    """
    images = []
    
    # 방법 1: paragraph의 runs에서 이미지 찾기
    for para in cell.paragraphs:
        for run in para.runs:
            # run.element에서 이미지 찾기
            drawings = run.element.findall('.//a:blip', namespaces={'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'})
            for drawing in drawings:
                embed_id = drawing.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                link_id = drawing.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link')
                if embed_id or link_id:
                    images.append({
                        "embed_id": embed_id,
                        "link_id": link_id,
                        "has_image": True
                    })
    
    # 방법 2: cell.element에서 직접 이미지 찾기 (셀 내부의 모든 이미지)
    cell_drawings = cell.element.findall('.//a:blip', namespaces={'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'})
    found_ids = set()
    for drawing in cell_drawings:
        embed_id = drawing.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        link_id = drawing.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link')
        img_id = embed_id or link_id
        if img_id and img_id not in found_ids:
            found_ids.add(img_id)
            images.append({
                "embed_id": embed_id,
                "link_id": link_id,
                "has_image": True
            })
    
    return images


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
            
            # 셀 내 이미지 추출
            images = extract_images_from_cell(cell)
            
            cell_data = {
                "cell_index": cell_idx,
                "text": cell_text,
                "is_empty": len(cell_text) == 0 and len(images) == 0,
                "has_image": len(images) > 0,
                "image_count": len(images),
                "images": images,
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
                status_parts = []
                if cell["is_empty"]:
                    status_parts.append("빈칸")
                else:
                    if cell["text"]:
                        status_parts.append("텍스트 있음")
                    if cell["has_image"]:
                        status_parts.append(f"이미지 {cell['image_count']}개")
                status = " / ".join(status_parts) if status_parts else "빈칸"
                
                text_preview = cell["text"][:50] + "..." if len(cell["text"]) > 50 else cell["text"]
                
                print(f"    셀 [{row['row_index']}, {cell['cell_index']}]: {status}")
                if cell["text"]:
                    print(f"      텍스트: {text_preview}")
                if cell["has_image"]:
                    print(f"      이미지: {cell['image_count']}개 발견 (embed_id: {cell['images'][0]['embed_id'] if cell['images'] else 'N/A'})")
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
