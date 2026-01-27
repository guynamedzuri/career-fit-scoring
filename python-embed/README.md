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

## pip 설치 방법

Python embeddable에는 기본적으로 pip가 포함되어 있지 않습니다. 먼저 pip를 설치해야 합니다:

1. **get-pip.py 다운로드**:
   ```bash
   curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
   ```
   또는 브라우저에서 https://bootstrap.pypa.io/get-pip.py 다운로드

2. **pip 설치**:
   ```bash
   .\python-embed\python.exe get-pip.py
   ```

3. **python-docx 설치**:
   ```bash
   .\python-embed\python.exe -m pip install python-docx
   ```

**주의**: 
- `python.exe`만 입력하면 PATH에 등록된 시스템 Python이 실행됩니다. 반드시 `.\python-embed\python.exe` 또는 절대 경로를 사용하세요.
- pip 설치 후 `python-embed` 폴더에 `Scripts` 폴더와 `Lib` 폴더가 생성됩니다.
