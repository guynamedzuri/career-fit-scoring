# Git Merge 메시지 편집기 비활성화

## 문제
`git pull` 시 merge commit 메시지를 편집하는 vim이 자동으로 열림

## 해결 방법

### 방법 1: git pull 시 --no-edit 플래그 사용 (권장)

```powershell
git pull --no-edit
```

또는 별칭(alias) 설정:

```powershell
git config --global alias.pull-ne "pull --no-edit"
```

그 다음:
```powershell
git pull-ne
```

### 방법 2: 전역 설정

```powershell
# merge commit 메시지 편집 비활성화
git config --global merge.commit no-edit

# 에디터를 빈 문자열로 설정 (비상용)
git config --global core.editor ""
```

### 방법 3: 환경 변수 설정

PowerShell 프로필에 추가:

```powershell
# PowerShell 프로필 열기
notepad $PROFILE

# 다음 내용 추가
$env:GIT_EDITOR = ""

# 또는
$env:GIT_MERGE_AUTOEDIT = "no"
```

### 방법 4: 현재 vim이 열렸을 때 빠르게 종료

vim이 열렸을 때:
1. `:wq` 입력 후 Enter (저장하고 종료)
2. 또는 `:q!` 입력 후 Enter (저장하지 않고 종료)

### 방법 5: Git 별칭으로 간편하게

```powershell
# pull-ne 별칭 추가
git config --global alias.pull-ne "pull --no-edit"

# 사용
git pull-ne
```

## 확인

설정 확인:
```powershell
git config --global --get merge.commit
git config --global --get core.editor
```

## 참고

- `--no-edit` 플래그는 merge commit 메시지를 편집하지 않고 기본 메시지를 사용
- `core.editor ""`는 모든 git 편집 작업에서 에디터를 열지 않음 (주의 필요)
