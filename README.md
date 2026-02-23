# Career Fit Scoring System

**DOCX** 및 **PDF** 이력서를 파싱하고 **Azure OpenAI**로 지원자 적합도를 평가하는 Electron 데스크톱 앱입니다. 채용 공고 조건에 맞춰 이력서를 일괄 분석·등급 판정·근거를 제공합니다.

## 프로젝트 개요

**Electron 기반 데스크톱 애플리케이션**으로, 로컬 폴더의 이력서 파일을 일괄 파싱한 뒤 **AI 기반 평가**를 수행합니다. 결과 화면의 종합 점수·등급·만족도는 모두 AI 분석 결과를 사용하며, Core 모듈은 이력서 파싱·데이터 매핑·자격증 파싱 및 (선택) 알고리즘 점수·API 클라이언트를 제공합니다.

### 주요 특징

- **AI 기반 평가**: Azure OpenAI로 경력 적합도, 필수/우대/자격증 만족도, 등급별 판정·근거 평가 (앱의 메인 평가 방식)
- **이력서 파싱**: DOCX·PDF에서 구조화 데이터 추출 (PDF는 pdftotext 사용, 임베디드 Python 우선)
- **병렬 처리**: 파싱 최대 4개 동시, AI 분석 최대 3개 동시
- **진행률·ETA**: 파싱/AI 단계별 진행률 및 예상 남은 시간 표시
- **채용 설정 UI**: 직종·필수/우대·자격증·등급별 조건·점수 가중치 설정, 저장/불러오기
- **직종·자격 목록**: 채용 설정 시 직종/자격증 목록을 커리어넷·Q-Net API로 조회 (메인 프로세스에서 호출, 비상 시 로컬 백업 사용)
- **인증서 기반 API 키**: 앱 실행 시 회사 인증서(.enc) 지정·검증 후 API 키 로드
- **결과·엑셀**: 테이블 정렬/필터, 상세 패널(증명사진, AI 코멘트), 선택 후보 엑셀 내보내기
- **자동 업데이트**: electron-updater 지원
- **프롬프트 미리보기**: 설정·결과 화면에서 AI에 전달되는 System/User 프롬프트 확인

## 시스템 구성

### 1. Core Module (`career-fit-scoring`)
이력서 파싱·매핑·자격증 파싱 및 (선택) 알고리즘 점수·외부 API 클라이언트

- **이력서 파싱**: DOCX 테이블 추출, PDF는 외부 스크립트(pdftotext 등) 연동
- **데이터 매핑**: 파싱 결과를 채용/AI 입력 형식으로 매핑
- **자격증 파싱**: 공식·추가 국가자격증 목록 파싱
- **알고리즘 점수** (라이브러리/참고용): 자격증 10점, 경력 20점, 학력 20점 기준의 점수 계산·총점 가중 평균 (앱 결과 화면에서는 미사용, AI 평가 사용)
- **API 클라이언트**: 커리어넷(직종/학과/직종 상세), Q-Net(자격증 목록) — 앱은 메인 프로세스에서 직접 HTTP 호출하여 직종/자격 목록만 사용

### 2. Electron Application (`electron-app`)
데스크톱 애플리케이션

- **이력서 파일 파싱**: DOCX·PDF에서 구조화된 데이터 추출 (PDF는 **pdftotext** 사용, 임베디드 Python 우선)
- **채용 공고 설정**: 직종, 필수/우대 사항, 자격증, 등급별 조건, 점수 가중치 설정
- **배치 처리**: 여러 이력서 파일을 파싱·AI 분석 병렬 처리
- **진행 모달**: 파싱 단계·AI 단계별 진행률 및 동시 처리 수 표시 (예: "이력서 파싱 중 (최대 4개 동시)", "AI 분석 중 (최대 3개 동시)")
- **AI 분석**: Azure OpenAI를 통한 경력 적합도·요구사항 만족도·등급별 판정(gradeEvaluations) 및 근거
- **결과 시각화**: 테이블·정렬·필터, 상세 패널(증명사진, 리스트 스타일, 기간 표시, AI 등급별 판정·근거)
- **프롬프트 미리보기**: 설정 화면 footer·결과 화면 헤더에서 AI에 전달되는 System/User 프롬프트 전문 확인

## 설치 및 실행

