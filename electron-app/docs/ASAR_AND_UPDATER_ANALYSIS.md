# ASAR와 electron-updater 관계 분석

## 요약

- **asar: true**일 때 앱 코드는 `app.asar` 한 파일 안에 들어가고, **electron-updater**를 그 안에서 쓰려다 보니 로드 실패·경로 문제가 났고, 그걸 피하려고 **asar: false**로 둔 상태입니다.
- 기술적으로는 asar를 켜고 **asarUnpack**으로 electron-updater만 풀어주면 둘 다 사용 가능합니다.

---

## 1. ASAR가 뭔지

- **ASAR** = Electron 앱을 하나의 아카이브 파일(`app.asar`)로 묶는 방식.
- 패키징만 할 뿐 **암호화는 아님**. `npx asar extract app.asar ./out` 하면 내용이 그대로 나옴.
- `asar: true`이면:
  - `resources/app.asar` 한 파일에 앱 코드 + `node_modules` 등이 들어감.
  - 실행 시 Node/Electron이 이 아카이브를 가상 디렉터리처럼 읽음.

---

## 2. electron-updater가 asar와 충돌할 수 있는 이유

### 2.1 모듈이 “실제 파일 시스템”을 기대하는 경우

- **require()** 는 asar 안에서도 동작함. 그래서 `require('electron-updater')` 자체는 asar 안에만 있어도 될 수 있음.
- 하지만:
  - 모듈이나 그 **하위 의존성**이 `fs.readFileSync(path.join(__dirname, '...'))` 처럼 **__dirname 기준으로 파일을 읽으면**, `__dirname`이 asar 내부 경로라서 일부 환경에서 실패할 수 있음.
  - **네이티브 모듈(.node)** 은 asar 안에서 로드되지 않음. (electron-updater 자체는 순수 JS라 해당 없음.)
- electron-builder 문서에는 “unpack이 필요한 모듈은 자동 감지된다”고 되어 있지만, 예전에는 **electron-updater**를 수동으로 unpack 대상으로 넣는 경우가 많았음.

### 2.2 asarUnpack과 빌드 결과 구조

- **asarUnpack** 은 “asar에 넣지 말고, 실제 폴더로 풀어둘 파일”을 지정하는 옵션.
- 예: `asarUnpack: ["**/node_modules/electron-updater/**/*"]`  
  → 빌드 결과에 `resources/app.asar.unpacked/node_modules/electron-updater/` 가 생김.
- 이렇게 되면:
  - electron-updater는 **실제 디스크 경로**에 있음.
  - 메인 프로세스에서 `require('electron-updater')` 할 때 Node가 **app.asar.unpacked** 쪽을 찾아가서 로드함.

과거 이 프로젝트에서 겪은 문제(문서·코드 기준)는 대략 다음 둘 중 하나 또는 둘 다로 보입니다.

1. **asarUnpack을 넣었는데도 `app.asar.unpacked`가 생성되지 않음**  
   - 패턴 불일치, electron-builder 버전/설정 이슈 등으로 unpack이 실제로 적용되지 않음.  
   → “electron-updater를 unpacked에서 써야 하는데, unpacked가 없어서” 로드 실패.
2. **asarUnpack을 아예 안 씀**  
   - electron-updater가 asar 안에만 있고, 본문이나 의존성이 asar 안 경로에서 `fs` 등을 쓰다 실패.  
   → “asar 안에서는 동작하지 않아서” 로드 실패.

어느 쪽이든 “**패키징된 앱에서만** electron-updater 로드가 안 된다”는 현상이었고, 그래서 **가장 확실한 회피책**으로 asar 자체를 끈 것(asar: false)으로 보입니다.

---

## 3. electron-updater 쪽에서 asar와 엮이는 코드

- **NsisUpdater.js**  
  - `path.join(process.resourcesPath, "elevate.exe")` 로 **resources** 디렉터리의 실행 파일을 실행.  
  - resources는 asar 밖이므로 여기만 보면 asar와 직접 충돌하진 않음.
- **ElectronAppAdapter.js**  
  - `path.join(process.resourcesPath, "app-update.yml")` 등 **resources** 경로 사용.  
  - 역시 asar 밖.
