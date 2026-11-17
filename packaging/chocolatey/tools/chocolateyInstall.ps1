$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appPath = Join-Path $toolsDir 'ProTimer.exe'
$url64bit = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.5.2/ProTimer-2.5.2-portable.exe'
$checksum64 = '7bcad065b3ee84494c2e679184171fbddf0154776c918eeeebfa27df6ee9b07b'

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
