# Python Embeddable

이 폴더에는 Python embeddable 버전을 배치해야 합니다.

## 다운로드 방법

1. https://www.python.org/downloads/ 에서 Python embeddable 버전 다운로드
2. Windows x64용: `python-3.x.x-embed-amd64.zip` 다운로드
3. 압축 해제 후 이 폴더에 모든 파일 복사

## 필요한 파일들

- `python.exe`
- `python3xx.dll` (버전에 따라 다름)
- `pythonxx.zip` (표준 라이브러리)
- 기타 DLL 파일들

## scp로 전송하는 방법

Windows에서 Linux 서버로 전송:
```bash
scp -r python-embed user@server:/path/to/career-fit-scoring/
```

또는 Linux에서 Windows로 전송:
```bash
scp -r python-embed user@windows:/path/to/career-fit-scoring/
```

## 주의사항

- Python embeddable은 약 10-20MB 정도의 크기입니다
- `python-docx` 라이브러리가 필요하면 `python-embed` 폴더에 설치해야 합니다

## 설치 방법

**절대 경로로 실행해야 합니다** (PATH의 Python이 아닌 이 폴더의 Python을 사용):

```bash
# Windows
.\python-embed\python.exe -m pip install python-docx

# 또는 python-embed 폴더로 이동
cd python-embed
.\python.exe -m pip install python-docx
```

**주의**: `python.exe`만 입력하면 PATH에 등록된 시스템 Python이 실행됩니다. 반드시 `.\python-embed\python.exe` 또는 절대 경로를 사용하세요.
