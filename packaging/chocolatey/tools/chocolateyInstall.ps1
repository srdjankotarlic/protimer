$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appPath = Join-Path $toolsDir 'ProTimer.exe'
$url64bit = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.4.0/ProTimer-2.4.0-portable.exe'
$checksum64 = 'e4b5659f68c3c650a34b8f25faa48cfbb77c9dd1287f5634ed54ace5dea4b647'

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
