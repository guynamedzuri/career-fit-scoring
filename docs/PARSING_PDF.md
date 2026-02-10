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

## 파싱 시 사용하는 정규표현식 (전체)

아래는 `scripts/parse_pdf_resume.py`에서 실제로 사용하는 정규식 전부입니다. 다른 에이전트/구현에서 그대로 가져다 쓸 수 있도록 용도별로 나열했습니다. (Python `re` 기준, 캡처 그룹 번호는 코드와 동일.)

### 섹션 식별 `_identify_section_name(block)`

```python
# 학력 블록: 학교명 + 졸업/재학/중퇴
r"(학교|대학교|대학|고등학교|중학교|초등학교).*(졸업|재학|중퇴)"

# 경력 블록: 날짜 범위
r"\d{4}\.\d{2}\s*~\s*(재직중|\d{4}\.\d{2})"

# 자격증 블록: 자격 키워드 + 합격/취득
r"(기능사|기사|산업기사|자격증|면허|OPIC|TOEIC|TOEFL).*(합격|취득|최종합격)"

# 자기소개서: 앞 200자에 날짜 없음
r"\d{4}\.\d{2}"   # block[:200] 에 대해 검사
```

---

### 기본정보 `parse_header_block(block)`

```python
# 지원분야 (캡처 1: 값)
r"지원분야\s*:\s*([^\s입]+)"

# 입사지원일 (캡처 1: 값, 괄호 포함)
r"입사지원일\s*:\s*([^)]+\))"

# 이름 후보: "XXX 경력" / "XXX 신입" (줄 끝 또는 뒤에 공백)
r"([^\s]+)\s+경력\s*$"
r"([^\s]+)\s+신입\s*$"
r"([^\s]+)\s+경력\s"
r"([^\s]+)\s+신입\s"

# 이름 유효성: 2~4 한글 또는 2~20 영문
r"^[\uac00-\ud7a3]{2,4}$"
r"^[A-Za-z]{2,20}$"

# "남," / "여," 로 시작하는 줄 (생년/나이 줄)
r"^(남|여)\s*,\s*\d{4}"

# 성명     홍길동
r"성명\s+([\uac00-\ud7a3A-Za-z]{2,20})(?:\s|$)"

# 남/여, 1991 (34세) — 캡처: 성별, 연도, 나이
r"(남|여)\s*,\s*(\d{4})\s*\((\d+)세\)"

# 1998 (27세) 만 있는 경우
r"\b(19[5-9]\d|20[0-1]\d)\s*\((\d{1,2})세\)"

# 생년월일 1999년 ...
r"생년월일\s+(\d{4})년"

# 이메일
r"이메일\s+(\S+@\S+)"

# 휴대폰/전화번호 (캡처 1에 대해 공백 제거 후 사용)
r"(?:휴대폰|전화번호)\s+(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})"
# 적용: info["phone"] = re.sub(r"\s+", "", m.group(1))

# 주소: 우편 5자리 또는 3-3 다음 주소문자
r"주소\s+(?:\(?\d{5}\)?|\(\d{3}-\d{3}\))\s*([^\n]+?)(?=\s+경력\s|$)"
# 대체
r"주소\s+([^\n]+)"

# 경력 총 N년 N개월
r"경력\s*총\s*(\d+년\s*\d*개월)"
r"총\s*(\d+년\s*\d*개월)"

# 희망연봉
r"희망연봉\s*[:\s]*([0-9,]+)\s*만원"

# 직전 연봉 (여러 변형)
r"직전\s*연봉\s*:\s*([0-9,]+)\s*만\s*원"
r"직전\s*연봉\s*:\s*([0-9,]+)\s*만원"
r"직전\s*연봉\s*:\s*([^\s원]+만원?)"
```

---

### 경력 요약 표 `parse_summary_table_from_career_block(block)`

```python
r"경력\s*총\s*(\d+년\s*\d*개월)"
r"총\s*(\d+년\s*\d*개월)"        # "경력" 이후 구간에서도 사용
r"희망연봉\s*[:\s]*([0-9,]+)\s*만원"
r"직전\s*연봉\s*:\s*([0-9,]+)\s*만\s*원"
r"직전\s*연봉\s*:\s*([0-9,]+)\s*만원"
```