- **기타**  
  - 캐시 디렉터리, 다운로드한 설치 파일 경로 등은 사용자/임시 디렉터리라 asar와 무관.

즉, **실행 시 사용하는 경로**는 대부분 asar 밖이라서, “한번 로드만 되면” asar와 충돌할 부분은 많지 않음.  
문제는 **로드 시점**에 asar 안에 있으면 실패할 수 있다는 점입니다.

---

## 4. 현재 프로젝트의 대응 (main.ts의 loadElectronUpdater)

- `loadElectronUpdater()` 에서:
  - `require('electron-updater')` 시도
  - 실패하면 **app.asar**, **app.asar.unpacked**, **process.resourcesPath** 등 여러 경로를 넣어 가며 직접 경로로 require 시도
  - `app.asar.unpacked` 가 없을 때 로그에 “asarUnpack may not be working” 이라 찍도록 되어 있음.

이걸 넣은 이유는, **asar 사용 시** “어디에 electron-updater가 올라갔는지 불확실하고, 그래도 되도록 여러 경로를 시도해 보자”는 전략입니다.  
그래도 불안정해서 결국 **asar: false** 로 바꾸고, “항상 resources/app/ 아래 일반 폴더”로 두면 require가 안정적으로 되게 한 상태입니다.

---

## 5. 정리: updater와 asar의 관계

| 구분 | 내용 |
|------|------|
| **구조적 관계** | asar를 켜면 앱 코드가 app.asar 안에 들어가고, electron-updater도 그 안에 포함될 수 있음. 이때 로드/경로 이슈가 나서 “updater가 asar랑 안 맞는다”고 느껴짐. |
| **실제 원인 후보** | (1) asarUnpack 미설정 또는 패턴/빌드 문제로 unpack이 안 됨. (2) asar 안에서만 있을 때, 모듈/의존성의 `__dirname`·`fs` 사용이 asar 가상 파일시스템과 맞지 않아 로드 실패. |
| **asar: false로 한 이유** | 위와 같은 디버깅을 줄이고, “항상 디스크에 풀린 구조”로 두어 require와 경로가 개발 환경과 같게 동작하게 하기 위함. |
| **앞으로 asar를 다시 켜려면** | asar: true 로 되돌리고, **asarUnpack** 에 `**/node_modules/electron-updater/**/*` (필요 시 의존성 포함)을 명시한 뒤, 빌드 결과에 `app.asar.unpacked/node_modules/electron-updater` 가 생성되는지 확인하면 됨. |

즉, **updater “자체”가 asar와 이론상 양립 불가인 건 아니고**,  
“asar + (unpack 설정 누락/실패)” 조합에서 **로드나 경로가 깨졌던 것**이었고,  
그걸 피하기 위해 **일단 asar를 끈 것**이라고 보면 됩니다.

---

## 6. 적용 상태 (asar 재활성화)

다음 설정으로 asar를 다시 켜 두었음.

- **electron-builder.yml / electron-builder-patch.yml**
  - `asar: true`
  - `asarUnpack`:
    - `node_modules/electron-updater/**/*`
    - `node_modules/builder-util-runtime/**/*` (electron-updater 의존성, 경로/fs 사용 가능성 대비)

### 빌드 후 확인

1. **빌드 로그**  
   패키징 단계에서 다음 메시지가 나오는지 확인:
   ```
   unpacking  path=resources/app.asar.unpacked/node_modules/electron-updater
   unpacking  path=resources/app.asar.unpacked/node_modules/builder-util-runtime
   ```

2. **디렉터리 구조**  
   `dist-installer/win-unpacked/resources/` 아래에 다음이 있는지 확인:
   - `app.asar`
   - `app.asar.unpacked/node_modules/electron-updater/` (예: `package.json` 존재)
   - `app.asar.unpacked/node_modules/builder-util-runtime/`

3. **실행 후 로그**  
   앱 실행 시 `[AutoUpdater] electron-updater loaded successfully` 로그가 나오면 정상.

이후에도 로드 실패가 나오면 `loadElectronUpdater()` 의 fallback 로그를 보고, 실제로 어떤 경로에서 require가 시도·실패했는지 확인하면 됨.
