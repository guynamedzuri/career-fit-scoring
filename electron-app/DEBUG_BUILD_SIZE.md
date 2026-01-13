# 빌드 파일 크기 디버깅 가이드

## 문제

빌드된 파일이 400MB 이상으로 매우 큽니다.

## 원인 확인 방법

### 1. asar 비활성화로 파일 확인

`electron-builder.yml` 또는 `package.json`에서:

```yaml
asar: false  # 임시로 false로 설정
```

또는 `package.json`:

```json
{
  "build": {
    "asar": false
  }
}
```

빌드 후 `dist-installer/win-unpacked` 폴더를 확인하면 어떤 파일들이 포함되었는지 볼 수 있습니다.

### 2. 포함된 파일 확인

Windows PowerShell에서:

```powershell
# win-unpacked 폴더의 큰 파일들 확인
Get-ChildItem dist-installer\win-unpacked -Recurse -File | 
  Sort-Object Length -Descending | 
  Select-Object -First 20 FullName, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

### 3. 의심되는 파일들

다음 파일/폴더들이 포함되어 있으면 제외해야 합니다:

- `.vscode/` - VS Code 설정
- `.idea/` - IntelliJ/WebStorm 설정
- `.vs/` - Visual Studio 설정
- `tsconfig*.json` - TypeScript 설정
- `*.ts`, `*.tsx` - TypeScript 소스 파일 (이미 컴파일됨)
- `*.map` - 소스맵
- `.editorconfig` - 에디터 설정
- `vite.config.*` - Vite 설정
- `node_modules` 내 불필요한 파일들

## 해결 방법

### electron-builder.yml에 제외 규칙 추가

```yaml
files:
  - electron/**/*
  - dist/**/*
  - package.json
  # 개발 도구 설정 파일 제외
  - "!**/.vscode/**/*"
  - "!**/.idea/**/*"
  - "!**/.vs/**/*"
  - "!**/.editorconfig"
  - "!**/tsconfig*.json"
  # TypeScript 소스 파일 제외
  - "!**/*.ts"
  - "!**/*.tsx"
  # 소스맵 제외
  - "!**/*.map"
  # 기타...
```

### package.json에도 동일하게 적용

`package.json`의 `build.files` 배열에도 동일한 제외 규칙을 추가합니다.

## 확인 후 원상복구

디버깅이 끝나면:

```yaml
asar: true  # 다시 true로 변경 (성능 및 보안)
```

## 예상 효과

적절한 파일 제외 후:
- **제외 전**: ~400-443MB
- **제외 후**: ~150-250MB (예상)

## 체크리스트

빌드 크기 최적화 확인:

- [ ] `asar: false`로 설정하여 포함된 파일 확인
- [ ] `.vscode`, `.idea`, `.vs` 폴더 제외 확인
- [ ] TypeScript 소스 파일 (`.ts`, `.tsx`) 제외 확인
- [ ] 소스맵 (`.map`) 제외 확인
- [ ] 설정 파일 (`tsconfig.json`, `vite.config.*`) 제외 확인
- [ ] `node_modules` 내 불필요한 파일 제외 확인
- [ ] 다시 빌드하여 크기 확인
- [ ] `asar: true`로 원상복구

## 참고

- `asar: false`는 디버깅용으로만 사용
- 프로덕션 빌드는 반드시 `asar: true`로 설정
- `asar`는 파일을 아카이브로 압축하여 성능 향상 및 보안 강화
