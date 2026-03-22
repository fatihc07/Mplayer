$commitMsg = "Session Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Host "Syncing to GitHub..." -ForegroundColor Cyan

git add .
git commit -m $commitMsg
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Sync successful!" -ForegroundColor Green
} else {
    Write-Host "Error during sync." -ForegroundColor Red
}