### 사전 요구사항

- Node.js 18 이상
- Python 3.x (DOCX·PDF 파싱용, 임베디드 Python 사용 시 별도 설치 불필요)
- Windows/macOS/Linux

### 설치

```bash
# 1. 루트 모듈 빌드
npm install
npm run build

# 2. Electron 앱 의존성 설치
cd electron-app
npm install
```

### 개발 모드 실행

```bash
cd electron-app
npm run dev
```

이 명령은:
1. Python 가상환경 설정 및 의존성 확인
2. Core 모듈 빌드
3. Electron 메인 프로세스 파일 빌드
4. Vite 개발 서버 시작 (`http://localhost:5173`)
5. 스플래시 스크린 표시
6. Electron 앱 실행

### 프로덕션 빌드

#### Windows

```bash
cd electron-app

# Installer 빌드
npm run build:win:installer

# Patcher 빌드 (자동 업데이트용, poppler-windows 포함)
npm run build:win:patcher

# 둘 다 빌드
npm run build:win:both
```

#### macOS / Linux

```bash
cd electron-app

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### PDF 이력서 파싱 (임베디드 파이썬)

PDF 모드에서는 **임베디드 파이썬**(`python-embed`)을 우선 사용합니다. PDF 텍스트 추출은 **pdftotext(poppler)**만 사용합니다. (이전 fallback 엔진 pdfminer.six/PyMuPDF는 제거됨)

#### Windows 설치본: Poppler 번들 포함

배포용 Windows 설치 프로그램에는 **Poppler 바이너리(bin 폴더)**가 포함됩니다. Patcher 빌드(`electron-builder-patch.yml`)에도 poppler-windows가 포함되며, 최종 사용자는 Poppler를 따로 설치하거나 PATH를 수정할 필요가 없습니다.

#### Windows Installer 빌드 시 Poppler 포함하기

Installer 빌드 전에 프로젝트 루트에 Poppler Windows 바이너리를 두면 빌드 시 `resources/poppler-windows/bin`으로 복사됩니다.

1. [poppler-windows 릴리스](https://github.com/oschwartz10612/poppler-windows/releases)에서 ZIP 다운로드
2. 압축 해제 후 `Library` 폴더를 프로젝트 루트에 **poppler-windows**로 복사 (예: `poppler-windows/bin` 경로가 되도록)
3. `electron-app`에서 `npm run build:win:installer` 실행

Poppler를 번들하지 않으려면 `electron-app/electron-builder.yml`의 `extraResources`에서 `poppler-windows` 블록을 제거하거나 주석 처리하면 됩니다. 그 경우 설치본에서는 pdfminer.six 또는 PyMuPDF(pip 설치)에 의존합니다.

#### pdftotext 없을 때

PDF 파싱은 **pdftotext(poppler)**만 사용합니다. Windows에서는 빌드 시 poppler-windows를 포함할 수 있으며, 포함하지 않으면 사용자 환경에 poppler(pdftotext) 설치가 필요합니다.

## 주요 기능

### 1. 채용 공고 설정 (Job Config)

- **직종 선택**: 커리어넷 API를 통한 직종 검색 및 선택
- **업무 내용 입력**: 상세 업무 내용 및 요구사항 작성
- **필수/우대 사항 설정**: 필수 요구사항 및 우대 사항 입력
- **필수 자격증 추가**: 자격증 검색 및 필수 자격증 설정
- **등급별 조건 설정**: 상/중/하 3단계 등급별 판정 기준 입력
- **점수 가중치 설정**: 자격증/경력/학력/우대사항 점수 비중 조정
- **설정 저장/불러오기**: 채용 공고 설정을 JSON 파일로 저장 및 불러오기
- **프롬프트 미리보기**: 설정 화면 footer의 "프롬프트 미리보기" 버튼으로 현재 폼 입력값 기준 System/User 프롬프트 전문 확인 (빈 칸은 가이드용 플레이스홀더, 실제 AI 호출에는 미사용)

### 2. 이력서 분석

- **문서 형식 선택**: DOCX 또는 PDF 이력서 모드 선택
- **폴더 선택**: 해당 형식의 이력서 파일이 있는 폴더 선택
- **병렬 파싱**: 이력서 파일에서 기본 정보, 경력, 학력, 자격증, GPA, 증명사진(PDF 시) 등 추출 (최대 4개 동시)
- **병렬 AI 분석**: Azure OpenAI를 통한 경력 적합도·요구사항 만족도·등급별 판정 및 근거 평가 (최대 3개 동시)
- **진행 모달**: 파싱 단계·AI 단계별 진행률 및 동시 처리 수 표시

### 3. 결과 확인

- **테이블 뷰**: 모든 지원자의 점수·증명사진·평가 결과를 테이블로 표시
- **정렬 기능**: 이름, 나이, 거주지, 경력 적합도, 필수/우대사항 만족여부, 자격증 만족여부 등으로 정렬
- **필터링**: 거주지, 상태(대기/검토/불합격)로 필터링
- **상세 정보**: 각 지원자의 상세 정보 확인
  - 기본 정보 (이름, 나이, 주소, 직전 회사, 증명사진 등)
  - 추출된 데이터 (자격증, 경력, 학력, GPA, 대학원 등) — 리스트 항목은 구분자 줄바꿈·기간 스타일 적용
  - AI 평가 리포트 (등급, 요약, 등급별 판정·근거, 강점, 약점, 의견, 세부 평가)
- **프롬프트 보기**: 결과 화면 헤더의 "프롬프트 보기" 버튼으로 실제 이력서 데이터가 반영된 System/User 프롬프트 전문 확인
- **파일 열기**: 원본 DOCX/PDF 파일 직접 열기

### 4. AI 평가 항목

- **등급**: 상/중/하 3단계 (채용 공고의 등급별 조건에 따른 판정, A=상/B=중/C=하)
- **등급별 판정 및 근거**: 각 등급 조건 만족 여부(satisfied)와 구체적 근거(reason) — AI Comment에 표시
- **경력 적합도**: ◎/○/X/- (◎=매우 적합, ○=적합, X=부적합, -=경력 없음)
- **필수사항 만족여부**: ◎ (만족), X (불만족)
- **우대사항 만족여부**: ◎ (매우 만족), ○ (만족), X (불만족)
- **자격증 만족여부**: ◎ (매우 만족), ○ (만족), X (불만족) — 자격증 평가 가이드(상위 자격으로 하위 인정, 하위 자격으로 상위 미인정 등) 적용
- **종합 점수**: AI 등급·필수/우대/자격 만족도 기반 가중치 계산 (필수사항 불만족 시 "필수사항 불만족" 표시)

## 점수 체계 (Core 모듈 참고)

앱 결과 화면의 **종합 점수는 AI 평가 결과**를 사용합니다. 아래는 **Core 모듈**에 구현된 알고리즘 점수 체계로, 라이브러리로 사용하거나 참고할 때 활용합니다.

### 자격증 점수 (10점 만점)
- **필수 자격증**: 없음 시 5점, 1개 시 1개 일치 5점, 2개 이상 시 2개 이상 일치 5점 / 1개 일치 3점
- **관련 자격증**: 3개 이상 3점, 2개 2점, 1개 1점
- **자격증 개수**: 7개 이상 2점, 4개 이상 1점

### 경력 점수 (20점 만점)
- **관련 직종** (10점): jobdicSeq 일치 10점, aptd_type_code 일치 5점
- **경력 기간** (10점): (최장 경력)/(나이−20) 비율에 따라 80%↑ 10점, 60%↑ 8점, 30%↑ 6점, 0% 초과 3점, 무경력 0점

### 학력 점수 (20점 만점)
- **학력** (5점): 고졸 1점, 대졸 3점, 석·박 5점
- **관련 학과** (10점): MAJOR_NM 일치 10점, MAJOR_SEQ만 일치 7점
- **학점** (5점): 88%↑ 5점, 66%↑ 2점

## 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하여 API 키를 설정합니다 (참고: `.env.example`):

```bash
# Azure OpenAI (AI 분석용)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# 커리어넷 API (선택사항, 기본값 사용 가능)
CAREERNET_API_KEY=your_api_key

