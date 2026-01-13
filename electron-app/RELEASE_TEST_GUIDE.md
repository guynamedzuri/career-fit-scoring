# 자동 업데이트 테스트 가이드 (1.0.2)

## 전체 프로세스

### 1단계: 코드 변경

임의로 주석 한 줄 추가/수정:

```typescript
// electron-app/src/App.tsx 또는 아무 파일
// 예시: App.tsx 파일 상단에 주석 추가
// Version 1.0.2 - 자동 업데이트 테스트
```

### 2단계: 버전 번호 업데이트

`electron-app/package.json` 파일 수정:

```json
{
  "version": "1.0.2"  // 1.0.1 → 1.0.2로 변경
}
```

### 3단계: Git 커밋 및 푸시

```bash
cd electron-app
git add -A
git commit -m "버전 1.0.2 업데이트: 자동 업데이트 테스트"
git push
```

### 4단계: 빌드

```bash
# Windows PowerShell에서
npm run build:win:complete
```

또는 단계별로:

```bash
# 1. 정리 (선택사항)
npm run clean

# 2. 빌드
npm run build:win:publish

# 3. latest.yml 생성
npm run generate-latest
```

빌드 완료 후 `dist-installer` 폴더 확인:
- ✅ `이력서 적합도 평가 시스템 Setup 1.0.2.exe`
- ✅ `latest.yml`

### 5단계: GitHub Release 생성

1. **GitHub 저장소로 이동**
   - https://github.com/guynamedzuri/career-fit-scoring
   - **Releases** 클릭

2. **"Create a new release" 클릭**

3. **릴리스 정보 입력**:
   - **Choose a tag**: `v1.0.2` (새로 생성)
   - **Release title**: `v1.0.2 - 자동 업데이트 테스트`
   - **Description**:
     ```
     ## 변경사항
     - 자동 업데이트 기능 테스트
     - 버전 1.0.2로 업데이트
     ```

4. **파일 업로드**:
   - "Attach binaries" 섹션에서 다음 2개 파일 드래그 앤 드롭:
     - `dist-installer/이력서 적합도 평가 시스템 Setup 1.0.2.exe`
     - `dist-installer/latest.yml`

5. **"Publish release" 클릭**

### 6단계: 테스트

#### 방법 1: 실제 앱에서 테스트

1. **1.0.1 버전 앱 실행** (이전에 설치한 버전)
2. **앱이 자동으로 업데이트 확인**
   - 콘솔에 `[AutoUpdater] Checking for update...` 로그 확인
3. **업데이트 발견 시**:
   - 백그라운드에서 자동 다운로드 시작
   - 다운로드 완료 후 대화상자 표시
4. **"지금 재시작" 클릭**
5. **앱이 재시작되며 1.0.2 버전으로 업데이트됨**

#### 방법 2: 개발자 도구로 확인

앱 실행 후 개발자 도구 콘솔에서:
- `[AutoUpdater] Checking for update...`
- `[AutoUpdater] Update available: 1.0.2`
- `[AutoUpdater] Update downloaded: 1.0.2`

## 빠른 체크리스트

- [ ] 코드 변경 (주석 한 줄)
- [ ] `package.json` 버전 1.0.2로 업데이트
- [ ] Git 커밋 및 푸시
- [ ] `npm run build:win:complete` 실행
- [ ] `dist-installer` 폴더에 `.exe`와 `latest.yml` 확인
- [ ] GitHub Release 생성 (태그: `v1.0.2`)
- [ ] `.exe`와 `latest.yml` 파일 업로드
- [ ] 1.0.1 버전 앱 실행하여 업데이트 확인

## 문제 해결

### 업데이트가 감지되지 않는 경우

1. **버전 번호 확인**:
   - `package.json`: `"version": "1.0.2"`
   - Release 태그: `v1.0.2`

2. **latest.yml 확인**:
   - GitHub Release에 업로드되었는지 확인
   - 파일 내용에 버전이 `1.0.2`인지 확인

3. **앱 재시작**:
   - 앱을 완전히 종료 후 다시 실행

4. **네트워크 확인**:
   - 인터넷 연결 상태 확인
   - GitHub에 접근 가능한지 확인

### 업데이트 다운로드 실패

- 개발자 도구 콘솔에서 에러 메시지 확인
- `[AutoUpdater] Error:` 로그 확인

## 예상 결과

### 성공 시:
1. 앱 실행 시 자동으로 업데이트 확인
2. 새 버전(1.0.2) 발견
3. 백그라운드에서 다운로드 시작
4. 다운로드 완료 후 대화상자 표시
5. "지금 재시작" 클릭 시 앱이 1.0.2로 업데이트됨

### 실패 시:
- 콘솔에 에러 메시지 표시
- 위의 "문제 해결" 섹션 참고

## 참고

- 첫 업데이트 체크는 앱 시작 시 자동으로 실행됩니다
- 이후 5분마다 자동으로 확인합니다
- 개발 환경에서는 자동 업데이트가 비활성화되어 있습니다
