# 빌드 파일 크기 최적화 가이드

## 현재 상황

Electron 앱의 설치 파일이 443MB로 매우 큽니다.

## Electron 앱이 무거운 이유

1. **Electron 런타임 자체가 큼** (~100-150MB)
   - Chromium 브라우저 엔진
   - Node.js 런타임
   - 필수 라이브러리들

2. **node_modules 포함** (~200-300MB)
   - 모든 의존성 패키지
   - 개발 도구들
   - 불필요한 파일들

3. **애플리케이션 코드 및 리소스**

## 최적화 방법

### 1. 이미 적용된 최적화

- ✅ `asar: true` - 파일을 아카이브로 압축
- ✅ `compression: maximum` - 최대 압축
- ✅ 불필요한 파일 제외 설정

### 2. 추가 최적화 옵션

#### A. node_modules 최소화

불필요한 패키지 제거:

```bash
# 사용하지 않는 패키지 확인
npm ls --depth=0

# 불필요한 패키지 제거
npm uninstall [패키지명]
```

#### B. 프로덕션 의존성만 포함

`package.json`에서 `devDependencies`는 빌드에 포함되지 않지만, 확인:

```json
{
  "dependencies": {
    // 프로덕션에 필요한 패키지만
  },
  "devDependencies": {
    // 개발 도구들은 여기에
  }
}
```

#### C. 파일 제외 최적화

`electron-builder.yml`의 `files` 섹션에서:
- ✅ TypeScript 소스 파일 제외 (`.ts`, `.tsx`)
- ✅ 소스맵 제외 (`.map`)
- ✅ 문서 파일 제외 (`.md`, `.txt`)
- ✅ 테스트 파일 제외

### 3. 예상 크기

최적화 후 예상 크기:
- **최적화 전**: ~443MB
- **최적화 후**: ~200-250MB (예상)

여전히 크지만 Electron 앱의 특성상 어느 정도 큰 것은 정상입니다.

## 파일 크기 확인 방법

### Windows PowerShell:

```powershell
# dist-installer 폴더의 파일 크기 확인
Get-ChildItem dist-installer -Recurse | 
  Where-Object {!$_.PSIsContainer} | 
  Sort-Object Length -Descending | 
  Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}} | 
  Format-Table -AutoSize
```

### 탐색기에서:

1. `dist-installer` 폴더 열기
2. 파일 우클릭 → 속성
3. 크기 확인

## 추가 최적화 (고급)

### 1. Electron 버전 확인

최신 버전이 더 최적화되어 있을 수 있습니다:

```bash
npm list electron
```

### 2. 의존성 분석

큰 패키지 확인:

```bash
# node_modules 크기 확인 (Linux/Mac)
du -sh node_modules/* | sort -h

# Windows에서는 탐색기에서 확인
```

### 3. 코드 스플리팅

큰 라이브러리를 동적 import로 변경 (고급)

## 참고

### 일반적인 Electron 앱 크기

- **최소**: ~100-150MB (매우 간단한 앱)
- **일반**: ~200-300MB (중간 규모 앱)
- **큼**: ~400-500MB (복잡한 앱)
- **매우 큼**: 500MB+ (대규모 앱)

현재 443MB는 복잡한 앱 수준이지만, 최적화 후 200-250MB로 줄일 수 있을 것으로 예상됩니다.

## 결론

1. ✅ 현재 설정으로 최적화 적용됨
2. 🔄 다시 빌드하여 크기 확인
3. 📦 여전히 크다면 node_modules 최소화 고려

**참고**: Electron 앱은 기본적으로 크지만, 사용자 경험에는 큰 영향이 없습니다 (한 번만 다운로드).
