$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$installerName = 'ProTimer-Setup-2.1.0.exe'
$installerPath = Join-Path $toolsDir $installerName
$url64bit = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.1.0/ProTimer-Setup-2.1.0.exe'
$checksum64 = '0265a9871f78c33499992e63876d2110f0912fdaae977233441ea58177c9b899'
$silentArgs = '/S'

$downloadArgs = @{
  packageName    = $packageName
  fileFullPath   = $installerPath
  url64bit       = $url64bit
  checksum64     = $checksum64
  checksumType64 = 'sha256'
}

Get-ChocolateyWebFile @downloadArgs

# Assisted electron-builder NSIS installers can sporadically terminate with
# 0xC0000005 during a fresh per-user install. Running the verified executable
# directly lets this package retry only that exact transient failure without
# leaving Chocolatey's global helper state marked as failed.
$maxAttempts = 3
try {
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $process = Start-Process -FilePath $installerPath -ArgumentList $silentArgs -Wait -PassThru
    $exitCode = $process.ExitCode
    if ($exitCode -eq 0) {
      break
    }

    $isTransientAccessViolation = $exitCode -eq -1073741819 -or $exitCode -eq 3221225477
    if (-not $isTransientAccessViolation -or $attempt -eq $maxAttempts) {
      throw "ProTimer installer failed with exit code $exitCode."
    }

    Write-Warning "ProTimer installer hit a transient access violation (attempt $attempt of $maxAttempts). Retrying."
    Start-Sleep -Seconds 5
  }
} finally {
  if (Test-Path -LiteralPath $installerPath -PathType Leaf) {
    Remove-Item -LiteralPath $installerPath -Force
  }
}
