$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appPath = Join-Path $toolsDir 'ProTimer.exe'
$url64bit = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.4.1/ProTimer-2.4.1-portable.exe'
$checksum64 = '0cdd356fec28f5248c961964976e60b56d1e6342848455201a7fd008752ec8a0'

$downloadArgs = @{
  packageName    = $packageName
  fileFullPath   = $appPath
  url64bit       = $url64bit
  checksum64     = $checksum64
  checksumType64 = 'sha256'
}

Get-ChocolateyWebFile @downloadArgs

$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProTimer.lnk'
$startMenuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'ProTimer.lnk'
foreach ($shortcut in @($desktopLink, $startMenuLink)) {
  Install-ChocolateyShortcut `
    -ShortcutFilePath $shortcut `
    -TargetPath $appPath `
    -WorkingDirectory $toolsDir `
    -Description 'Free stage timer for live events and OBS'
}
