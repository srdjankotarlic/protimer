$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appPath = Join-Path $toolsDir 'ProTimer.exe'
$url64bit = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.3.0/ProTimer-2.3.0-portable.exe'
$checksum64 = 'df14f2895120f83e98d6b3ea2a8caee971e64adf4790b99e6e0f9e8781a5747d'

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
