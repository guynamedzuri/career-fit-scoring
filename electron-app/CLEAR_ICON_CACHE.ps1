# Windows 아이콘 캐시 클리어 스크립트
# 관리자 권한으로 실행 필요

Write-Host "Windows 아이콘 캐시를 클리어합니다..." -ForegroundColor Yellow

# Windows 탐색기 종료
Write-Host "탐색기를 종료합니다..." -ForegroundColor Cyan
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue

# 잠시 대기
Start-Sleep -Seconds 2

# 아이콘 캐시 삭제
Write-Host "아이콘 캐시 파일을 삭제합니다..." -ForegroundColor Cyan

# IconCache.db 삭제
$iconCacheDb = "$env:LOCALAPPDATA\IconCache.db"
if (Test-Path $iconCacheDb) {
    Remove-Item $iconCacheDb -Force -ErrorAction SilentlyContinue
    Write-Host "  - IconCache.db 삭제됨" -ForegroundColor Green
} else {
    Write-Host "  - IconCache.db 없음" -ForegroundColor Gray
}

# Explorer 아이콘 캐시 삭제
$explorerCache = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
if (Test-Path $explorerCache) {
    Get-ChildItem -Path $explorerCache -Filter "iconcache*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "  - Explorer iconcache 삭제됨" -ForegroundColor Green
}

# Thumbnail 캐시도 삭제 (선택사항)
$thumbCache = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db"
Get-ChildItem -Path $thumbCache -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# 탐색기 재시작
Write-Host "탐색기를 재시작합니다..." -ForegroundColor Cyan
Start-Sleep -Seconds 1
Start-Process explorer

Write-Host "`n완료! 아이콘 캐시가 클리어되었습니다." -ForegroundColor Green
Write-Host "이제 앱을 다시 실행하거나 재부팅하면 새 아이콘이 표시됩니다." -ForegroundColor Yellow
