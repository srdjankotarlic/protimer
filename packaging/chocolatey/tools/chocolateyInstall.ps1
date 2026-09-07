$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$appPath = Join-Path $toolsDir 'ProTimer.exe'
$url64bit = 'https://github.com/srdjankotarlic/protimer/releases/download/v2.2.0/ProTimer-2.2.0-portable.exe'
$checksum64 = '38ddfceb8546def91f14a444de5f92b70ee509a48aa85cff95a435aac70a9add'

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
