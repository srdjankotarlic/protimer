# ProTimer Chocolatey package

This directory is the public source for the proposed ProTimer package in the
Chocolatey Community Repository. It is not published yet.

## Required Windows validation before publishing

Run these commands from an elevated PowerShell prompt in a clean Windows VM:

```powershell
choco pack .\protimer.nuspec
choco install protimer --source . --version 2.1.0 -y --debug --verbose
choco upgrade protimer --source . -y --debug --verbose
choco uninstall protimer -y --debug --verbose
choco install protimer --source . --version 2.1.0 -y --force --install-arguments='/S'
```

After installation, launch ProTimer and verify the controller, audience output,
local phone links and Windows Firewall prompt. Confirm that uninstall removes the
application and Start Menu/Desktop shortcuts without leaving a running process.

Publishing also requires a Chocolatey Community account and API key:

```powershell
choco apikey --key <API_KEY> --source https://push.chocolatey.org/
choco push .\protimer.2.1.0.nupkg --source https://push.chocolatey.org/
```

Do not publish until the clean-VM install, upgrade and uninstall checks pass.
