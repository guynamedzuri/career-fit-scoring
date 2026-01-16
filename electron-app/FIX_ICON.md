# Windows 아이콘 적용 문제 해결 가이드

## 문제: 아이콘이 기본 Electron 아이콘으로 표시됨

## 해결 방법

### 1. 빌드 캐시 클리어

```bash
npm run clean
rm -rf dist-installer
rm -rf node_modules/.cache
```

### 2. 아이콘 파일 확인

아이콘 파일이 올바른 형식인지 확인:
- Windows `.ico` 파일은 여러 크기(16x16, 32x32, 48x48, 256x256)를 포함해야 함
- 파일이 `electron-app/icon.ico`에 있어야 함

### 3. 빌드 로그 확인

빌드 시 다음 메시지 확인:
```
• default Electron icon is used  reason=application icon is not set
```

이 메시지가 나오면 아이콘을 찾지 못한 것입니다.

### 4. 경로 확인

`electron-builder.yml`에서:
- `buildResources: .` (electron-app 디렉토리)
- `icon: icon.ico` (buildResources 기준 상대 경로)

### 5. 절대 경로로 시도 (필요시)

```yaml
win:
  icon: ${process.cwd()}/icon.ico
```

또는:

```yaml
win:
  icon: ./icon.ico
```

### 6. 아이콘 파일 재생성

아이콘이 올바른 형식이 아닐 수 있습니다:
- 온라인 도구로 여러 크기를 포함한 `.ico` 파일 생성
- 또는 `png2icons` 같은 도구 사용

### 7. 빌드 후 확인

빌드된 실행 파일의 아이콘 확인:
```
dist-installer/win-unpacked/이력서 적합도 평가 시스템.exe
```

이 파일을 우클릭 → 속성 → 아이콘 변경에서 확인

### 8. 강제 재빌드

```bash
# 완전히 클린 빌드
npm run clean
rm -rf node_modules/.cache
npm run build:win
```

## 일반적인 원인

1. **빌드 캐시**: 이전 빌드 캐시가 남아있음
2. **아이콘 형식**: 단일 크기만 포함된 .ico 파일
3. **경로 문제**: buildResources 기준 경로가 잘못됨
4. **파일 위치**: icon.ico가 buildResources 디렉토리에 없음

## 확인 사항

- [ ] `icon.ico` 파일이 `electron-app/` 디렉토리에 있음
- [ ] `buildResources: .` 설정이 올바름
- [ ] 빌드 캐시가 클리어됨
- [ ] 아이콘 파일이 여러 크기를 포함함
