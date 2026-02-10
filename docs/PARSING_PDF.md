# PDF 이력서 파싱 방법

다른 AI 에이전트/개발자가 PDF 이력서 파싱 방식을 참고할 수 있도록 정리한 문서입니다.

---

## ⚠️ 필수: 텍스트 추출은 pdftotext 사용

**PDF에서 텍스트를 꺼낼 때는 반드시 `pdftotext`(poppler)를 사용해야 합니다.**

- **이유**: 레이아웃·줄/단 구분이 가장 안정적이고, 사람인 이력서 PDF와의 호환성이 검증되어 있음.
- **권장 옵션**: `pdftotext -layout -enc UTF-8 <pdf_path> -`
- **폴백**: pdftotext를 쓸 수 없을 때만 `pdfminer.six` → `PyMuPDF` 순으로 시도. (코드 상 추출 우선순위: **pdftotext → pdfminer.six → PyMuPDF**)

---

## 전체 흐름 (3단계)

| 단계 | 담당 | 설명 |
|------|------|------|
| **1단계** | Python | PDF → raw 텍스트 추출 (**pdftotext 우선 사용**) |
| **2단계** | Python | raw 텍스트를 섹션으로 나누고, 블록별로 basicInfo/경력/학력/자격 등 파싱 |
| **3단계** | Electron/TS | 파싱 결과를 DOCX와 동일한 `applicationData`·`resumeText` 형태로 재매핑 |

---

## 1단계: 텍스트 추출

- **스크립트**: `scripts/parse_pdf_resume.py`
- **함수**: `extract_text_with_layout(pdf_path, pdftotext_exe?)`
- **동작**:
  1. **pdftotext** 실행: `pdftotext -layout -enc UTF-8 <pdf_path> -` (실패 시 다음으로)
  2. **pdfminer.six**: `extract_text(..., laparams=LAParams(...))` (실패 시 다음으로)
  3. **PyMuPDF**: `page.get_text("text")` 로 페이지별 텍스트 이어붙임
- **반환**: `(추출된_문자열, 엔진명)` — 엔진명은 `'pdftotext'` | `'pdfminer'` | `'pymupdf'`

**다른 에이전트에서 구현할 때**: 1단계만 쓴다면 **pdftotext만 사용**하도록 하고, 없을 때만 예외 처리하는 것을 권장합니다.

---

## 2단계: 섹션 분할 및 블록 파싱

### 2-1. 섹션 나누기

- **방식 2가지**
  1. **공통 헤더 기반** (`use_corpus_headers=True`): `pdf_resume/common_headers.json`의 `section_headers_with_trailing` 사용.  
     - "경력 총", "학력", "학력 고등학교 졸업", "자격/어학/수상", "자기소개서" 등으로 구간 시작을 찾음.
  2. **연속 빈 줄 기반** (기본): 연속 빈 줄 3개 이상을 섹션 경계로 보고 블록 분리 후, 각 블록을 `_identify_section_name(block)`으로 분류.

- **섹션명 예**: `header`, `career_summary`, `career_detail_content`, `education_header`, `certifications`, `employment_preference`, `skills`, `self_introduction`, `portfolio` 등.

### 2-2. 블록별 파싱 함수

| 섹션 | 함수 | 설명 |
|------|------|------|
| 상단 | `parse_header_block(block)` | 이름, 성별, 생년, 나이, 이메일, 휴대폰, 주소, 지원분야, 입사지원일, 경력총, 희망연봉, 직전연봉, 거주지 |
| 경력 요약 표 | `parse_summary_table_from_career_block(block)` | 경력 총 N년 N개월, 희망연봉, 직전 연봉 |
| 경력 | `parse_career_entries(block)` | `YYYY.MM ~ 재직중/YYYY.MM` + 회사·직무(· 구분), N개월, 연봉, 근무지역, 퇴사사유 |
| 학력 | `parse_education_entries(block)` | `YYYY.MM ~ YYYY.MM` + 학교, 졸업/재학/휴학, 전공, 학점(3.46/4.5). 날짜 없이 "고등학교 졸업"만 있어도 폴백 파싱 |
| 자격/어학/수상 | `parse_certification_entries(block)` | `YYYY.MM` + 자격명 + 등급/시행처 |
| 취업우대 | `parse_employment_preference(block)` | 병역 등 |
| 포트폴리오 | `parse_portfolio(block)` | 첨부 파일명(.pdf, .docx 등) |

---

## 실행 방법

```bash
# 기본 (pdftotext 사용, 없으면 pdfminer → pymupdf)
python3 scripts/parse_pdf_resume.py <pdf_path>

# pdftotext 실행 파일 경로 지정 (Windows 등)
python3 scripts/parse_pdf_resume.py --pdftotext /path/to/pdftotext.exe <pdf_path>

# 디버그: 1·2단계 중간 결과 저장
python3 scripts/parse_pdf_resume.py --debug-dir ./debug <pdf_path>

# 공통 헤더로 구간 구분 (사람인 양식 권장)
python3 scripts/parse_pdf_resume.py --use-corpus-headers <pdf_path>
```

- **의존성**: pdftotext(poppler) / pdfminer.six / PyMuPDF 중 하나 필요.  
- **권장**: **poppler(pdftotext) 설치 후 pdftotext로만 추출**하는 것을 전제로 두고 사용하는 것이 좋습니다.

---

## 출력 구조 (2단계 결과)

`parse_pdf_resume()` 반환 dict 예:

- `basicInfo`: 이름, 생년, 나이, 이메일, 휴대폰, 주소, 거주지, totalCareer, desiredSalary, lastSalary 등
- `skills`: 문자열 배열
- `careers`: `{ startDate, endDate, companyNameAndDepartment, role, duration, description, salary, region, leaveReason }[]`
- `education`: `{ startDate, endDate, school, degree, major, gpa }[]`
- `certifications`: `{ date, name, grade, issuer }[]`
- `employmentPreference`: 병역 등
- `selfIntroduction`: 문자열
- `careerDetailContent`: (있을 경우) 경력기술서 본문
- `profilePhotoFilename`: (photo_dir 지정 시) 추출한 증명사진 파일명

3단계에서 이 구조를 Electron 쪽에서 DOCX와 동일한 `applicationData`·`resumeText` 형태로 다시 매핑합니다.

---

## 참고 파일

- `scripts/parse_pdf_resume.py` — 1·2단계 전체 구현
- `pdf_resume/common_headers.json` — 헤더 기반 섹션 분할용 (section_headers, section_headers_with_trailing)
