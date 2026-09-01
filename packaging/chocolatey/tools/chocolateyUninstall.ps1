$ErrorActionPreference = 'Stop'

$softwareName = 'ProTimer*'
$uninstallKeys = @(Get-UninstallRegistryKey -SoftwareName $softwareName)

if ($uninstallKeys.Count -eq 0) {
  Write-Warning "$softwareName is not registered as installed. Nothing to uninstall."
  return
}

if ($uninstallKeys.Count -gt 1) {
  throw "More than one installation matched '$softwareName'. Refusing to guess which one to remove."
}

$uninstallString = if ($uninstallKeys[0].QuietUninstallString) {
  $uninstallKeys[0].QuietUninstallString
} else {
  $uninstallKeys[0].UninstallString
}
if ([string]::IsNullOrWhiteSpace($uninstallString)) {
  throw "The ProTimer uninstall registry entry does not contain an uninstall command."
}

if ($uninstallString -match '^\s*"(?<file>[^"]+\.exe)"\s*(?<arguments>.*)$') {
  $uninstaller = $Matches.file
  $silentArgs = $Matches.arguments.Trim()
} elseif ($uninstallString -match '^\s*(?<file>.+?\.exe)\s*(?<arguments>.*)$') {
  $uninstaller = $Matches.file.Trim()
  $silentArgs = $Matches.arguments.Trim()
} else {
  throw "Could not parse the ProTimer uninstall command: $uninstallString"
}

if ($silentArgs -notmatch '(^|\s)/S(\s|$)') {
  $silentArgs = "$silentArgs /S".Trim()
}

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  silentArgs     = $silentArgs
  file           = $uninstaller
  validExitCodes = @(0)
}

Uninstall-ChocolateyPackage @packageArgs
