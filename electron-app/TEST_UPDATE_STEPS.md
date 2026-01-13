# 자동 업데이트 테스트 단계별 가이드

## 중요: 순서대로 진행하세요!

### 1단계: 1.0.5 빌드 및 설치

#### A. 현재 버전 확인
```powershell
# package.json 확인
cat package.json | Select-String "version"
# "version": "1.0.5" 이어야 함
```

#### B. 1.0.5 빌드
```powershell
cd "D:\1. 2025년 노경지원팀 업무\1. 총무업무\260102 이력서 AI 분석\career-fit-scoring\electron-app"
npm run build:win:complete
```

#### C. 1.0.5 설치
1. `dist-installer/이력서 적합도 평가 시스템 Setup 1.0.5.exe` 실행
2. 설치 완료
3. **중요: 아직 앱을 실행하지 마세요!**

---

### 2단계: 1.0.6으로 버전 업데이트

#### A. 버전 변경
```powershell
# package.json에서 "version": "1.0.6"으로 변경
# App.tsx에서 주석도 변경
```

또는 제가 변경해드릴게요. "1.0.6으로 변경해줘"라고 말씀해주세요.

#### B. Git 커밋
```powershell
git add -A
git commit -m "버전 1.0.6 업데이트: 자동 업데이트 테스트"
git push
```

---

### 3단계: 1.0.6 빌드

```powershell
npm run build:win:complete
```

빌드 완료 후 확인:
- `Setup.1.0.6.exe` (또는 빌드된 실제 파일 이름)
- `latest.yml`

---

### 4단계: 1.0.6 GitHub Release 생성

1. GitHub Releases → "Create a new release"
2. **Tag**: `v1.0.6` (v 접두사 포함)
3. **Title**: `v1.0.6 - 자동 업데이트 테스트`
4. **파일 업로드** (2개):
   - `Setup.1.0.6.exe`
   - `latest.yml`
5. **"Publish release"** 클릭

---

### 5단계: 1.0.5 앱 실행 및 테스트

1. **1.0.5 앱 실행**
2. **2초 후 에러 메시지 확인** (있다면)
3. **업데이트 알림 확인**:
   - "업데이트 발견" 대화상자 표시 여부
   - "업데이트 준비 완료" 대화상자 표시 여부

---

### 6단계: 로그 파일 확인 (필요시)

에러가 발생하거나 업데이트가 감지되지 않으면:

```powershell
Get-Content "$env:APPDATA\이력서 적합도 평가 시스템\logs\app.log" | Select-Object -Last 50
```

**로그 파일 위치**:
```
C:\Users\[사용자명]\AppData\Roaming\이력서 적합도 평가 시스템\logs\app.log
```

---

## 체크리스트

- [ ] 1.0.5 버전 확인 (package.json)
- [ ] 1.0.5 빌드 완료
- [ ] 1.0.5 설치 완료
- [ ] 1.0.6으로 버전 업데이트
- [ ] 1.0.6 빌드 완료
- [ ] GitHub Release 생성 (v1.0.6)
- [ ] 1.0.5 앱 실행
- [ ] 업데이트 알림 확인
- [ ] 로그 파일 확인 (필요시)
