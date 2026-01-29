# Career Fit Scoring System

커리어넷 API와 AI를 활용한 지원자 적합도 평가 시스템입니다. DOCX 형식의 이력서 파일들을 자동으로 분석하여 채용 공고와의 적합도를 점수화하고 AI 기반 평가를 제공합니다.

## 프로젝트 개요

이 프로젝트는 **Electron 기반 데스크톱 애플리케이션**으로, 로컬 폴더에 저장된 이력서 파일들을 일괄 분석하여 지원자 평가를 지원합니다. 알고리즘 기반 점수 계산과 Azure OpenAI를 활용한 AI 분석을 결합하여 종합적인 평가를 제공합니다.

### 주요 특징

- **로컬 파일 기반**: 인터넷 연결 없이도 작동 가능 (API 호출 제외)
- **DOCX 파싱**: Microsoft Word 이력서 파일 직접 분석 및 데이터 추출
- **알고리즘 기반 평가**: AI 비용 절감을 위한 순수 알고리즘 점수 산출
- **AI 기반 평가**: Azure OpenAI를 활용한 경력 적합도 및 요구사항 만족도 평가
- **커리어넷 API 연동**: 직종, 학과, 자격증 데이터 활용
- **Q-Net API 연동**: 국가자격증 검색 및 검증
- **자동 업데이트**: electron-updater를 통한 자동 업데이트 지원
- **유연한 데이터 매핑**: 다양한 이력서 형식에 대응 가능한 구조

## 시스템 구성

### 1. Core Module (`career-fit-scoring`)
점수 계산 알고리즘 및 API 연동 모듈

- **자격증 점수 계산** (10점 만점)
- **경력 점수 계산** (20점 만점)
- **학력 점수 계산** (20점 만점)
- **총점 계산**: 가중 평균을 통한 최종 적합도 점수 산출
- **커리어넷 API 연동**: 직종 검색, 학과 검색, 직종 상세 정보 조회
- **Q-Net API 연동**: 국가자격증 검색

### 2. Electron Application (`electron-app`)
데스크톱 애플리케이션

- **이력서 파일 파싱**: DOCX 파일에서 구조화된 데이터 추출
- **채용 공고 설정**: 직종, 필수/우대 사항, 자격증, 점수 가중치 설정
- **배치 처리**: 여러 이력서 파일을 한 번에 분석
- **AI 분석**: Azure OpenAI를 통한 경력 적합도 및 요구사항 만족도 평가
- **결과 시각화**: 테이블 형태의 결과 표시 및 정렬/필터링 기능
- **상세 정보**: 각 지원자의 상세 정보 및 AI 평가 리포트 확인

## 설치 및 실행

### 사전 요구사항

- Node.js 18 이상
- Python 3.x (DOCX 파싱용)
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

# Patcher 빌드 (자동 업데이트용)
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

PDF 모드에서는 **임베디드 파이썬**(`python-embed`)을 우선 사용합니다. PDF 텍스트 추출을 위해 **pymupdf**가 필요하므로, **빌드 전에** 아래 명령을 한 번 실행해 두세요.

- **경로**: 프로젝트 루트 `career-fit-scoring` (python-embed 폴더가 있는 위치)
- **명령**:
  - Windows: `python-embed\python.exe -m pip install pymupdf`
  - macOS/Linux: `python-embed/python3 -m pip install pymupdf` (또는 해당 폴더의 python 실행 파일 경로)

이후 `electron-app`에서 빌드하면 `python-embed` 폴더가 그대로 `resources`에 복사되므로, 설치된 pymupdf가 포함된 상태로 배포됩니다.

## 주요 기능

### 1. 채용 공고 설정 (Job Config)

- **직종 선택**: 커리어넷 API를 통한 직종 검색 및 선택
- **업무 내용 입력**: 상세 업무 내용 및 요구사항 작성
- **필수/우대 사항 설정**: 필수 요구사항 및 우대 사항 입력
- **필수 자격증 추가**: 자격증 검색 및 필수 자격증 설정
- **점수 가중치 설정**: 자격증/경력/학력/우대사항 점수 비중 조정
- **설정 저장/불러오기**: 채용 공고 설정을 JSON 파일로 저장 및 불러오기

### 2. 이력서 분석

- **폴더 선택**: DOCX 이력서 파일들이 있는 폴더 선택
- **자동 파싱**: 이력서 파일에서 기본 정보, 경력, 학력, 자격증 등 추출
- **알고리즘 점수 계산**: 추출된 데이터를 기반으로 적합도 점수 산출
- **AI 분석**: Azure OpenAI를 통한 경력 적합도 및 요구사항 만족도 평가
- **진행 상황 표시**: 파싱 및 AI 분석 진행 상황을 프로그레스 바로 표시

### 3. 결과 확인

