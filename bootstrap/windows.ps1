[CmdletBinding()]
param(
  [ValidateSet('Probe','Install')][string]$Action='Probe',
  [ValidateSet('node','cloudflared','git','cokacremote')][string]$Component='node',
  [switch]$Approved
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo=Join-Path $env:USERPROFILE 'MCPWorkspace\cokacremote'
$source='https://github.com/kstost/cokacremote.git'
$packages=@{node='OpenJS.NodeJS.LTS';cloudflared='Cloudflare.cloudflared';git='Git.Git'}
function Installed([string]$name) {
 switch($name) {
  'node' { return [bool]((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm.cmd -ErrorAction SilentlyContinue)) }
  'git' { return [bool](Get-Command git -ErrorAction SilentlyContinue) }
  'cloudflared' { return [bool](Get-Command cloudflared -ErrorAction SilentlyContinue) }
  'cokacremote' {
   if(-not (Test-Path -LiteralPath $repo -PathType Container)){return $false}
   return (Test-Path (Join-Path $repo 'package.json')) -and (Test-Path (Join-Path $repo 'dist\src\server.js'))
  }
 }
 return $false
}
function Summary {
 $items=foreach($name in @('node','git','cloudflared','cokacremote')){
  [ordered]@{name=$name;installed=[bool](Installed $name);package=if($packages.ContainsKey($name)){$packages[$name]}else{$source};source='official package registry / upstream GitHub'}
 }
 [ordered]@{platform='win32';arch=$env:PROCESSOR_ARCHITECTURE;packageManager=[bool](Get-Command winget.exe -ErrorAction SilentlyContinue);components=@($items);mcpRepo=$repo;mode='read-only inspection'}
}
if($Action -eq 'Probe'){
 Summary|ConvertTo-Json -Depth 5 -Compress
 exit 0
}
if(-not $Approved){throw 'Installation was NOT approved. Use -Approved only after showing the specific package and destination in the manager GUI.'}
if(Installed $Component){
 [ordered]@{result='REUSED';component=$Component}|ConvertTo-Json -Compress
 exit 0
}
if($Component -ne 'cokacremote'){
 if(-not (Get-Command winget.exe -ErrorAction SilentlyContinue)){throw 'Windows Package Manager is missing. Install it from Microsoft App Installer manually.'}
 $package=$packages[$Component]
 Write-Host ('Installing approved official package: '+$package)
 & winget.exe install --id $package --exact --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
 if($LASTEXITCODE -ne 0){throw ('Package manager failed, exit code '+$LASTEXITCODE)}
 # Windows may require a new process to receive updated PATH.
 [ordered]@{result='INSTALL_INVOKED';component=$Component;requiresReprobe=$true;note='Restart the manager if the command is not yet on PATH.'}|ConvertTo-Json -Compress
 exit 0
}
if(-not (Installed 'git') -or -not (Installed 'node')){throw 'Git, Node.js and npm must be available before installing cokacremote.'}
if(Test-Path -LiteralPath $repo){throw 'An existing cokacremote directory needs manual review. Installation will not overwrite it.'}
New-Item -ItemType Directory -Force -Path (Split-Path $repo -Parent)|Out-Null
& git.exe clone --depth 1 $source $repo
if($LASTEXITCODE -ne 0){throw 'Upstream clone failed'}
Push-Location $repo
try{
 & npm.cmd ci --no-audit --no-fund
 if($LASTEXITCODE -ne 0){throw 'npm dependency install failed'}
 & npm.cmd run build
 if($LASTEXITCODE -ne 0){throw 'Upstream server build failed'}
}finally{Pop-Location}
if(-not (Installed 'cokacremote')){throw 'Installed source failed build verification'}
[ordered]@{result='INSTALLED';component='cokacremote';requiresReprobe=$true}|ConvertTo-Json -Compress
