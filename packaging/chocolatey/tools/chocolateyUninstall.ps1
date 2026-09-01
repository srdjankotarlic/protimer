$ErrorActionPreference = 'Stop'

$appGuid = 'a586f9c7-78e4-598c-bbc6-2ce3633e949f'
$productName = 'ProTimer'
$candidates = @(
  [pscustomobject]@{
    ScopeArgument = '/currentuser'
    InstallKey = "HKCU:\Software\$appGuid"
    UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$appGuid"
  },
  [pscustomobject]@{
    ScopeArgument = '/allusers'
    InstallKey = "HKLM:\Software\$appGuid"
    UninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$appGuid"
  }
)
$matches = @(
  $candidates | Where-Object { Test-Path -LiteralPath $_.UninstallKey }
)

if ($matches.Count -eq 0) {
  $orphanedMetadata = @(
    $candidates | Where-Object { Test-Path -LiteralPath $_.InstallKey }
  )
  if ($orphanedMetadata.Count -gt 0) {
    throw 'ProTimer install metadata exists, but its exact uninstall registration is missing.'
  }

  Write-Warning 'The exact ProTimer uninstall registration is absent. Nothing to uninstall.'
  return
}

if ($matches.Count -gt 1) {
  throw 'Both per-user and per-machine ProTimer installations exist. Refusing to guess which one to remove.'
}

$match = $matches[0]
$entry = Get-ItemProperty -LiteralPath $match.UninstallKey
$installMetadata = Get-ItemProperty -LiteralPath $match.InstallKey

if ([string]::IsNullOrWhiteSpace([string]$entry.DisplayVersion)) {
  throw 'The exact ProTimer uninstall registration has no DisplayVersion.'
}

$expectedDisplayName = "$productName $($entry.DisplayVersion)"
if ([string]$entry.DisplayName -cne $expectedDisplayName) {
  throw "Unexpected product at the ProTimer registry key: '$($entry.DisplayName)'."
}

if ([string]::IsNullOrWhiteSpace([string]$installMetadata.InstallLocation)) {
  throw 'The exact ProTimer install metadata has no InstallLocation.'
}

$installDirectory = [IO.Path]::GetFullPath(
  [Environment]::ExpandEnvironmentVariables(
    ([string]$installMetadata.InstallLocation).Trim().Trim('"')
  )
)
$uninstaller = Join-Path $installDirectory 'Uninstall ProTimer.exe'
if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
  throw "Expected ProTimer uninstaller is missing: $uninstaller"
}

$quietCommand = [string]$entry.QuietUninstallString
if ($quietCommand -notmatch '^\s*"(?<file>[^"]+\.exe)"(?:\s|$)') {
  throw 'The ProTimer QuietUninstallString has an unexpected format.'
}

$registeredUninstaller = [IO.Path]::GetFullPath(
  [Environment]::ExpandEnvironmentVariables($Matches.file)
)
if (-not [StringComparer]::OrdinalIgnoreCase.Equals($registeredUninstaller, $uninstaller)) {
  throw 'The registered uninstaller does not match the exact ProTimer install location.'
}

if ($quietCommand -notmatch '(?i)(^|\s)/S(?:\s|$)' -or
    $quietCommand -notmatch "(?i)(^|\s)$([regex]::Escape($match.ScopeArgument))(?:\s|$)") {
  throw 'The ProTimer quiet uninstall command has unexpected arguments.'
}

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  file           = $uninstaller
  silentArgs     = "$($match.ScopeArgument) /S"
  validExitCodes = @(0)
}

Uninstall-ChocolateyPackage @packageArgs

$cleanupDeadline = [DateTime]::UtcNow.AddSeconds(20)
do {
  $remainingItems = if (Test-Path -LiteralPath $installDirectory -PathType Container) {
    @(Get-ChildItem -LiteralPath $installDirectory -Force -Recurse)
  } else {
    @()
  }
  if ($remainingItems.Count -eq 0) {
    break
  }
  Start-Sleep -Seconds 1
} while ([DateTime]::UtcNow -lt $cleanupDeadline)

if ($remainingItems.Count -gt 0) {
  $sample = @($remainingItems | Select-Object -First 10 -ExpandProperty FullName)
  throw "ProTimer payload remains after package removal: $($sample -join ', ')"
}

if (Test-Path -LiteralPath $installDirectory -PathType Container) {
  Remove-Item -LiteralPath $installDirectory -Force
}
