$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appPath = [IO.Path]::GetFullPath((Join-Path $toolsDir 'ProTimer.exe'))
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProTimer.lnk'
$startMenuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'ProTimer.lnk'
$shell = New-Object -ComObject WScript.Shell

foreach ($shortcut in @($desktopLink, $startMenuLink)) {
  if (-not (Test-Path -LiteralPath $shortcut -PathType Leaf)) {
    continue
  }

  $target = [IO.Path]::GetFullPath($shell.CreateShortcut($shortcut).TargetPath)
  if ([StringComparer]::OrdinalIgnoreCase.Equals($target, $appPath)) {
    Remove-Item -LiteralPath $shortcut -Force
  } else {
    Write-Warning "The shortcut is not owned by this ProTimer package and was preserved: $shortcut"
  }
}