- **테이블 뷰**: 모든 지원자의 점수 및 평가 결과를 테이블로 표시
- **정렬 기능**: 이름, 나이, 거주지, 경력 적합도, 필수/우대사항 만족여부, 자격증 만족여부 등으로 정렬
- **필터링**: 거주지, 상태(대기/검토/불합격)로 필터링
- **상세 정보**: 각 지원자의 상세 정보 확인
  - 기본 정보 (이름, 나이, 주소, 직전 회사 등)
  - 추출된 데이터 (자격증, 경력, 학력, 자기소개서, 경력기술서 등)
  - AI 평가 리포트 (등급, 요약, 강점, 약점, 의견, 세부 평가)
- **파일 열기**: 원본 DOCX 파일 직접 열기

### 4. AI 평가 항목

- **경력 적합도**: A, B, C, D, E 등급 (A=매우 적합, E=부적합)
- **필수사항 만족여부**: ◎ (만족), X (불만족)
- **우대사항 만족여부**: ◎ (매우 만족), ○ (만족), X (불만족)
- **자격증 만족여부**: ◎ (매우 만족), ○ (만족), X (불만족)
- **종합 점수**: 가중치 기반 계산 (필수사항 불만족 시 "필수사항 불만족" 표시)

## 점수 체계

### 자격증 점수 (10점 만점)
- **필수 자격증**: 없음 시 5점, 1개 시 1개 일치하면 5점, 2개 이상 시 2개 이상 일치하면 5점, 1개 일치하면 3점
- **관련 자격증**: 3개 이상 일치 시 3점, 2개 일치 시 2점, 1개 일치 시 1점
- **자격증 개수**: 7개 이상 시 2점, 4개 이상 시 1점

### 경력 점수 (20점 만점)
- **관련 직종 점수** (10점):
  - 완전 동일 직종 (jobdicSeq 일치): 10점
  - 관련 직종 (aptd_type_code 일치): 5점
- **경력 기간 점수** (10점):
  - 80% 이상: 10점
  - 60% 이상 80% 미만: 8점
  - 30% 이상 60% 미만: 6점
  - 0% 초과 30% 미만: 3점
  - 0% (무경력): 0점

### 학력 점수 (20점 만점)
- **학력 점수** (5점): 고졸 1점, 대졸(전문학사/학사) 3점, 석사/박사 5점
- **관련 학과 점수** (10점): MAJOR_NM 일치 10점, MAJOR_SEQ만 일치 7점
- **학점 점수** (5점): 88% 이상 5점, 66% 이상 88% 미만 2점

## 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하여 API 키를 설정합니다:

```bash
# Azure OpenAI (AI 분석용)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# 커리어넷 API (선택사항, 기본값 사용 가능)
CAREERNET_API_KEY=your_api_key

# Q-Net API (선택사항, 기본값 사용 가능)
QNET_API_KEY=your_api_key
```

## 기술 스택

### Core Module
- TypeScript
- Node.js
- 커리어넷 API
- Q-Net API

### Electron Application
- Electron 28
- React 18
- TypeScript
- Vite
- Azure OpenAI API
- Python (DOCX 파싱)

## 프로젝트 구조

```
career-fit-scoring/
├── src/                    # Core 모듈 소스 코드
│   ├── api/                # API 연동 (커리어넷, Q-Net)
│   ├── docxParser.ts       # DOCX 파싱
│   ├── resumeMapping.ts    # 이력서 데이터 매핑
│   └── scoring.ts          # 점수 계산 알고리즘
├── electron-app/           # Electron 애플리케이션
│   ├── electron/           # Electron 메인 프로세스
│   ├── src/                # React 애플리케이션
│   │   ├── components/     # React 컴포넌트
│   │   └── styles/         # CSS 스타일
│   └── scripts/            # 빌드 스크립트
└── scripts/                 # 유틸리티 스크립트
```

## 사용 예제

### Core Module 사용

```typescript
import { calculateAllScores } from 'career-fit-scoring';

const applicationData = {
  birthDate: '1990-01-01',
  certificateName1: '정보처리기사',
  careerStartDate1: '2020-01-01',
  careerEndDate1: '2024-12-31',
  careerJobTypeCode1: '12345',
  universityDegreeType1: '학사',
  universityMajor1_1: '컴퓨터공학과',
};

const jobMetadata = {
  jobdicSeq: '12345',
  requiredCertifications: ['정보처리기사'],
  scoringWeights: {
    certification: 1,
    career: 2,
    education: 1
  }
};

const scores = calculateAllScores(applicationData, { aiMetadata: jobMetadata });
```

## 개발 로드맵

### ✅ 완료된 기능
- [x] 점수 계산 알고리즘 구현
- [x] 커리어넷 API 연동
- [x] Q-Net API 연동
- [x] DOCX 파일 파싱
- [x] 이력서 데이터 매핑
- [x] Electron 앱 기본 구조
- [x] 채용 공고 설정 UI
- [x] 이력서 분석 및 결과 표시
- [x] AI 기반 평가 기능
- [x] 자동 업데이트 기능
- [x] 스플래시 스크린

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
- [electron-app/README.md](./electron-app/README.md) - Electron 앱 상세 문서
