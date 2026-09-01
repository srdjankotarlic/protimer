$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.1.0/ProTimer-Setup-2.1.0.exe'
  checksum64     = '0265a9871f78c33499992e63876d2110f0912fdaae977233441ea58177c9b899'
  checksumType64 = 'sha256'
  softwareName   = 'ProTimer 2.1.0'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

# Assisted electron-builder NSIS installers can sporadically terminate with
# 0xC0000005 during a fresh per-user install. Retry only that exact transient
# failure; every other installer error remains fatal.
$maxAttempts = 3
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  try {
    Install-ChocolateyPackage @packageArgs
    break
  } catch {
    $isTransientAccessViolation = $_.Exception.Message -match '(-1073741819|0xC0000005)'
    if (-not $isTransientAccessViolation -or $attempt -eq $maxAttempts) {
      throw
    }
    Write-Warning "ProTimer installer hit a transient access violation (attempt $attempt of $maxAttempts). Retrying."
    Start-Sleep -Seconds 5
  }
}
