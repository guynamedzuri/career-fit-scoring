# Career Fit Scoring Electron App

Electron 기반 데스크톱 애플리케이션으로, DOCX 이력서 파일들을 분석하여 채용 공고와의 적합도를 점수화합니다.

## 설치

```bash
npm install
```

## 개발

```bash
npm run dev
```

이 명령은 Vite 개발 서버와 Electron을 동시에 실행합니다.

## 빌드

```bash
npm run build
```

## 주요 기능

- **폴더 선택**: DOCX 이력서 파일들이 있는 폴더 선택
- **채용 직종 선택**: 커리어넷 API를 통한 직종 검색 및 선택
- **필수 자격증 추가**: 자격증 검색 및 필수 자격증 설정
- **평가 점수 비중 설정**: 자격증/경력/학력 점수 비중 조정

## 기술 스택

- Electron
- React
- TypeScript
- Vite
- career-fit-scoring (알고리즘 모듈)
