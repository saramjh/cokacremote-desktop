#Requires -Version 5.1
# Registers an interactive per-user Windows Scheduled Task at logon.
# The desktop session is required for future GUI/Chrome automations.
$ErrorActionPreference = 'Stop'
$repo = Join-Path $HOME 'MCPWorkspace\cokacremote'
$script = Join-Path $repo 'deploy\windows\start-cokacremote.ps1'
if (-not (Test-Path -LiteralPath $script)) { throw "Missing automation script: $script" }
$taskName = 'cokacremote-windows'
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $ps -Argument ('-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Unattended' -f $script) -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered: $taskName for $user at interactive logon."
Write-Host "Start it now: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "Status: Get-ScheduledTask -TaskName '$taskName' | Get-ScheduledTaskInfo"
Write-Host "Logs: $HOME\.cokacremote\supervisor.log"
Write-Host ('Full Mac-style status: & "{0}"' -f (Join-Path $repo 'deploy\windows\status-cokacremote.ps1'))
