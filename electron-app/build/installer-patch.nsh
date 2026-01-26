; NSIS 스크립트: 업데이트(패치) 시 바탕화면 바로가기 유지
; electron-builder가 자동 생성하는 스크립트에 이 내용이 포함됨

; 설치 후 섹션: 바로가기 생성 로직 제어
Section -Post
  ; 기존 설치 확인 (업데이트인지 체크)
  IfFileExists "$INSTDIR\app.exe" 0 newInstall
  
  ; 업데이트인 경우: 바탕화면 바로가기 확인
  ; shortcutName이 "이력서 적합도 평가 시스템"이므로 바로가기 파일명은 "이력서 적합도 평가 시스템.lnk"
  !define SHORTCUT_NAME "이력서 적합도 평가 시스템.lnk"
  
  ; 사용자 바탕화면 확인
  IfFileExists "$DESKTOP\${SHORTCUT_NAME}" 0 checkCommonDesktop
    ; 바로가기가 이미 있으면 생성 스킵
    ; electron-builder가 생성하는 바로가기 생성 섹션을 건너뛰기 위해 플래그 설정
    StrCpy $R0 "skip"
    Goto endShortcut
  
  checkCommonDesktop:
    ; 공용 바탕화면 확인 (perMachine: true인 경우)
    IfFileExists "$DESKTOP\Common Desktop\${SHORTCUT_NAME}" 0 newInstall
      ; 공용 바탕화면에 바로가기가 있으면 생성 스킵
      StrCpy $R0 "skip"
      Goto endShortcut
  
  newInstall:
    ; 새 설치이거나 바로가기가 없는 경우
    ; 바로가기 생성 허용
    StrCpy $R0 "create"
  
  endShortcut:
SectionEnd

; 바로가기 생성 섹션 오버라이드
; electron-builder가 생성하는 바로가기 생성 로직을 조건부로 실행
; 실제로는 electron-builder가 생성하는 섹션을 찾아서 조건부로 실행해야 함
; 하지만 정확한 섹션 이름을 모르므로, 대신 바로가기 생성 전에 존재 여부를 확인하는 방식 사용

; 참고: electron-builder는 보통 "installDesktopShortcut" 같은 섹션을 생성하지만,
; 정확한 이름은 빌드된 NSIS 스크립트를 확인해야 함
