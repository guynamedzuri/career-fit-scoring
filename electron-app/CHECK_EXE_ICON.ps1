# 실행 파일 아이콘 확인 스크립트

$exePath = "dist-installer\win-unpacked\이력서 적합도 평가 시스템.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "실행 파일을 찾을 수 없습니다: $exePath" -ForegroundColor Red
    Write-Host "먼저 빌드를 실행하세요: npm run build:win" -ForegroundColor Yellow
    exit 1
}

Write-Host "실행 파일 확인: $exePath" -ForegroundColor Cyan
Write-Host ""

# 파일 정보
$fileInfo = Get-Item $exePath
Write-Host "파일 크기: $($fileInfo.Length) bytes" -ForegroundColor Green
Write-Host "수정 시간: $($fileInfo.LastWriteTime)" -ForegroundColor Green
Write-Host ""

# 아이콘 파일 확인
$iconPath = "dist-installer\win-unpacked\icon.ico"
if (Test-Path $iconPath) {
    Write-Host "✓ icon.ico가 루트에 있습니다: $iconPath" -ForegroundColor Green
    $iconInfo = Get-Item $iconPath
    Write-Host "  크기: $($iconInfo.Length) bytes" -ForegroundColor Gray
} else {
    Write-Host "✗ icon.ico가 루트에 없습니다" -ForegroundColor Red
}

# resources 폴더 확인
$resourcesIcon = "dist-installer\win-unpacked\resources\icon.ico"
if (Test-Path $resourcesIcon) {
    Write-Host "✓ icon.ico가 resources에 있습니다: $resourcesIcon" -ForegroundColor Yellow
} else {
    Write-Host "✗ icon.ico가 resources에 없습니다" -ForegroundColor Gray
}

Write-Host ""
Write-Host "실행 파일의 아이콘을 확인하려면:" -ForegroundColor Cyan
Write-Host "1. 파일 탐색기에서 실행 파일을 우클릭" -ForegroundColor White
Write-Host "2. 속성 > 아이콘 변경" -ForegroundColor White
Write-Host "3. 또는 파일을 직접 열어서 확인" -ForegroundColor White

# 실행 파일의 아이콘 추출 시도 (Resource Hacker 필요)
Write-Host ""
Write-Host "아이콘 리소스 확인 (Resource Hacker 사용):" -ForegroundColor Cyan
Write-Host "Resource Hacker를 사용하여 실행 파일의 아이콘 리소스를 확인할 수 있습니다." -ForegroundColor Gray
Write-Host "다운로드: http://www.angusj.com/resourcehacker/" -ForegroundColor Gray
