# Career Fit Scoring Electron App

Electron 기반 데스크톱 애플리케이션으로, DOCX 이력서 파일들을 분석하여 채용 공고와의 적합도를 점수화합니다.

## 설치

```bash
# 1. 루트 모듈 빌드
cd ..
npm install
npm run build

# 2. Electron 앱 의존성 설치
cd electron-app
npm install
```

## 개발 모드 실행

```bash
npm run dev
```

이 명령은:
1. Electron 메인 프로세스 파일을 빌드합니다 (`electron/main.ts` → `electron/main.js`)
2. Vite 개발 서버를 `http://localhost:5173`에서 시작합니다
3. Electron 앱을 실행하여 개발 서버에 연결합니다

## 빌드

### Electron 메인 프로세스만 빌드

```bash
npm run build:electron:dev
```

### 전체 빌드 (프론트엔드 + Electron)

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

## 문제 해결

### "package.json has a valid 'main' entry" 오류

이 오류는 Electron 메인 프로세스 파일이 빌드되지 않았을 때 발생합니다:

```bash
# Electron 파일 빌드
npm run build:electron:dev
```

### 모듈을 찾을 수 없다는 오류

```bash
# 루트 모듈 재빌드
cd ..
npm run build
cd electron-app
```

### Electron이 실행되지 않음

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```
