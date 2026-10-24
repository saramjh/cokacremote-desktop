#Requires -Version 5.1
param(
    [switch]$ShowApprovalKey
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = Join-Path $HOME 'MCPWorkspace\cokacremote'
$state = Join-Path $HOME '.cokacremote'
$approvalFile = Join-Path $state 'oauth-approval-key'
$urlFile = Join-Path $state 'current-mcp-url.txt'
$serverLog = Join-Path $state 'cokacremote.log'
$serverErr = Join-Path $state 'cokacremote.stderr.log'
$tunnelLog = Join-Path $state 'cloudflared.log'
$supervisorLog = Join-Path $state 'supervisor.log'

function Print-Result([string]$label,[string]$value,[bool]$ok) {
    if ($ok) { Write-Host ('  {0,-44}: PASS ({1})' -f $label,$value) -ForegroundColor Green }
    else { Write-Host ('  {0,-44}: FAIL ({1})' -f $label,$value) -ForegroundColor Yellow }
}
function Request-Json([string]$uri) {
    try { return Invoke-RestMethod -Uri $uri -TimeoutSec 6 -ErrorAction Stop } catch { return $null }
}
function Get-ResponseStatus([string]$uri) {
    try {
        $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 6 -ErrorAction Stop
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}
function Get-TaskState {
    $task = Get-ScheduledTask -TaskName 'cokacremote-windows' -ErrorAction SilentlyContinue
    if (-not $task) { return 'Not registered' }
    return [string]$task.State
}

$url = $null
if (Test-Path -LiteralPath $urlFile) {
    $url = ([IO.File]::ReadAllText($urlFile)).Trim()
}
$base = if ($url -match '^https://[^/]+/mcp$') { $url.Substring(0, $url.Length - 4) } else { $null }
$local = Request-Json 'http://127.0.0.1:3000/health'
$public = if ($base) { Request-Json "$base/health" } else { $null }
$resource = if ($base) { Request-Json "$base/.well-known/oauth-protected-resource/mcp" } else { $null }
$auth = if ($base) { Request-Json "$base/.well-known/oauth-authorization-server" } else { $null }
$unauth = if ($url) { Get-ResponseStatus $url } else { 0 }

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$serverPid = if ($listener) { [string]$listener.OwningProcess } else { 'not running' }
$taskState = Get-TaskState
$tunnelPidText = 'unknown'
try {
    $tunnels = @(Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -match 'http://127\.0\.0\.1:3000' })
    if ($tunnels.Count -eq 1) { $tunnelPidText = [string]$tunnels[0].ProcessId }
    elseif ($tunnels.Count -gt 1) { $tunnelPidText = ($tunnels.ProcessId -join ', ') }
} catch {}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' cokacremote Remote MCP - Windows connection details' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ('ChatGPT MCP URL          : {0}' -f $(if ($url) { $url } else { 'Unavailable (server/tunnel not ready)' }))
Write-Host 'Authentication           : OAuth 2.1'
Write-Host 'Client registration      : Dynamic Client Registration (DCR)'
Write-Host 'Scope                    : mcp:tools'
Write-Host ''
Write-Host 'OAuth approval key:'
if ($ShowApprovalKey -and (Test-Path -LiteralPath $approvalFile)) {
    Write-Host ('  {0}' -f [IO.File]::ReadAllText($approvalFile).Trim()) -ForegroundColor Yellow
    Write-Host '  Do not share this key. Enter only on the OAuth approval page.'
} else {
    Write-Host ('  Stored at: {0}' -f $approvalFile)
    Write-Host '  View it securely with: status-cokacremote.ps1 -ShowApprovalKey'
}
Write-Host ''
Write-Host 'cokacremote process:'
Write-Host ('  PID                    : {0}' -f $serverPid)
Write-Host ('  Repository             : {0}' -f $repo)
Write-Host ('  Stdout log             : {0}' -f $serverLog)
Write-Host ('  Error log              : {0}' -f $serverErr)
Write-Host '  Restart (manual)       : & "$HOME\MCPWorkspace\cokacremote\deploy\windows\start-cokacremote.ps1"'
Write-Host ''
Write-Host 'Cloudflare Quick Tunnel:'
Write-Host ('  PID                    : {0}' -f $tunnelPidText)
Write-Host ('  Log                    : {0}' -f $tunnelLog)
Write-Host ('  Host                   : {0}' -f $(if ($base) { ([uri]$base).Host } else { 'Unavailable' }))
Write-Host '  Warning                : Quick Tunnel URL changes after restart.'
Write-Host ''
Write-Host 'Windows Scheduled Task:'
Write-Host ('  Task                   : cokacremote-windows')
Write-Host ('  State                  : {0}' -f $taskState)
Write-Host ('  Supervisor log         : {0}' -f $supervisorLog)
Write-Host '  Stop                   : Stop-ScheduledTask -TaskName "cokacremote-windows"'
Write-Host '  Start                  : Start-ScheduledTask -TaskName "cokacremote-windows"'
Write-Host ''
Write-Host 'Live verification:'
Print-Result 'local /health' $(if ($local) { "status=$($local.status), oauth=$($local.oauthEnabled)" } else { 'unreachable' }) ([bool]($local -and $local.status -eq 'ok' -and $local.oauthEnabled -eq $true))
Print-Result 'public /health' $(if ($public) { "status=$($public.status), oauth=$($public.oauthEnabled)" } else { 'unreachable' }) ([bool]($public -and $public.status -eq 'ok' -and $public.oauthEnabled -eq $true))
Print-Result '/.well-known/oauth-protected-resource/mcp' $(if ($resource) { 'metadata available' } else { 'unreachable' }) ([bool]($resource -and $resource.resource -eq $url))
Print-Result '/.well-known/oauth-authorization-server' $(if ($auth) { 'metadata available' } else { 'unreachable' }) ([bool]($auth -and $auth.issuer.TrimEnd('/') -eq $base))
Print-Result '/mcp (unauthenticated)' $(if ($unauth -ne 0) { "HTTP $unauth" } else { 'unreachable' }) ($unauth -eq 401)
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''
