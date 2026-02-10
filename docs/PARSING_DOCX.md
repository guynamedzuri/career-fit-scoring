# DOCX 이력서 파싱 방법

다른 AI 에이전트/개발자가 DOCX 이력서 파싱 방식을 참고할 수 있도록 정리한 문서입니다.

---

## 전체 흐름

1. **Python**: DOCX 파일에서 **테이블 구조**만 추출 (모든 테이블·행·셀의 텍스트 + 위치).
2. **TypeScript**: 추출된 테이블 데이터를 **매핑 설정**에 따라 basicInfo/경력/학력/자격 등으로 해석해 `applicationData`·`resumeText` 생성.

즉, **DOCX는 “셀 위치 기반”**으로 파싱하고, **PDF는 “텍스트 + 정규/섹션”**으로 파싱한다는 점이 다릅니다.

---

## 1단계: 테이블 추출 (Python)

### 스크립트

- **경로**: `scripts/extract_resume_form_structure.py`
- **의존성**: `python-docx`  
  - 설치: `pip install python-docx`

### 동작

- **라이브러리**: `python-docx`로 DOCX를 열고, `doc.element.body`를 순회하며 `CT_Tbl`(테이블)만 찾습니다.
- **테이블 순서**: 문서에 등장하는 순서대로 테이블 인덱스 0, 1, 2, … 부여.
- **셀 내용**: 각 셀에 대해 `paragraphs`의 `text`를 `\n`으로 이어붙여 하나의 문자열로 반환.
- **추가**: 셀 내 이미지 존재 여부 등 메타도 추출 (증명사진 등).

### 실행

```bash
python3 scripts/extract_resume_form_structure.py <docx_path>
```

- **출력**: stdout에 JSON 한 덩어리.
- **형식**:
  - `tables`: 배열. 각 요소는 `table_index`, `row_count`, `rows`.
  - `rows[]`: `row_index`, `cell_count`, `cells[]`.
  - `cells[]`: `cell_index`, `text`, `position: { table_index, row_index, cell_index }` 등.

---

## 2단계: 테이블 → applicationData (TypeScript)

### 진입점

- **모듈**: `src/docxParser.ts` — Python 스크립트 호출 + JSON 파싱.
- **매핑**: `src/resumeMapping.ts` — “어느 테이블·행·열이 이름/경력/학력인지” 정의.

### docxParser.ts

- **함수**: `extractTablesFromDocx(filePath): Promise<RawTableData[]>`
- **동작**:
  1. `extract_resume_form_structure.py`를 **자식 프로세스**로 실행하고 stdout에서 JSON 수신.
  2. JSON을 `RawTableData[]` 형태로 변환:  
     `tables[].rows[].cells[]` → `text`, `rowIndex`, `cellIndex`.
- **유틸**:
  - `getCellValue(tables, tableIndex, rowIndex, cellIndex)` — 셀 텍스트 반환.
  - `findRowByText(tables, tableIndex, searchText, searchCellIndex)` — 특정 텍스트가 있는 행 인덱스.
  - `findColumnByText(tables, tableIndex, searchText, searchRowIndex)` — 특정 텍스트가 있는 열 인덱스.

Python 경로는 Electron/개발 환경에 따라 여러 후보를 순서대로 시도하고, 먼저 존재하는 경로를 사용합니다.

### resumeMapping.ts

- **설정**: `ResumeMappingConfig` (또는 `DEFAULT_RESUME_MAPPING`)에 다음이 정의됨.
  - **basicInfo**: 테이블 인덱스 + 이름/생년월일/이메일/주소/연락처/희망연봉/증명사진/병역 등 **셀 위치** (rowIndex, cellIndex 또는 searchRow/searchCol).
  - **careers**: 테이블 인덱스, 헤더 행, 데이터 시작 행, 회사명/시작일/종료일/직무 등 **열 인덱스** (또는 searchText로 열 찾기).
  - **education**: 학교명/졸업구분/전공/학점 등 열 매핑.
  - **certificates** / **languageTests** / **awards** / **overseasTraining**: 각각 테이블 인덱스와 열/행 범위.
  - **selfIntroduction**: 테이블 인덱스 + 답안 셀 위치 배열.
  - **careerDetails**: 경력기술 상세용 테이블·블록(헤더/데이터/상세 행)과 열 인덱스.

- **역할**: `extractTablesFromDocx()`로 받은 `RawTableData[]`와 위 설정을 이용해, **테이블/행/열 위치만 보고** 값을 읽어 `applicationData`(및 `resumeText` 등)를 채웁니다.

이력서 양식(resume_form.docx)이 바뀌면 **매핑 설정만 수정**하면 되고, 파싱 로직 자체는 테이블 추출 + 셀 위치 읽기로 통일되어 있습니다.

---

## DOCX 파싱 요약

| 항목 | 내용 |
|------|------|
| **입력** | DOCX 파일 경로 |
| **1단계** | Python `extract_resume_form_structure.py` → 문서 전체 테이블·셀 텍스트 + 위치를 JSON으로 출력 |
| **2단계** | TS `docxParser.extractTablesFromDocx()` → JSON을 `RawTableData[]`로 변환 |
| **3단계** | TS `resumeMapping` → `RawTableData[]` + 매핑 설정으로 basicInfo/경력/학력/자격/자기소개 등 채움 |
| **양식 변경 시** | `resumeMapping.ts`의 테이블 인덱스·행·열 매핑만 수정 |

---

## 참고 파일

- `scripts/extract_resume_form_structure.py` — DOCX 테이블 추출 (python-docx)
- `src/docxParser.ts` — Python 호출, RawTableData 변환, getCellValue / findRowByText / findColumnByText
- `src/resumeMapping.ts` — 테이블 셀 위치 → applicationData 매핑 설정 및 변환 로직
- `resume_form_structure.json` — (있을 경우) 이력서 양식 구조 분석 결과 예시
