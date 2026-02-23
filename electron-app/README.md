# Career Fit Scoring Electron App

Electron 기반 데스크톱 애플리케이션으로, DOCX·PDF 이력서를 파싱한 뒤 Azure OpenAI로 적합도·등급·근거를 평가합니다. 직종·자격 목록은 커리어넷·Q-Net API로 조회합니다.

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

- **폴더 선택**: DOCX 또는 PDF 이력서 폴더 선택
- **채용 설정**: 직종(커리어넷 API), 필수/우대·자격증(Q-Net 목록), 등급별 조건, 점수 가중치
- **AI 평가**: Azure OpenAI로 경력 적합도·요구사항 만족도·등급별 판정·근거
- **결과**: 테이블 정렬/필터, 상세 패널, 엑셀 내보내기

## 기술 스택

- Electron
- React
- TypeScript
- Vite
- career-fit-scoring (파싱·매핑·자격증 파싱, 알고리즘 점수·API 클라이언트)

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
