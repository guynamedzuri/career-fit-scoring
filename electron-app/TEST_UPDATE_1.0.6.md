# 자동 업데이트 테스트 가이드 (1.0.5 → 1.0.6)

## 테스트 목적

1.0.5 앱을 설치한 후, 1.0.6을 Release하고 1.0.5 앱이 자동으로 업데이트를 감지하는지 확인

## 단계별 가이드

### 1단계: 1.0.5 빌드 및 설치

#### 빌드
```powershell
cd "D:\1. 2025년 노경지원팀 업무\1. 총무업무\260102 이력서 AI 분석\career-fit-scoring\electron-app"
npm run build:win:complete
```

#### 설치
1. `dist-installer/이력서 적합도 평가 시스템 Setup 1.0.5.exe` 실행
2. 설치 완료
3. **앱을 실행하지 마세요** (아직)

### 2단계: 1.0.6 버전 업데이트

버전을 1.0.6으로 변경 (이미 완료됨)

### 3단계: 1.0.6 빌드

```powershell
npm run build:win:complete
```

빌드 완료 후 확인:
- `dist-installer/이력서 적합도 평가 시스템 Setup 1.0.6.exe`
- `dist-installer/latest.yml`

### 4단계: 1.0.6 GitHub Release 생성

1. GitHub 저장소 → Releases → "Create a new release"
2. **Tag**: `v1.0.6` (v 접두사 포함)
3. **Title**: `v1.0.6 - 자동 업데이트 테스트`
4. **Description**: 
   ```
   ## 변경사항
   - 자동 업데이트 테스트
   - 로그 파일 저장 기능 추가
   ```
5. **파일 업로드** (2개):
   - `Setup.1.0.6.exe` (또는 빌드된 실제 파일 이름)
   - `latest.yml`
6. **"Publish release"** 클릭

### 5단계: 1.0.5 앱 실행 및 테스트

1. **1.0.5 앱 실행**
2. **2초 후 에러 메시지 확인** (있다면)
3. **업데이트 알림 확인**:
   - "업데이트 발견" 대화상자 표시 여부
   - "업데이트 준비 완료" 대화상자 표시 여부

### 6단계: 로그 파일 확인

에러가 발생하거나 업데이트가 감지되지 않으면:

**로그 파일 위치**:
```
C:\Users\[사용자명]\AppData\Roaming\이력서 적합도 평가 시스템\logs\app.log
```

**PowerShell에서 확인**:
```powershell
Get-Content "$env:APPDATA\이력서 적합도 평가 시스템\logs\app.log" | Select-Object -Last 50
```

**확인할 내용**:
- `[AutoUpdater] Current app version: 1.0.5`
- `[AutoUpdater] Starting update check...`
- `[AutoUpdater] Checking for update...`
- `[AutoUpdater] Update available: 1.0.6` 또는 에러 메시지

## 예상 결과

### 성공 시:
1. 앱 실행 후 2초 내에 "업데이트 발견" 알림 표시
2. 백그라운드에서 다운로드 시작
3. 다운로드 완료 후 "업데이트 준비 완료" 대화상자 표시
4. "지금 재시작" 클릭 시 1.0.6으로 업데이트

### 실패 시:
1. 에러 대화상자 표시 (2초 후)
2. 로그 파일 경로 표시
3. 로그 파일에서 에러 원인 확인

## 체크리스트

- [ ] 1.0.5 빌드 완료
- [ ] 1.0.5 설치 완료
- [ ] 1.0.6 버전 업데이트 완료
- [ ] 1.0.6 빌드 완료
- [ ] GitHub Release 생성 (태그: v1.0.6)
- [ ] Setup.1.0.6.exe 업로드
- [ ] latest.yml 업로드
- [ ] 1.0.5 앱 실행
- [ ] 업데이트 알림 확인
- [ ] 로그 파일 확인 (필요시)
