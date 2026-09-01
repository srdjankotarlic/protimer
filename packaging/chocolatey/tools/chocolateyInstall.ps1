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

Install-ChocolateyPackage @packageArgs