# Q-Net API (선택사항, 기본값 사용 가능)
QNET_API_KEY=your_api_key
```

## 기술 스택

### Core Module
- TypeScript, Node.js
- 이력서 파싱(DOCX), 데이터 매핑, 자격증 파싱
- (선택) 알고리즘 점수, 커리어넷/Q-Net API 클라이언트

### Electron Application
- Electron 28
- React 18
- TypeScript
- Vite
- Azure OpenAI API
- Python (DOCX·PDF 파싱, 임베디드 Python 우선)

## 프로젝트 구조

```
career-fit-scoring/
├── src/                    # Core 모듈 소스 코드
│   ├── api/                # API 연동 (커리어넷, Q-Net)
│   ├── docxParser.ts       # DOCX 파싱
│   ├── resumeMapping.ts    # 이력서 데이터 매핑
│   └── scoring.ts          # 점수 계산 알고리즘
├── electron-app/           # Electron 애플리케이션
│   ├── electron/           # Electron 메인 프로세스 (main.ts, preload.ts)
│   ├── src/                # React 애플리케이션
│   │   ├── components/     # React 컴포넌트 (JobConfigForm, ResultView, LoadingSpinner 등)
│   │   └── styles/        # CSS 스타일
│   └── scripts/            # 빌드·Poppler 검증 스크립트
├── scripts/                # 유틸리티 스크립트 (parse_pdf_resume.py, list_pdf_images.py 등)
├── python-embed/           # 임베디드 Python (DOCX·PDF 파싱 시 우선 사용)
└── docs/                   # PDF 관련 등 부가 문서
```

## 사용 예제

### Core Module 사용 (라이브러리)

앱은 평가에 AI 결과를 사용하므로, 아래 알고리즘 점수는 라이브러리·배치 스크립트 등에서 활용할 때 참고하세요.

```typescript
import { calculateAllScores, mapResumeDataToApplicationData } from 'career-fit-scoring';

