# pdf_resume 폴더로 이력서 PDF 보내기 (scp)

## 1. 준비

- **기존 `pdf_resume` 내용**은 이미 삭제된 상태입니다. 빈 폴더만 있습니다.
- **Linux 쪽 경로**:  
  `~/dev/app/main/ats-system/career-fit-scoring/pdf_resume`  
  (또는 `/home/zuri/dev/app/main/ats-system/career-fit-scoring/pdf_resume`)

---

## 2. Windows에서 scp로 보내기

Windows **PowerShell** 또는 **명령 프롬프트**에서 실행하세요.

### (1) 이력서 모음집 **안의 파일만** `pdf_resume`에 넣는 경우 (권장)

`이력서 모음집` 폴더 **안의 파일·하위폴더**만 Linux의 `pdf_resume` 안으로 복사합니다.

```powershell
scp -r "D:\1. 2025년 노경지원팀 업무\1. 총무업무\260102 이력서 AI 분석\이력서 모음집\*" zuri@<Linux호스트>:~/dev/app/main/ats-system/career-fit-scoring/pdf_resume/
```

- `<Linux호스트>`: Linux PC의 **IP 주소** 또는 **호스트 이름**  
  예: `192.168.0.10` 또는 `mylinux`
- `zuri`: Linux 로그인 계정. 본인 계정이 다르면 그 이름으로 바꾸세요.

### (2) 폴더 통째로 보낸 뒤 이름만 `pdf_resume`로 쓰는 경우

`이력서 모음집` 폴더 자체를 프로젝트 안으로 보냅니다.

```powershell
scp -r "D:\1. 2025년 노경지원팀 업무\1. 총무업무\260102 이력서 AI 분석\이력서 모음집" zuri@<Linux호스트>:~/dev/app/main/ats-system/career-fit-scoring/
```

Linux 쪽에서 접속한 뒤, 기존 빈 `pdf_resume`를 지우고 받은 폴더 이름을 바꿉니다.

```bash
cd ~/dev/app/main/ats-system/career-fit-scoring
rmdir pdf_resume
mv "이력서 모음집" pdf_resume
```

---

## 3. 참고

- **비밀번호**: 위 명령 실행 시 Linux 계정 비밀번호를 물어봅니다. SSH 키를 쓰면 생략 가능합니다.
- **한글/공백 경로**: Windows 경로는 반드시 **큰따옴표**로 감싸세요.
- **400장 이상**: 한 번에 보내면 꽤 걸릴 수 있습니다. 중간에 끊기면 같은 명령을 다시 실행해도 됩니다 (이미 있는 파일은 덮어쓰기).
- **Linux 호스트 확인**:  
  Linux에서 `hostname -I` 또는 `ip addr` 로 IP를 확인할 수 있습니다.
