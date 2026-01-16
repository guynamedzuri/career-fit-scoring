; NSIS 설치 스크립트 커스터마이징
; 바로가기 아이콘을 명시적으로 설정

; 설치 완료 후 바로가기 아이콘 강제 설정
Function .onInstSuccess
  ; 바탕화면 바로가기 아이콘 강제 설정
  ; PowerShell을 사용하여 바로가기 아이콘 변경
  ; 실행 파일의 아이콘을 바로가기에 적용
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath(\"Desktop\"); $ShortcutPath = Join-Path $Desktop \"이력서 적합도 평가 시스템.lnk\"; if (Test-Path $ShortcutPath) { $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.IconLocation = \"$INSTDIR\이력서 적합도 평가 시스템.exe,0\"; $Shortcut.Save(); Write-Host \"Desktop shortcut icon updated\" }"'
  
  ; 시작 메뉴 바로가기 아이콘도 설정
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $StartMenu = Join-Path ([Environment]::GetFolderPath(\"StartMenu\")) \"Programs\"; $ShortcutPath = Join-Path $StartMenu \"이력서 적합도 평가 시스템.lnk\"; if (Test-Path $ShortcutPath) { $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.IconLocation = \"$INSTDIR\이력서 적합도 평가 시스템.exe,0\"; $Shortcut.Save(); Write-Host \"Start menu shortcut icon updated\" }"'
FunctionEnd