// 이력서 파싱 결과를 applicationData 형식으로 매핑한 뒤
const applicationData = { ... }; // 또는 mapResumeDataToApplicationData(parsed)
const jobMetadata = {
  jobdicSeq: '12345',
  requiredCertifications: ['정보처리기사'],
  scoringWeights: { certification: 1, career: 2, education: 1 }
};

const scores = calculateAllScores(applicationData, { aiMetadata: jobMetadata });
// scores: { certificationScore, careerScore, educationScore, totalScore }
```

## 개발 로드맵

### ✅ 완료된 기능
- [x] 점수 계산 알고리즘 구현
- [x] 커리어넷 API 연동
- [x] Q-Net API 연동
- [x] DOCX 파일 파싱
- [x] PDF 이력서 파싱 (pdftotext, 임베디드 Python 우선)
- [x] PDF 증명사진 추출(100×140) 및 UI·캐시 표시
- [x] PDF 학력 GPA 추출 및 표시
- [x] 이력서 데이터 매핑
- [x] Electron 앱 기본 구조
- [x] 채용 공고 설정 UI (등급별 조건, 저장/불러오기)
- [x] 이력서 분석 및 결과 표시 (병렬 파싱·AI 분석)
- [x] 진행 모달 phase·동시 처리 수 표시
- [x] AI 기반 평가 (등급, 등급별 판정·근거, 요약, 강점/약점, 의견)
- [x] AI 프롬프트 미리보기 (설정 화면·결과 화면)
- [x] 자동 업데이트 기능
- [x] 스플래시 스크린
- [x] 상세 패널 UI 개선 (리스트 스타일, 기간 표시)
- [x] Patcher 빌드에 poppler-windows 포함

### 🔄 향후 개선 예정
- [ ] 다양한 이력서 형식 지원 확대
- [ ] AI 프롬프트 최적화
- [ ] 성능 최적화
- [ ] 다국어 지원

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 참고 문서

- [EXAMPLES.md](./EXAMPLES.md) - 상세 사용 예제 및 데이터 구조
- [CHANGELOG.md](./CHANGELOG.md) - 변경 이력
- [RESUME_FORM_MAPPING_GUIDE.md](./RESUME_FORM_MAPPING_GUIDE.md) - 이력서 형식 매핑 가이드
- [RESUME_MAPPING_UPDATE.md](./RESUME_MAPPING_UPDATE.md) - 이력서 매핑 업데이트
- [electron-app/README.md](./electron-app/README.md) - Electron 앱 상세 문서
- [docs/](./docs/) - PDF 업로드·비교 등 부가 문서
