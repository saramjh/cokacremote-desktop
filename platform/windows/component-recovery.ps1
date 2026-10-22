# Reconciliation v2: only trusted, owned components may be reused.
function Is-CurrentOwner($p){
 if(-not $p -or -not $p.CommandLine){return $false}
 try{$o=Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction Stop
 return ($o.Domain+'\'+$o.User) -ieq ([Security.Principal.WindowsIdentity]::GetCurrent().Name)}catch{return $false}
}
function Find-OwnedServer {
 $l=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
 if(-not $l){return $null}
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$l.OwningProcess) -ErrorAction SilentlyContinue
 if(-not ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'dist[/\\]src[/\\]server\.js' -and (Is-CurrentOwner $p))){
   throw "Port $port is owned by an unverified process; will not replace it."
 }
 return Get-Process -Id $l.OwningProcess -ErrorAction Stop
}
function Find-OwnedTunnel {
 $all=@(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object {$_.CommandLine -and $_.CommandLine.Contains('http://127.0.0.1:3000')})
 $p=@($all | Where-Object {$_.CommandLine.Contains($tunnelLog)})
 if($all.Count -gt 1 -or $p.Count -ne $all.Count){throw 'Existing tunnel ownership is ambiguous; refuse duplicate start.'}
 if($p.Count -eq 0){return $null}
 if(-not(Is-CurrentOwner $p[0])){throw 'Quick Tunnel is not owned by the signed-in user.'}
 return Get-Process -Id $p[0].ProcessId -ErrorAction Stop
}
function Existing-Url{
 if(-not(Test-Path -LiteralPath $activeUrlFile)){return ''}
 $s=([IO.File]::ReadAllText($activeUrlFile)).Trim()
 if($s -match '^https://[a-z0-9-]+\.trycloudflare\.com/mcp$'){return $s.Substring(0,$s.Length-4)}
 return ''
}
function Local-Issuer{
 try{$m=Invoke-RestMethod 'http://127.0.0.1:3000/.well-known/oauth-authorization-server' -TimeoutSec 3 -ErrorAction Stop;return [string]$m.issuer}catch{return ''}
}

