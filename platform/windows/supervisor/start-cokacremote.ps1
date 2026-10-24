#Requires -Version 5.1
# Windows native cokacremote OAuth + Quick Tunnel supervisor.
# Run as the signed-in Windows user. Do not run as SYSTEM.
# Cloudflare Quick Tunnel addresses change after a tunnel restart.
param(
    [switch]$Unattended
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = Join-Path $HOME 'MCPWorkspace\cokacremote'
$state = Join-Path $HOME '.cokacremote'
$approvalFile = Join-Path $state 'oauth-approval-key'
$oauthStateFile = Join-Path $state 'oauth-state.json'
$tunnelLog = Join-Path $state 'cloudflared.log'
$serverLog = Join-Path $state 'cokacremote.log'
$serverErr = Join-Path $state 'cokacremote.stderr.log'
$supervisorLog = Join-Path $state 'supervisor.log'
$activeUrlFile = Join-Path $state 'current-mcp-url.txt'
$port = 3000
$tunnel = $null
$server = $null

. (Join-Path $PSScriptRoot 'component-recovery.ps1')

function Write-ConnectionSummary([string]$url, [string]$hostname) {
    # Do not persist the OAuth approval key in logs, state URL, or task output.
    # Print it only when explicitly running the foreground interactive supervisor.
    $hostBorder = '============================================================'
    Write-Host ''
    Write-Host $hostBorder -ForegroundColor Cyan
    Write-Host ' cokacremote Remote MCP - Windows connection details' -ForegroundColor Cyan
    Write-Host $hostBorder -ForegroundColor Cyan
    Write-Host ('ChatGPT MCP URL          : {0}/mcp' -f $url) -ForegroundColor Green
    Write-Host 'Authentication           : OAuth 2.1'
    Write-Host 'Client registration      : Dynamic Client Registration (DCR)'
    Write-Host 'Scope                    : mcp:tools'
    Write-Host ''
    Write-Host 'OAuth approval key:'
    if ($Unattended) {
        Write-Host ('  Saved to: {0}' -f $approvalFile)
        Write-Host '  Print manually: & "$HOME\MCPWorkspace\cokacremote\deploy\windows\status-cokacremote.ps1" -ShowApprovalKey'
    } else {
        Write-Host ('  {0}' -f $approvalKey) -ForegroundColor Yellow
        Write-Host '  This key is secret. Enter it only on the OAuth authorization page.'
    }
    Write-Host ''
    Write-Host 'cokacremote process:'
    Write-Host ('  PID                    : {0}' -f $server.Id)
    Write-Host ('  Repository             : {0}' -f $repo)
    Write-Host ('  Log                    : {0}' -f $serverLog)
    Write-Host ('  Error log              : {0}' -f $serverErr)
    Write-Host ('  Stop                   : Ctrl+C (foreground) / Stop-ScheduledTask -TaskName "cokacremote-windows"')
    Write-Host ('  Restart                : & "{0}"' -f (Join-Path $repo 'deploy\windows\start-cokacremote.ps1'))
    Write-Host ''
    Write-Host 'Cloudflare Quick Tunnel:'
    Write-Host ('  Owned by               : Windows cokacremote supervisor')
    Write-Host ('  PID                    : {0}' -f $tunnel.Id)
    Write-Host ('  Log                    : {0}' -f $tunnelLog)
    Write-Host ('  Host                   : {0}' -f $hostname)
    Write-Host '  Warning                : Quick Tunnel hostname changes after a restart.'
    Write-Host ''
    Write-Host 'Verification results:'
    Write-Host '  local /health                            : PASS (ok, OAuth=true)' -ForegroundColor Green
    Write-Host '  public /health                           : PASS (ok, OAuth=true)' -ForegroundColor Green
    Write-Host '  /.well-known/oauth-protected-resource/mcp : PASS (resource matches)' -ForegroundColor Green
    Write-Host '  /.well-known/oauth-authorization-server  : PASS (issuer matches)' -ForegroundColor Green
    Write-Host '  /mcp (unauthenticated)                    : PASS (401 Unauthorized)' -ForegroundColor Green
    Write-Host $hostBorder -ForegroundColor Cyan
    Write-Host 'Monitoring: every 15s local /health; every 60s public /health.'
    if ($Unattended) {
        Write-Host 'Unattended scheduled-task supervisor is active.'
    } else {
        Write-Host 'This foreground supervisor keeps running. Press Ctrl+C to stop it.'
    }
    Write-Host ('Status anytime: & "{0}"' -f (Join-Path $repo 'deploy\windows\status-cokacremote.ps1'))
    Write-Host ''
}

function Write-Log([string]$message) {
    $line = ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message)
    Write-Host $line
    Add-Content -LiteralPath $supervisorLog -Value $line -Encoding UTF8
}
function Secure-Path([string]$path, [bool]$directory) {
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($directory) {
        $grants = @("*${sid}:(OI)(CI)F", '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F')
    } else {
        $grants = @("*${sid}:F", '*S-1-5-18:F', '*S-1-5-32-544:F')
    }
    & icacls.exe $path '/inheritance:r' '/grant:r' $grants | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not secure ACL: $path" }
}
function Get-Health {
    return Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 5
}
function Stop-Owned {
    foreach ($p in @($server, $tunnel)) {
        if ($null -ne $p) {
            try {
                $p.Refresh()
                if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction Stop }
            } catch { Write-Log "Cleanup warning: $($_.Exception.Message)" }
        }
    }
    $script:server = $null
    $script:tunnel = $null
}
function Read-SharedLog([string]$path) {
    # File.ReadAllText opens with restrictive sharing on Windows. cloudflared
    # writes continuously, so use a shared read handle instead.
    $stream = [System.IO.File]::Open(
        $path,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete)
    )
    try {
        $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $true)
        try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally {
        $stream.Dispose()
    }
}
function Wait-ForTunnelUrl {
    for ($i = 0; $i -lt 60; $i++) {
        $tunnel.Refresh()
        if ($tunnel.HasExited) { throw 'cloudflared exited before publishing a URL.' }
        if (Test-Path -LiteralPath $tunnelLog) {
            try {
                $raw = Read-SharedLog $tunnelLog
                $match = [regex]::Match($raw, 'https://[A-Za-z0-9-]+\.trycloudflare\.com')
                if ($match.Success) { return $match.Value }
            } catch [System.IO.IOException] {
                # Log rotation/creation races are transient. Retry without
                # restarting a healthy cloudflared process.
            }
        }
        Start-Sleep -Seconds 1
    }
    throw 'Could not obtain Cloudflare Quick Tunnel hostname. See cloudflared.log.'
}
function Verify-Remote([string]$url) {
    for ($i = 0; $i -lt 45; $i++) {
        $tunnel.Refresh(); $server.Refresh()
        if ($tunnel.HasExited -or $server.HasExited) { throw 'Tunnel or MCP server exited during verification.' }
        try {
            $local = Get-Health
            $public = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 7
            if ($local.status -ne 'ok' -or $public.service -ne 'cokacremote' -or
                $local.oauthEnabled -ne $true -or $public.oauthEnabled -ne $true) {
                throw 'Health endpoint did not report OAuth-enabled cokacremote.'
            }
            $resource = Invoke-RestMethod -Uri "$url/.well-known/oauth-protected-resource/mcp" -TimeoutSec 7
            $auth = Invoke-RestMethod -Uri "$url/.well-known/oauth-authorization-server" -TimeoutSec 7
            if ($resource.resource -ne "$url/mcp") { throw 'OAuth resource URL mismatch.' }
            if ($auth.issuer.TrimEnd('/') -ne $url) { throw 'OAuth issuer URL mismatch.' }
            $unauthStatus = 0
            try {
                Invoke-WebRequest -Uri "$url/mcp" -TimeoutSec 7 -UseBasicParsing | Out-Null
                $unauthStatus = 200
            } catch {
                if ($_.Exception.Response) {
                    $unauthStatus = [int]$_.Exception.Response.StatusCode
                }
            }
            if ($unauthStatus -ne 401) { throw "Unauthenticated /mcp expected 401, got $unauthStatus" }
            return
        } catch {
            if ($i -eq 44) { throw "Remote verification failed: $($_.Exception.Message)" }
            Start-Sleep -Seconds 2
        }
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $repo 'dist\src\server.js'))) {
    throw 'Build output missing. Run patch-windows-exec.ps1 first.'
}
$secureNode = Join-Path $env:LOCALAPPDATA 'NodeSecurityRuntimes\node-v24.22.1-win-x64\node.exe'
if ((-not (Test-Path -LiteralPath $secureNode)) -or ((& $secureNode -v) -ne 'v24.22.1')) {
    throw 'Security-patched Node.js 24.22.1 is required for cokacremote.'
}
$nodeCmd = Get-Command $secureNode -ErrorAction Stop
$cloudCmd = Get-Command cloudflared -ErrorAction Stop
if (-not (Test-Path -LiteralPath $state)) {
    New-Item -ItemType Directory -Path $state -Force | Out-Null
}
Secure-Path $state $true
if (-not (Test-Path -LiteralPath $approvalFile)) {
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 32
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $key = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    [System.IO.File]::WriteAllText($approvalFile, $key)
}
Secure-Path $approvalFile $false
$approvalKey = [System.IO.File]::ReadAllText($approvalFile).Trim()
if ($approvalKey.Length -lt 32) { throw 'OAuth approval key has insufficient length.' }
if (Test-Path -LiteralPath $oauthStateFile) { Secure-Path $oauthStateFile $false }

