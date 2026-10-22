# Windows cokacremote GUI - non-secret status collector.
# Reuses the existing scheduled task, URL file, local health, and OAuth metadata.
[CmdletBinding()]
param([switch]$VerifyRemote, [string]$OutputFile)
$ErrorActionPreference = 'Stop'
$state = Join-Path $HOME '.cokacremote'
$endpointFile = Join-Path $state 'current-mcp-url.txt'
$secretFile = Join-Path $state 'oauth-approval-key'
$status = [ordered]@{
    checkedAt = (Get-Date).ToString('o')
    task = 'NOT_INSTALLED'
    local = 'OFFLINE'
    public = 'NOT_CHECKED'
    oauth = 'NOT_CHECKED'
    authorization = 'NOT_CHECKED'
    endpoint = ''
    approvalKeyAvailable = (Test-Path -LiteralPath $secretFile)
    ready = $false
    detail = ''
}
try {
    $task = Get-ScheduledTask -TaskName 'cokacremote-windows' -ErrorAction SilentlyContinue
    if ($task) { $status.task = [string]$task.State }
    try {
        $h = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 2
        if ($h.status -eq 'ok' -and $h.service -eq 'cokacremote' -and $h.oauthEnabled -eq $true) {
            $status.local = 'HEALTHY'
        } else { $status.local = 'UNEXPECTED_RESPONSE' }
    } catch { $status.local = 'OFFLINE' }
    if (Test-Path -LiteralPath $endpointFile) {
        $s = [IO.File]::ReadAllText($endpointFile).Trim()
        if ($s -match '^https://[a-zA-Z0-9.-]+/mcp$') {
            $uri = [uri]$s
            if ($uri.Host -match '(^[a-zA-Z0-9-]+\.trycloudflare\.com$|^[a-zA-Z0-9.-]+$)') {
                $status.endpoint = $s
            }
        }
    }
    if ($VerifyRemote -and $status.endpoint) {
        $base = $status.endpoint.Substring(0,$status.endpoint.Length-4)
        try {
            $p = Invoke-RestMethod -Uri "$base/health" -TimeoutSec 6
            $status.public = if ($p.status -eq 'ok' -and $p.service -eq 'cokacremote' -and $p.oauthEnabled -eq $true) { 'HEALTHY' } else { 'UNEXPECTED_RESPONSE' }
            $a = Invoke-RestMethod -Uri "$base/.well-known/oauth-authorization-server" -TimeoutSec 6
            $r = Invoke-RestMethod -Uri "$base/.well-known/oauth-protected-resource/mcp" -TimeoutSec 6
            $status.oauth = if ($a.issuer.TrimEnd('/') -eq $base -and $r.resource -eq $status.endpoint) { 'HEALTHY' } else { 'MISMATCH' }
            $httpStatus = 0
            try {
                $resp = Invoke-WebRequest -Uri $status.endpoint -UseBasicParsing -TimeoutSec 6
                $httpStatus = [int]$resp.StatusCode
            } catch {
                if ($_.Exception.Response) { $httpStatus = [int]$_.Exception.Response.StatusCode }
            }
            $status.authorization = if ($httpStatus -eq 401) { 'AUTH_REQUIRED' } else { 'UNEXPECTED_'+$httpStatus }
        } catch {
            $status.public = 'OFFLINE'
            $status.detail = 'Unable to verify public tunnel'
        }
    }
    if (-not $status.endpoint) { $status.detail = 'No published HTTPS MCP URL (or malformed URL).' }
    $status.ready = ($status.task -eq 'Running' -and $status.local -eq 'HEALTHY' -and [bool]$status.endpoint -and $status.approvalKeyAvailable)
    if ($VerifyRemote) { $status.ready = ($status.ready -and $status.public -eq 'HEALTHY' -and $status.oauth -eq 'HEALTHY' -and $status.authorization -eq 'AUTH_REQUIRED') }
} catch {
    $status.ready = $false
    $status.detail = 'Status collection failed'
}
# Hardware/process ownership is observed independently from health.
# Never claim an arbitrary listener or cloudflared process as ours.
$portOwner = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$serverProcess = $null
if($portOwner){ $serverProcess=Get-CimInstance Win32_Process -Filter ("ProcessId="+$portOwner.OwningProcess) -ErrorAction SilentlyContinue }
$allTunnels=@(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object {$_.CommandLine -and $_.CommandLine.Contains('http://127.0.0.1:3000')})
$tunnelCandidates=@($allTunnels | Where-Object {$_.CommandLine.Contains([string](Join-Path $state 'cloudflared.log'))})
function Is-CurrentOwner($process) {
 if(-not $process){return $false}
 try{
  $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwner -ErrorAction Stop
  return ($owner.Domain+'\'+$owner.User) -ieq ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
 }catch{return $false}
}
$status.serverAlive=[bool]$portOwner
$status.serverOwned=[bool]($serverProcess -and $serverProcess.Name -eq 'node.exe' -and
 $serverProcess.CommandLine -match 'dist[/\\]src[/\\]server\.js' -and (Is-CurrentOwner $serverProcess))
$status.serverPid=if($portOwner){[int]$portOwner.OwningProcess}else{$null}
$status.tunnelAlive=$allTunnels.Count -gt 0
$status.tunnelOwned=($allTunnels.Count -eq 1 -and $tunnelCandidates.Count -eq 1 -and (Is-CurrentOwner $tunnelCandidates[0]))
$status.tunnelPid=if($tunnelCandidates.Count -eq 1){[int]$tunnelCandidates[0].ProcessId}else{$null}
$status.urlValid=[bool]($status.endpoint -match '^https://[a-zA-Z0-9-]+\.trycloudflare\.com/mcp$')
$status.taskState=$status.task
$status.localHealth=$status.local
$status.remoteHealth=$status.public
$status.oauthAligned=($status.oauth -eq 'HEALTHY')
$status.anonymous401=($status.authorization -eq 'AUTH_REQUIRED')
$status.url=$status.endpoint
$json = $status | ConvertTo-Json -Depth 4 -Compress
if ($OutputFile) {
    $dest = [IO.Path]::GetFullPath($OutputFile)
    $tmp = $dest+'.writing'
    [IO.File]::WriteAllText($tmp,$json,[Text.Encoding]::UTF8)
    Move-Item -LiteralPath $tmp -Destination $dest -Force
} else { Write-Output $json }
