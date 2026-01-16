; NSIS 설치 스크립트 커스터마이징
; 바로가기 아이콘을 icon.ico 파일로 명시적으로 설정

; 설치 완료 후 바로가기 아이콘 강제 설정
Function .onInstSuccess
  ; icon.ico 파일 경로
  StrCpy $0 "$INSTDIR\icon.ico"
  
  ; icon.ico가 없으면 실행 파일의 아이콘 사용
  IfFileExists "$0" 0 UseExeIcon
  
  ; icon.ico 파일이 있으면 이를 사용
  ; 바탕화면 바로가기 아이콘 설정
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath(\"Desktop\"); $ShortcutPath = Join-Path $Desktop \"이력서 적합도 평가 시스템.lnk\"; if (Test-Path $ShortcutPath) { $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.IconLocation = \"$INSTDIR\icon.ico\"; $Shortcut.Save(); Write-Host \"Desktop shortcut icon updated to icon.ico\" }"'
  
  ; 시작 메뉴 바로가기 아이콘도 설정
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $StartMenu = Join-Path ([Environment]::GetFolderPath(\"StartMenu\")) \"Programs\"; $ShortcutPath = Join-Path $StartMenu \"이력서 적합도 평가 시스템.lnk\"; if (Test-Path $ShortcutPath) { $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.IconLocation = \"$INSTDIR\icon.ico\"; $Shortcut.Save(); Write-Host \"Start menu shortcut icon updated to icon.ico\" }"'
  Goto End
  
  UseExeIcon:
  ; icon.ico가 없으면 실행 파일의 아이콘 사용
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath(\"Desktop\"); $ShortcutPath = Join-Path $Desktop \"이력서 적합도 평가 시스템.lnk\"; if (Test-Path $ShortcutPath) { $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.IconLocation = \"$INSTDIR\이력서 적합도 평가 시스템.exe,0\"; $Shortcut.Save(); Write-Host \"Desktop shortcut icon updated to exe icon\" }"'
  
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $StartMenu = Join-Path ([Environment]::GetFolderPath(\"StartMenu\")) \"Programs\"; $ShortcutPath = Join-Path $StartMenu \"이력서 적합도 평가 시스템.lnk\"; if (Test-Path $ShortcutPath) { $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.IconLocation = \"$INSTDIR\이력서 적합도 평가 시스템.exe,0\"; $Shortcut.Save(); Write-Host \"Start menu shortcut icon updated to exe icon\" }"'
  
  End:
FunctionEnd