Write-Log '0) Starting cokacremote Windows supervisor (OAuth 2.1 only; no static bearer bypass).'
Write-Log ('1) Preflight: repository={0}, node={1}, cloudflared={2}' -f $repo, $nodeCmd.Source, $cloudCmd.Source)
Write-Log ('2) OAuth state/approval key prepared: {0}' -f $approvalFile)
$failureCount = 0
try {
    while ($true) {
        try {
            Write-Log '3) Reconciling managed server and tunnel'
            $server=Find-OwnedServer
            $tunnel=Find-OwnedTunnel
            $reusedUrl=Existing-Url
            if($server){Write-Log ('REUSE existing MCP PID '+$server.Id)}
            if($tunnel){Write-Log ('REUSE existing tunnel PID '+$tunnel.Id)}
            Remove-Item Env:MCP_AUTH_TOKEN -ErrorAction SilentlyContinue
            $env:MCP_HOST = '127.0.0.1'
            $env:MCP_PORT = "$port"
            $env:MCP_DEFAULT_CWD = Join-Path $HOME 'MCPWorkspace'
            $env:MCP_DEFAULT_SHELL = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $env:MCP_ALLOW_NO_AUTH = 'false'
            $env:MCP_OAUTH_ENABLED = 'true'
            $env:MCP_OAUTH_STATE_FILE = $oauthStateFile
            $env:MCP_ENABLE_BROWSER_TOOLS = 'false' # Enable only after browser automation is validated.
            $env:MCP_TRUST_PROXY_HOPS = '1'

            # Let cloudflared own its own log file. PowerShell Start-Process
            # -RedirectStandardError holds a Windows file handle that can block
            # File.ReadAllText until the child exits. The native --logfile
            # option avoids that sharing conflict and retains the tunnel URL.
            if(-not $tunnel){
                if(Test-Path -LiteralPath $tunnelLog){Remove-Item -LiteralPath $tunnelLog -Force -ErrorAction Stop}
                Write-Log '4) Starting tunnel because no managed tunnel exists'
                $tunnel=Start-Process -FilePath $cloudCmd.Source -ArgumentList @('tunnel','--logfile',$tunnelLog,'--loglevel','info','--url','http://127.0.0.1:3000') -WindowStyle Hidden -PassThru
                $url=Wait-ForTunnelUrl
            }else{
                $url=if($reusedUrl){$reusedUrl}else{Wait-ForTunnelUrl}
                Write-Log ('4) Preserving existing Quick Tunnel URL: '+$url)
            }
            if($server){
                $issuer=Local-Issuer
                if($issuer.TrimEnd('/') -ne $url){
                    Write-Log 'OAuth issuer mismatch after tunnel change; replacing only owned server'
                    Stop-Process -Id $server.Id -Force -ErrorAction Stop
                    Start-Sleep -Milliseconds 600
                    $server=$null
                }
            }
            $hostname = ([uri]$url).Host
            Write-Log "5) Tunnel obtained: $url"

            $env:MCP_PUBLIC_URL = $url
            $env:MCP_ALLOWED_HOSTS = "$hostname,127.0.0.1,localhost"
            $env:MCP_OAUTH_ISSUER = $url
            $env:MCP_OAUTH_RESOURCE = "$url/mcp"
            $env:MCP_OAUTH_APPROVAL_KEY = $approvalKey

            if(-not $server){
                Write-Log '6) Starting OAuth server with existing verified tunnel if available'
                $server=Start-Process -FilePath $nodeCmd.Source -ArgumentList @('dist/src/server.js') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardError $serverErr -RedirectStandardOutput $serverLog -PassThru
            }else{Write-Log ('6) Preserving existing OAuth server PID '+$server.Id)}
            # Do not keep the OAuth key in the supervisor's environment any longer than needed.
            Remove-Item Env:MCP_OAUTH_APPROVAL_KEY -ErrorAction SilentlyContinue

            Write-Log '7) Verifying local/public health, OAuth discovery and 401 access control'
            Verify-Remote $url
            Write-Log '8) Local /health and public /health: PASS (OAuth=true)'
            Write-Log '9) OAuth discovery: PASS (issuer and protected resource match)'
            Write-Log '10) Anonymous /mcp access: PASS (HTTP 401)'
            [System.IO.File]::WriteAllText($activeUrlFile, "$url/mcp")
            Write-Log "READY: $url/mcp | OAuth 2.1 | no anonymous MCP access"
            Write-Log "Approval key is stored in $approvalFile (never written to logs)."
            Write-ConnectionSummary $url $hostname
            $failureCount = 0
            $missed = 0
            $remoteMissed = 0
            $cycle = 0
            while ($true) {
                Start-Sleep -Seconds 15
                $cycle++
                $server.Refresh(); $tunnel.Refresh()
                if ($server.HasExited -or $tunnel.HasExited) { throw 'MCP or Tunnel process exited.' }
                try {
                    $h = Get-Health
                    if ($h.status -ne 'ok' -or $h.oauthEnabled -ne $true) { throw 'Server health degraded.' }
                    $missed = 0
                } catch {
                    $missed++
                    Write-Log "Local health failure $missed/3: $($_.Exception.Message)"
                    if ($missed -ge 3) { throw 'Repeated local MCP health failures.' }
                }
                # Check the public endpoint every minute, without resetting a good tunnel on brief errors.
                if ($cycle % 4 -eq 0) {
                    try {
                        $remote = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 7
                        if ($remote.status -ne 'ok' -or $remote.oauthEnabled -ne $true) { throw 'Remote health degraded.' }
                        $remoteMissed = 0
                    } catch {
                        $remoteMissed++
                        Write-Log "Public health failure $remoteMissed/3: $($_.Exception.Message)"
                        if ($remoteMissed -ge 3) { throw 'Repeated public MCP health failures.' }
                    }
                }
            }
        } catch {
            $failureCount++
            Write-Log "SUPERVISOR ERROR ($failureCount/3): $($_.Exception.Message)"
            Remove-Item -LiteralPath $activeUrlFile -Force -ErrorAction SilentlyContinue
            # Preserve live components during retry. Next cycle re-observes PIDs and URL.
            if($tunnel){try{$tunnel.Refresh();if(-not $tunnel.HasExited){Write-Log 'PRESERVE verified tunnel for retry'}}catch{}}
            if($server){try{$server.Refresh();if(-not $server.HasExited){Write-Log 'PRESERVE verified server for retry'}}catch{}}
            if($failureCount -ge 3){Write-Log 'BACKOFF after three failed checks (no destructive restart)';Start-Sleep -Seconds 45;$failureCount=0}
            Start-Sleep -Seconds 10
        }
    }
} finally {
    # Explicit stop/restart cleans children through the existing controller.
    # Unexpected service exit preserves components so the next task can adopt.
    Write-Log 'Supervisor exiting; managed components preserved for next status reconciliation.'
}
