#Requires -Version 5.1
<#
One-shot Windows native cokacremote setup/repair command.
Default is SETUP (not status): preflight, install/update task, start,
verify OAuth and public tunnel, print Mac-style connection details.
Safe to rerun. Other actions: status, restart, stop, logs, key, console.
#>
param(
    [ValidateSet('setup','start','status','restart','stop','logs','key','console','install','repair')]
    [string]$Action = 'setup',
    [switch]$HideApprovalKey
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = Join-Path $HOME 'MCPWorkspace\cokacremote'
$base = Join-Path $repo 'deploy\windows'
$state = Join-Path $HOME '.cokacremote'
$launcher = Join-Path $base 'start-cokacremote.ps1'
$statusScript = Join-Path $base 'status-cokacremote.ps1'
$installer = Join-Path $base 'install-autostart.ps1'
$patcher = Join-Path $base 'patch-windows-exec.ps1'
$supervisorLog = Join-Path $state 'supervisor.log'
$urlFile = Join-Path $state 'current-mcp-url.txt'
$tunnelLog = Join-Path $state 'cloudflared.log'
$taskName = 'cokacremote-windows'

function Say([string]$message) { Write-Host ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $message) }
function Task { return Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue }
function Listener {
    return (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}
function LocalHealth {
    try { return Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 3 -ErrorAction Stop }
    catch { return $null }
}
function ReadUrl {
    if (-not (Test-Path -LiteralPath $urlFile)) { return $null }
    try {
        $url = [IO.File]::ReadAllText($urlFile).Trim()
        if ($url -match '^https://[a-zA-Z0-9.-]+/mcp$') { return $url }
    } catch {}
    return $null
}
function IsReady([bool]$fresh, [datetime]$since) {
    $runningTask = Task
    # A Ready task may still own healthy detached children. Require verified ownership.
    if (-not $runningTask) { return $false }
    $lst = Listener
    if (-not $lst) { return $false }
    $node = GetProc ([int]$lst.OwningProcess)
    if (-not (IsMine $node 'node')) { return $false }
    $managedTunnels = @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
        Where-Object { IsMine $_ 'tunnel' })
    if ($managedTunnels.Count -ne 1) { return $false }
    $h = LocalHealth
    if (-not $h -or $h.status -ne 'ok' -or $h.service -ne 'cokacremote' -or $h.oauthEnabled -ne $true) { return $false }
    $url = ReadUrl
    if (-not $url) { return $false }
    if ($fresh) {
        $file = Get-Item -LiteralPath $urlFile -ErrorAction SilentlyContinue
        if (-not $file -or $file.LastWriteTime -lt $since.AddSeconds(-2)) { return $false }
    }
    $origin = $url.Substring(0, $url.Length - 4)
    try {
        $remote = Invoke-RestMethod -Uri "$origin/health" -TimeoutSec 5 -ErrorAction Stop
        if ($remote.status -ne 'ok' -or $remote.service -ne 'cokacremote' -or $remote.oauthEnabled -ne $true) { return $false }
        $auth = Invoke-RestMethod -Uri "$origin/.well-known/oauth-authorization-server" -TimeoutSec 5 -ErrorAction Stop
        if ($auth.issuer.TrimEnd('/') -ne $origin -or $auth.authorization_endpoint -ne "$origin/authorize") { return $false }
        $resource = Invoke-RestMethod -Uri "$origin/.well-known/oauth-protected-resource/mcp" -TimeoutSec 5 -ErrorAction Stop
        if ($resource.resource -ne $url) { return $false }
        $responseStatus = 0
        try {
            $resp = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            $responseStatus = [int]$resp.StatusCode
        } catch {
            if ($_.Exception.Response) { $responseStatus = [int]$_.Exception.Response.StatusCode }
        }
        return ($responseStatus -eq 401)
    } catch {
        return $false
    }
}
function GetProc([int]$procId) {
    return Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
}
function IsMine([object]$proc, [string]$kind) {
    if (-not $proc -or -not $proc.CommandLine) { return $false }
    try {
        $who = Invoke-CimMethod -InputObject $proc -MethodName GetOwner -ErrorAction Stop
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        if (($who.Domain + '\' + $who.User) -ine $identity) { return $false }
    } catch { return $false }
    if ($kind -eq 'node') {
        return ($proc.Name -eq 'node.exe' -and $proc.CommandLine -match 'dist[/\\]src[/\\]server\.js')
    }
    if ($kind -eq 'tunnel') {
        return ($proc.Name -eq 'cloudflared.exe' -and
            $proc.CommandLine.Contains($tunnelLog) -and
            $proc.CommandLine.Contains('http://127.0.0.1:3000'))
    }
    return $false
}
function StopManagedRemnants {
    # Called only after stopping the dedicated scheduled task, or as a
    # preflight when no task is running. Never kill unknown port owners.
    $lst = Listener
    if ($lst) {
        $h = LocalHealth
        $p = GetProc ([int]$lst.OwningProcess)
        if ($h -and $h.service -eq 'cokacremote' -and (IsMine $p 'node')) {
            Say "Cleaning up owned cokacremote Node process $($p.ProcessId)."
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    }
    $stale = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction SilentlyContinue)
    foreach ($p in $stale) {
        if (IsMine $p 'tunnel') {
            Say "Cleaning up owned tunnel process $($p.ProcessId)."
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}
function StopTask {
    $t = Task
    if ($t -and $t.State -eq 'Running') {
        Say 'Stopping the managed scheduled supervisor.'
        Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
        for ($i = 0; $i -lt 15; $i++) {
            $current = Task
            if (-not $current -or $current.State -ne 'Running') { break }
            Start-Sleep -Seconds 1
        }
    }
    StopManagedRemnants
    if (-not (Listener)) {
        Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue
    }
}
function CheckPortOrThrow {
    $lst = Listener
    if ($lst) {
        $proc = GetProc ([int]$lst.OwningProcess)
        $cmd = if ($proc) { $proc.CommandLine } else { 'unavailable' }
        throw "Port 3000 is occupied by PID $($lst.OwningProcess); refusing to kill an unverified process. Command: $cmd"
    }
}
function Preflight {
    Say '1/5 Checking local repository, Node.js, cloudflared and PowerShell compatibility.'
    if (-not (Test-Path -LiteralPath (Join-Path $repo 'package.json'))) { throw "Repository missing: $repo" }
    if (-not (Test-Path -LiteralPath $launcher)) { throw "Supervisor script missing: $launcher" }
    if (-not (Test-Path -LiteralPath $installer)) { throw "Task installer missing: $installer" }
    Get-Command node -ErrorAction Stop | Out-Null
    Get-Command cloudflared -ErrorAction Stop | Out-Null
    Get-Command npm.cmd -ErrorAction Stop | Out-Null
    $exec = Join-Path $repo 'src\exec-tools.ts'
    if (-not (Test-Path -LiteralPath $exec)) { throw "Source file missing: $exec" }
    $source = [IO.File]::ReadAllText($exec)
    # v2 is the Windows patch ACTUALLY installed and verified on this laptop.
    # v4 uses a different (also valid) replacement. Recognize both, rather than
    # wrongly treating a patched source as an unknown/unpatched checkout.
    $v2Patched = $source.Contains('          args: process.platform === "win32" &&') -and
        $source.Contains('            ? ["-NoProfile", "-NonInteractive", "-Command", cmd]') -and
        $source.Contains('            : [login ? "-lc" : "-c", cmd],')
    $v4Patched = $source.Contains('const executionArgs = isWindowsPowerShell') -and
        $source.Contains('          args: executionArgs,') -and
        $source.Contains('["-NoProfile", "-NonInteractive", "-Command", cmd]')
    $dist = Join-Path $repo 'dist\src\server.js'
    $built = Test-Path -LiteralPath $dist
    $outdated = $built -and ((Get-Item -LiteralPath $exec).LastWriteTimeUtc -gt (Get-Item -LiteralPath $dist).LastWriteTimeUtc)
    if (-not ($v2Patched -or $v4Patched) -or -not $built -or $outdated) {
        Say 'Patching/building Windows command-execution compatibility if needed.'
        & $patcher
        if ($LASTEXITCODE -ne 0) { throw 'Windows patch or build failed; remote exposure aborted.' }
    } else {
        Say 'Windows PowerShell compatibility already patched and built (v2/v4); skipping redundant patch.'
    }
}
function WaitReady([datetime]$since) {
    Say '4/5 Waiting for OAuth server, public tunnel, discovery metadata and HTTP 401 checks.'
    $deadline = (Get-Date).AddSeconds(260)
    $last = Get-Date
    $startedAgain = $false
    while ((Get-Date) -lt $deadline) {
        if (IsReady $false $since) { return $true }
        $t = Task
        if ($t -and $t.State -ne 'Running' -and ((Get-Date) - $since).TotalSeconds -gt 20 -and -not $startedAgain) {
            Say "Scheduled task is $($t.State); making one recovery start attempt."
            # Never tear down a detached owned or unknown live child just because the task is Ready.
            $liveListener = Listener
            $liveTunnel = @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -and $_.CommandLine.Contains('http://127.0.0.1:3000') })
            if ($liveListener -or $liveTunnel.Count -gt 0) {
                Say 'Child process still exists; holding before any restart, without destructive cleanup.'
                $startedAgain = $true
                continue
            }
            CheckPortOrThrow
            $since = Get-Date
            Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue
            Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
            $startedAgain = $true
        }
        if (((Get-Date) - $last).TotalSeconds -ge 15) {
            $h = LocalHealth
            $status = if ($h) { "server=$($h.status), oauth=$($h.oauthEnabled)" } else { 'server=starting' }
            $t2 = Task
            $taskState = if ($t2) { [string]$t2.State } else { 'not registered' }
            Say "Still checking: task=$taskState, $status."
            $last = Get-Date
        }
        Start-Sleep -Seconds 3
    }
    return $false
}
function PrintDiagnostics {
    Say 'Startup/verification did not reach READY. Last supervisor messages:'
    if (Test-Path -LiteralPath $supervisorLog) {
        try { Get-Content -LiteralPath $supervisorLog -Tail 30 -ErrorAction Stop | ForEach-Object { Write-Host "  $_" } }
        catch { Write-Warning "Unable to read supervisor log: $($_.Exception.Message)" }
    }
    Say ('Full logs: {0}' -f $supervisorLog)
}
function Setup([bool]$forceRestart) {
    Preflight
    $t = Task
    if (-not $forceRestart -and $t -and (IsReady $false ([datetime]::MinValue))) {
        Say 'Verified existing managed server and tunnel; preserving active public address.'
        if ($HideApprovalKey) { & $statusScript } else { & $statusScript -ShowApprovalKey }
        return
    }
    if (-not $forceRestart -and $t -and $t.State -eq 'Running') {
        Say 'Checking existing installation before making any changes.'
        if (IsReady $false ([datetime]::MinValue)) {
            Say 'Already healthy; avoiding unnecessary tunnel restart and URL rotation.'
            if ($HideApprovalKey) { & $statusScript } else { & $statusScript -ShowApprovalKey }
            return
        }
        Say 'Existing task is recovering; preserving owned server and tunnel while waiting for supervisor reconciliation.'
        if(WaitReady (Get-Date)) { & $statusScript; return }
        throw 'Existing supervisor has not recovered. No destructive restart attempted; inspect GUI diagnostics.'
    }
    if($forceRestart){
        StopTask
        CheckPortOrThrow
        Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue
    } else {
        # Recover/adopt only if the listener is already owned by this deployment.
        $lst=Listener
        if($lst){
            $p=GetProc ([int]$lst.OwningProcess)
            if(-not(IsMine $p 'node')){CheckPortOrThrow}
            Say 'Retaining owned MCP listener. The supervisor will adopt it instead of killing it.'
        }
    }
    Say '2/5 Installing/updating Windows login auto-start task.'
    & $installer
    if (-not (Task)) { throw 'Task registration did not create cokacremote-windows.' }
    Say '3/5 Starting scheduled supervisor (nonblocking).'
    $since = Get-Date
    Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
    if (-not (WaitReady $since)) {
        PrintDiagnostics
        throw 'Automatic startup failed. Task and logs were preserved for diagnosis.'
    }
    Say '5/5 READY. Verified supervisor startup logs:'
    if (Test-Path -LiteralPath $supervisorLog) {
        try { Get-Content -LiteralPath $supervisorLog -Tail 18 | ForEach-Object { Write-Host ('  ' + $_) } }
        catch { Say 'Supervisor log could not be read; full status follows.' }
    }
    if ($HideApprovalKey) { & $statusScript } else { & $statusScript -ShowApprovalKey }
    Say 'One-shot setup complete. The server continues running in Windows Task Scheduler.'
}

try {
    switch ($Action) {
        { $_ -in @('setup','start','install','repair') } { Setup $false; break }
        'restart' { Setup $true; break }
        'status' { & $statusScript; break }
        'key' { & $statusScript -ShowApprovalKey; break }
        'logs' {
            if (Test-Path -LiteralPath $supervisorLog) { Get-Content -LiteralPath $supervisorLog -Tail 60 }
            else { Say 'No supervisor log yet.' }
            break
        }
        'stop' { StopTask; Say 'Stop complete (only recognized cokacremote-owned processes were terminated).'; break }
        'console' {
            CheckPortOrThrow
            Say 'Starting foreground Mac-style supervisor. Ctrl+C stops it.'
            & $launcher
            break
        }
    }
} catch {
    Write-Host ''
    Write-Host ('SETUP FAILED: {0}' -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ('Details: {0}' -f $supervisorLog)
    exit 1
}
