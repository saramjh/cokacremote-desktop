#Requires -Version 5.1
# On-demand GUI control: no task creation or login autostart.
[CmdletBinding()]
param([ValidateSet('setup','stop','restart')][string]$Action='setup')
$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$launcher=Join-Path $base 'start-cokacremote.ps1'
$state=Join-Path $env:LOCALAPPDATA 'cokacremote\control-desk-state'
$urlFile=Join-Path $state 'current-mcp-url.txt'
$tunnelLog=Join-Path $state 'cloudflared.log'
$ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskName='cokacremote-windows'
function Owned([object]$proc) {
 if(-not $proc -or -not $proc.CommandLine){return $false}
 try{
  $user=Invoke-CimMethod -InputObject $proc -MethodName GetOwner -ErrorAction Stop
  return (($user.Domain+'\'+$user.User) -ieq [Security.Principal.WindowsIdentity]::GetCurrent().Name)
 }catch{return $false}
}
function Supervisors {
 @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
  Where-Object {$_.CommandLine -and $_.CommandLine.Contains($launcher) -and
   $_.CommandLine -match '(?i)(^|\s)-File(\s|$)' -and (Owned $_)})
}
function LegacyTask {return $null}
function OwnedServer {
 $listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
 if(-not $listener){return $null}
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess) -ErrorAction SilentlyContinue
 if(-not($p -and (Owned $p) -and $p.Name -eq 'node.exe' -and $p.ExecutablePath -ieq (Join-Path (Split-Path (Split-Path $base -Parent) -Parent) 'runtime\bin\node.exe') -and $p.CommandLine -match 'dist[/\\]src[/\\]server\.js')){
  throw 'Unverified TCP 3000 owner. Refusing operation.'
 }
 return $p
}
function OwnedTunnels {
 $all=@(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object {$_.CommandLine -and $_.CommandLine.Contains('http://127.0.0.1:3000')})
 $matched=@($all | Where-Object {$_.CommandLine.Contains($tunnelLog) -and (Owned $_)})
 if($all.Count -ne $matched.Count -or $matched.Count -gt 1){
  throw 'Unverified or duplicate tunnel process. Refusing operation.'
 }
 return $matched
}
function StartManual {
 if(-not(Test-Path -LiteralPath $launcher)){throw 'Missing supervisor launcher.'}
 $task=LegacyTask
 if($task -and $task.State -eq 'Running'){
  throw 'Legacy scheduled supervisor is running; refusing duplicate start.'
 }
 $workers=@(Supervisors)
 if($workers.Count -gt 1){throw 'Multiple supervisor owners; refusing duplicate.'}
 if($workers.Count -eq 1){Write-Output ('REUSE GUI supervisor PID '+$workers[0].ProcessId);return}
 $server=OwnedServer
 $tunnels=@(OwnedTunnels)
 $args='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$launcher+'" -Unattended -OnDemand'
 $child=Start-Process -FilePath $ps -ArgumentList $args -WindowStyle Hidden -PassThru
 if(-not $child){throw 'Unable to launch hidden GUI supervisor.'}
 Write-Output ('START GUI supervisor PID '+$child.Id+'; existing owned components preserved.')
}
function StopManual {
 $task=LegacyTask
 if($task -and $task.State -eq 'Running'){
  Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
  for($i=0;$i -lt 12;$i++){
   if((LegacyTask).State -ne 'Running'){break}
   Start-Sleep -Milliseconds 250
  }
  if((LegacyTask).State -eq 'Running'){throw 'Legacy task did not stop.'}
 }
 $server=OwnedServer
 $tunnels=@(OwnedTunnels)
 $workers=@(Supervisors)
 if($workers.Count -gt 1){throw 'Multiple supervisors; refusing cleanup.'}
 foreach($w in $workers){Stop-Process -Id $w.ProcessId -Force -ErrorAction Stop}
 Start-Sleep -Milliseconds 600
 if($server){Stop-Process -Id $server.ProcessId -Force -ErrorAction Stop}
 foreach($t in $tunnels){Stop-Process -Id $t.ProcessId -Force -ErrorAction Stop}
 if(-not(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)){
  Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue
 }
 Write-Output 'STOP verified MCP components; other tasks unchanged.'
}
# Serialize Start / Stop / Restart from simultaneous GUI launches.
$controlMutex=[System.Threading.Mutex]::new($false,'Local\cokacremote-gui-lifecycle')
$lockHeld=$false
try {
 try{$lockHeld=$controlMutex.WaitOne(25000)}
 catch [System.Threading.AbandonedMutexException]{$lockHeld=$true}
 if(-not $lockHeld){throw 'Another GUI connection operation is in progress.'}
 switch($Action){
  'setup' {StartManual}
  'stop' {StopManual}
  'restart' {StopManual;Start-Sleep -Milliseconds 500;StartManual}
 }
} finally {
 if($lockHeld){$controlMutex.ReleaseMutex()}
 $controlMutex.Dispose()
}
