# 보안 관련 안내

## 1. 빌드에서 제외되는 파일

- **`.enc` 인증서 파일**: `electron-builder` 설정으로 **app.asar 및 app.asar.unpacked**에 `.enc` 파일이 포함되지 않습니다.  
  (`electron-builder.yml` / `electron-builder-patch.yml`의 `files`에서 `!**/*.enc`로 제외)

## 2. Electron app.asar와 복호화 키 노출

Electron 앱에서는 **메인 프로세스 코드가 exe가 아니라 `app.asar`** 안에 들어갑니다.  
`app.asar`는 일반적인 압축 포맷이라, 풀면 **JavaScript 소스가 평문**으로 보입니다.

그래서 다음이 그대로 노출됩니다.

- 인증서 서명 검증용 상수 (`CERT_SIGNATURE_EXPECTED`)
- 인증서 복호화에 쓰는 키 문자열 (`CERT_ENCRYPT_KEY_STRING`)
- 그 키로 AES-256-CBC 복호화하는 로직

즉, **클라이언트(앱)에 키를 두는 한 완전히 숨기는 것은 불가능**하고,  
누군가 사용자 PC의 `.enc` 파일을 구하고 app.asar를 풀어 동일한 로직을 쓰면 API 키 등을 복원할 수 있습니다.

## 3. 권장 대응 (해킹 난이도 상향)

| 방안 | 설명 |
|------|------|
| **V8 Bytecode (Bytenode)** | `main.js`를 사람이 읽기 어려운 V8 바이트코드로 컴파일해 빌드에 포함. bytenode 라이브러리 활용. |
| **C++ Native Addon (Node-API)** | 복호화 로직과 시크릿 키만 C++로 작성해 `.node`(DLL)로 빌드 후 Electron에서 로드. 리버스 없이는 키 추출이 상대적으로 어렵습니다. |
| **JavaScript 난독화** | `javascript-obfuscator` 등을 빌드 파이프라인에 넣어 변수명·문자열을 꼬아 두기. 완전한 보호는 아니지만 스크립트 읽기 난이도는 올라갑니다. |

위 조합(예: 핵심만 C++ addon + 나머지 Bytenode/난독화)을 적용하면, “exe 바이너리에만 키가 있다”가 아니라 “app.asar 안 평문 JS에 키가 있다”는 한계를 완화할 수 있습니다.
