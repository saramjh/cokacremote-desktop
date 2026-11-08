#Requires -Version 5.1
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$UpstreamRoot,
 [Parameter(Mandatory=$true)][string]$NodeExecutable,
 [Parameter(Mandatory=$true)][string]$CloudflaredExecutable
)
$ErrorActionPreference='Stop'
$app=$PSScriptRoot
$payload=Join-Path $app 'payload'
$logDir=Join-Path $app 'release-build-logs'
if(Test-Path -LiteralPath $payload){Remove-Item -LiteralPath $payload -Recurse -Force}
New-Item -ItemType Directory -Path $payload,$logDir -Force | Out-Null
function Take([string]$from,[string]$rel){
 if(-not(Test-Path -LiteralPath $from)){throw "Required input missing: $from"}
 $to=Join-Path $payload $rel
 New-Item -ItemType Directory -Path (Split-Path -Parent $to) -Force | Out-Null
 Copy-Item -LiteralPath $from -Destination $to -Force -Recurse -ErrorAction Stop
}
function Run([string]$exe,[string[]]$argumentList,[string]$cwd,[string]$label){
 $out=Join-Path $logDir ($label+'.out.txt')
 $err=Join-Path $logDir ($label+'.err.txt')
 $p=Start-Process -FilePath $exe -ArgumentList $argumentList -WorkingDirectory $cwd -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
 if($null -eq $p.ExitCode -or $p.ExitCode -ne 0){
  Get-Content -LiteralPath $out -Tail 20 -ErrorAction SilentlyContinue
  Get-Content -LiteralPath $err -Tail 20 -ErrorAction SilentlyContinue
  throw "Build step $label failed with exit code $($p.ExitCode)"
 }
}
$upstream=(Resolve-Path -LiteralPath $UpstreamRoot).Path
$node=(Resolve-Path -LiteralPath $NodeExecutable).Path
$cloud=(Resolve-Path -LiteralPath $CloudflaredExecutable).Path
$nodeVersion=(& $node --version) -join ''
if($nodeVersion -ne 'v24.22.1'){throw "Expected Node v24.22.1, got $nodeVersion"}
$cloudVersion=(& $cloud --version) -join ''
if($cloudVersion -notmatch 'cloudflared version 2026\.10\.1\b'){throw "Unexpected cloudflared version $cloudVersion"}
foreach($file in @('package.json','package-lock.json','LICENSE')){Take (Join-Path $upstream $file) $file}
Take (Join-Path $upstream 'dist') 'dist'
if(-not(Test-Path -LiteralPath (Join-Path $payload 'dist\src\server.js'))){throw 'Compiled MCP server missing; build upstream first'}
$npm=Get-Command npm.cmd -ErrorAction Stop
Run $npm.Source @('ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund') $payload 'npm-production'
$service=Join-Path $app 'service'
$serviceDest=Join-Path $payload 'deploy\windows'
New-Item -ItemType Directory $serviceDest -Force | Out-Null
foreach($child in Get-ChildItem -LiteralPath $service -Force){
 Copy-Item -LiteralPath $child.FullName -Destination $serviceDest -Recurse -Force
}
Take $node 'runtime\bin\node.exe'
Take $cloud 'runtime\bin\cloudflared.exe'
$licenseDir=Join-Path $payload 'runtime\licenses'
New-Item -ItemType Directory $licenseDir -Force|Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.22.1/LICENSE' -OutFile (Join-Path $licenseDir 'node-LICENSE') -TimeoutSec 45
Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/cloudflare/cloudflared/master/LICENSE' -OutFile (Join-Path $licenseDir 'cloudflared-LICENSE') -TimeoutSec 45
if((Get-Item (Join-Path $licenseDir 'node-LICENSE')).Length -lt 200){throw 'Node license missing'}
if((Get-Item (Join-Path $licenseDir 'cloudflared-LICENSE')).Length -lt 200){throw 'Cloudflared license missing'}
Run $node @('--check',(Join-Path $payload 'dist\src\server.js')) $payload 'server-syntax'
$required=@(
 'runtime\bin\node.exe','runtime\bin\cloudflared.exe',
 'dist\src\server.js','node_modules\@modelcontextprotocol\sdk\package.json',
 'deploy\windows\start-cokacremote.ps1','deploy\windows\manual-control.ps1',
 'deploy\windows\gui\status.ps1','deploy\windows\component-recovery.ps1'
)
foreach($file in $required){if(-not(Test-Path -LiteralPath (Join-Path $payload $file) -PathType Leaf)){throw "Staging payload incomplete: $file"}}
foreach($file in Get-ChildItem -LiteralPath $serviceDest -Recurse -Filter '*.ps1' -File){
 $tokens=$null;$errors=$null
 $null=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)
 if($errors.Count){throw "Script parse error in $($file.Name): $($errors[0].Message)"}
}
$bad=@(Get-ChildItem -LiteralPath $payload -Recurse -File -Force | Where-Object {
 $_.Name -eq '.env' -or $_.Name -eq 'oauth-approval-key' -or
 $_.Name -match '\.(pem|p12|key|db|bak|log)$'
})
if($bad.Count){throw 'A credential-like file was found in the payload.'}
Write-Output ('STANDALONE_PAYLOAD_READY: Node='+$nodeVersion+', cloudflared='+$cloudVersion)
Write-Output ('PAYLOAD_FILE_COUNT='+(Get-ChildItem -LiteralPath $payload -Recurse -File | Measure-Object).Count)
