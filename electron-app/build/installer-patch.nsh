; NSIS 스크립트: 업데이트(패치) 시 바탕화면 바로가기 유지
; electron-builder가 자동 생성하는 스크립트에 이 내용이 포함됨

; 설치 후 섹션: 바로가기 생성 로직 제어
Section -Post
  ; 기존 설치 확인 (업데이트인지 체크)
  IfFileExists "$INSTDIR\app.exe" 0 newInstall
  
  ; 업데이트인 경우: 바탕화면 바로가기 확인
  ; electron-builder가 이미 SHORTCUT_NAME을 정의했으므로 그대로 사용
  ; 바로가기 파일명은 "${SHORTCUT_NAME}.lnk"
  
  ; 사용자 바탕화면 확인
  IfFileExists "$DESKTOP\${SHORTCUT_NAME}.lnk" 0 checkCommonDesktop
    ; 바로가기가 이미 있으면 생성 스킵
    ; electron-builder가 생성하는 바로가기 생성 섹션을 건너뛰기 위해 레지스트리에 플래그 설정
    WriteRegStr HKCU "Software\${PRODUCT_NAME}" "SkipDesktopShortcut" "1"
    Goto endShortcut
  
  checkCommonDesktop:
    ; 공용 바탕화면 확인 (perMachine: true인 경우)
    IfFileExists "$DESKTOP\Common Desktop\${SHORTCUT_NAME}.lnk" 0 newInstall
      ; 공용 바탕화면에 바로가기가 있으면 생성 스킵
      WriteRegStr HKCU "Software\${PRODUCT_NAME}" "SkipDesktopShortcut" "1"
      Goto endShortcut
  
  newInstall:
    ; 새 설치이거나 바로가기가 없는 경우
    ; 바로가기 생성 허용 (플래그 제거)
    DeleteRegValue HKCU "Software\${PRODUCT_NAME}" "SkipDesktopShortcut"
  
  endShortcut:
SectionEnd

; 참고: electron-builder가 생성하는 바로가기 생성 섹션을 직접 제어하기는 어렵습니다.
; 대신 바로가기 생성 전에 존재 여부를 확인하고, 있으면 생성하지 않도록 하는 로직을 추가해야 합니다.
; 실제로는 electron-builder가 생성하는 NSIS 스크립트의 구조를 확인하여 정확한 방법을 찾아야 합니다.