---

### 경력 항목 `parse_career_entries(block)`

```python
# 컴파일된 패턴 (한 줄 전체: 기간 + 회사·직무)
CAREER_PATTERN = re.compile(
    r"(\d{4}\.\d{2}\s*~\s*(?:재직중|\d{4}\.\d{2}))\s+(.+?)\s+·\s+(.+?)(?:\n|$)",
    re.DOTALL,
)

# 라인 매칭: 기간, 재직중/종료일, 나머지
r"(\d{4}\.\d{2})\s*~\s*(재직중|\d{4}\.\d{2})\s+(.+)"

# 다음 줄이 새 경력 항목인지 확인
r"\d{4}\.\d{2}\s*~\s*(?:재직중|\d{4}\.\d{2})"

# 근무기간: N개월 / N년 N개월
r"^\d+개월$|^\d+년\s*\d*개월$"

# 연봉 / 근무지역 / 퇴사사유
r"연봉\s+([^\s근]+)"
r"근무지역\s+([^\s퇴]+?)(?=\s*퇴사사유|\s*$)"
r"근무지역\s+(\S+)"   # 폴백
r"퇴사사유\s+(.+)"
```

---

### 학력 `parse_education_entries(block)`

```python
# 학점 (슬래시 주변 공백 허용)
GPA_PATTERN = re.compile(r"\d+\.\d+\s*/\s*\d+\.\d+")

# 학력 한 줄: YYYY.MM ~ YYYY.MM + 나머지
r"(\d{4}\.\d{2})\s*~\s*(\d{4}\.\d{2})\s+(.+)"

# 다음 학력 항목 줄인지 확인
r"^\d{4}\.\d{2}\s*~\s*\d{4}\.\d{2}\s+"

# 고등학교/중학교/대학교 등 (폴백 시 학교명 추출용)
r"(고등학교|중학교|초등학교|대학교|대학)"
```

---

### 자격/어학/수상 `parse_certification_entries(block)`

```python
# 줄 정규화: 폼피드·캐리지리턴 제거
re.sub(r"[\f\r]+", " ", raw_line)

# YYYY.MM  자격명  등급/시행처 (날짜+자격명+뒤쪽 3번째 그룹)
r"(\d{4}\.\d{2})\s+(.+?)\s+([^\d].+)$"
# 시행처 구간 분리: 3개 이상 공백 또는 탭
re.split(r"\s{3,}|\t+", issuer_full)

# 날짜 + 자격명만 (경력 형식 아님)
r"(\d{4}\.\d{2})\s+(.+)"
# rest가 " ~ " 포함하거나 다음에 날짜로 시작하면 제외: re.match(r"^\d{4}\.\d{2}", rest)
```

---

### 취업우대 `parse_employment_preference(block)`

```python
# 병역: 상태, 상세(예: 군별/계급), 기간
r"병역\s*:\s*(\S+).*?(\S+/\S+).*?(\d{4}\.\d{2}\s*~\s*\d{4}\.\d{2})"
```

---

### 포트폴리오 `parse_portfolio(block)`

```python
# 3개 이상 공백으로 분리
re.split(r"\s{3,}", line)

# 라벨 제거 (포트폴리오, 자격증, 증명서)
re.sub(r"^(포트폴리오|자격증|증명서)\s*", "", part, flags=re.IGNORECASE)
```

---

### 스킬/자기소개 (parse_pdf_resume 내부)

```python
# "나의 스킬" 헤더 제거
re.sub(r"^나의\s*스킬\s*\n?", "", skills_block, flags=re.MULTILINE)

# 나의 스킬 ~ 경력 총 구간 추출
re.search(r"나의\s*스킬\s*\n(.+?)(?=경력\s*총|\Z)", header_block, re.DOTALL)

# 스킬 텍스트를 2개 이상 공백으로 분할
re.split(r"\s{2,}", skills_text)
```

---

## 참고 파일

- `scripts/parse_pdf_resume.py` — 1·2단계 전체 구현
- `pdf_resume/common_headers.json` — 헤더 기반 섹션 분할용 (section_headers, section_headers_with_trailing)
