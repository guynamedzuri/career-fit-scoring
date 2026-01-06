# 빠른 시작 가이드

## 1단계: 루트 모듈 빌드

```bash
# 프로젝트 루트에서
cd /home/zuri/dev/app/main/ats-system/career-fit-scoring
npm install
npm run build
```

## 2단계: Electron 앱 설치 및 실행

```bash
# electron-app 디렉토리로 이동
cd electron-app
npm install

# 개발 모드 실행
npm run dev
```

## 실행 순서 요약

```bash
# 전체 프로세스
cd /home/zuri/dev/app/main/ats-system/career-fit-scoring
npm install && npm run build
cd electron-app
npm install
npm run dev
```

## 예상 결과

실행이 성공하면:
1. 터미널에 Vite 개발 서버가 시작됩니다 (`http://localhost:5173`)
2. Electron 창이 자동으로 열립니다
3. "이력서 적합도 평가 시스템" 앱이 표시됩니다

## 주요 기능 테스트

1. **폴더 선택**: "폴더 선택" 버튼 클릭 → DOCX 파일이 있는 폴더 선택
2. **채용 직종 선택**: "직업명을 입력하세요" 입력란에 검색어 입력 (예: "소프트웨어")
3. **필수 자격증 추가**: "자격증명을 검색하세요" 입력란에 검색어 입력
4. **평가 점수 비중 설정**: 자격증/경력/학력 비중 숫자 입력

## 문제 해결

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

### 포트가 이미 사용 중

`vite.config.ts`에서 포트를 변경하거나, 사용 중인 프로세스를 종료하세요.
