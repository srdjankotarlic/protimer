# ProTimer Chocolatey package

This directory is the public source for the proposed ProTimer package in the
Chocolatey Community Repository. It is not published yet.

## Automated Windows validation

The repository's `Chocolatey package` workflow runs on a clean GitHub-hosted
Windows runner. It packs the package, performs a silent install, checks the
Windows uninstall registration, exercises the upgrade path, uninstalls the app
and confirms that the registration is removed.

Before publishing, run the workflow successfully for the exact release and also
perform one manual launch check for the controller, audience output, local phone
links and Windows Firewall prompt.

## Manual release check

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
