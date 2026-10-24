#Requires -Version 5.1
[CmdletBinding()]
param([switch]$ValidateOnly,[switch]$ProbeOnly)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$core=Join-Path $HOME 'MCPWorkspace\cokacremote'
$boot=Join-Path $root 'bootstrap\windows.ps1'
$controller=Join-Path $core 'deploy\windows\cokacremote.ps1'
$probe=Join-Path $root 'platform\windows\status.ps1'
$required=@('package.json','package-lock.json','desktop\main.cjs','desktop\preload.cjs',
 'ui\index.html','ui\app.js','bootstrap\windows.ps1',
 'platform\windows\supervisor\cokacremote.ps1',
 'platform\windows\supervisor\install-autostart.ps1')
foreach($name in $required){
 if(-not(Test-Path -LiteralPath (Join-Path $root $name) -PathType Leaf)){throw ('PACKAGE_INCOMPLETE '+$name)}
}
if($ValidateOnly){Write-Output 'FIRST_RUN_PACKAGE_VALID';return}
function Refresh-Path {
 $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+
           [Environment]::GetEnvironmentVariable('Path','User')
}
function Have([string]$name){return [bool](Get-Command $name -ErrorAction SilentlyContinue)}
function InstalledCore {
 return (Test-Path -LiteralPath $controller -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $core 'dist\src\server.js') -PathType Leaf)
}
Refresh-Path
if($ProbeOnly){
 @{node=(Have 'node');npm=(Have 'npm.cmd');git=(Have 'git');cloudflared=(Have 'cloudflared');
   winget=(Have 'winget.exe');coreInstalled=(InstalledCore);packageValid=$true} | ConvertTo-Json -Compress
 return
}
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.Application]::EnableVisualStyles()
function Approve([string]$description){
 return [Windows.Forms.MessageBox]::Show($description,'cokacremote Manager — Approval',
  [Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Question) -eq [Windows.Forms.DialogResult]::Yes
}
function Info([string]$message){
 [Windows.Forms.MessageBox]::Show($message,'cokacremote Manager',
  [Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information)|Out-Null
}
function Step([string]$message){Write-Host ('[cokacremote] '+$message)}
function Run([string]$bin,[string[]]$argv,[string]$cwd){
 Push-Location $cwd
 try{
  & $bin @argv
  if($LASTEXITCODE -ne 0){throw ('FAILED '+[IO.Path]::GetFileName($bin)+' exit='+$LASTEXITCODE)}
 }finally{Pop-Location}
}
$packages=@{node='OpenJS.NodeJS.LTS';git='Git.Git';cloudflared='Cloudflare.cloudflared'}
try{
 Step 'Checking installed tools and existing connections...'
 foreach($component in @('node','git','cloudflared')){
  if(Have $component){Step ('Reusing '+$component);continue}
  $package=$packages[$component]
  if(-not(Have 'winget.exe')){throw 'Windows App Installer (winget) missing. Install from Microsoft and retry.'}
  $message=('Missing: '+$component+[Environment]::NewLine+
    'Source: Windows Package Manager'+[Environment]::NewLine+
    'Package: '+$package+[Environment]::NewLine+'Approve downloading and installing this free component?')
  if(-not(Approve $message)){throw ('USER_DECLINED_'+$component)}
  Step ('Installing approved '+$package)
  Run 'winget.exe' @('install','--exact','--id',$package,'--accept-source-agreements',
      '--accept-package-agreements','--disable-interactivity') $env:TEMP
  Refresh-Path
  if(-not(Have $component)){throw ($component+' installed but not yet on PATH. Sign out and back in, then retry.')}
 }
 if(-not(Have 'npm.cmd')){throw 'npm is unavailable after Node installation. Sign out and retry.'}
 if(-not(InstalledCore)){
  if(Test-Path -LiteralPath $core){throw ('Existing incomplete core is preserved for manual review: '+$core)}
  $message=('MCP core is not installed.'+[Environment]::NewLine+
      'Source: https://github.com/kstost/cokacremote.git'+[Environment]::NewLine+
      'Destination: '+$core+[Environment]::NewLine+
      'Approve cloning the source, installing locked npm packages, building,'+
      ' and copying the bundled supervisor scripts?')
  if(-not(Approve $message)){throw 'USER_DECLINED_CORE'}
  Step 'Installing approved upstream MCP core...'
  Run 'powershell.exe' @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',
     $boot,'-Action','Install','-Component','cokacremote','-Approved') $root
  if(-not(InstalledCore)){throw 'CORE_BUILD_INCOMPLETE'}
 }
 $electron=Join-Path $root 'node_modules\electron\dist\electron.exe'
 if(-not(Test-Path -LiteralPath $electron -PathType Leaf)){
  $message=('Electron desktop runtime is missing.'+[Environment]::NewLine+
    'Source: npm packages in package-lock.json'+[Environment]::NewLine+
    'Destination: '+(Join-Path $root 'node_modules')+[Environment]::NewLine+
    'Approve installing the pinned manager dependencies?')
  if(-not(Approve $message)){throw 'USER_DECLINED_DESKTOP'}
  Step 'Installing approved desktop packages...'
  Run 'npm.cmd' @('ci','--no-audit','--no-fund') $root
  if(-not(Test-Path -LiteralPath $electron -PathType Leaf)){throw 'ELECTRON_RUNTIME_UNAVAILABLE'}
 }
 $state=& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $probe -VerifyRemote |
   ConvertFrom-Json
 if($state.serverAlive -or $state.tunnelAlive){
  if(-not($state.serverOwned -and $state.tunnelOwned)){
    throw 'UNVERIFIED_EXISTING_PROCESS: No process has been replaced.'
  }
  Step 'Reusing existing managed server and tunnel; no restart.'
 }else{
  if(-not(Approve 'Start the approved Windows MCP supervisor and Quick Tunnel now?')){throw 'USER_DECLINED_START'}
  Step 'Starting existing Windows supervisor...'
  Run 'powershell.exe' @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',
    $controller,'-Action','setup','-HideApprovalKey') $root
 }
 Step 'Opening desktop Manager...'
 Start-Process -FilePath $electron -ArgumentList ('"'+$root+'"') -WorkingDirectory $root
 Info 'Manager launched. Verify OAuth and complete ChatGPT connection in the app. Closing the window does not stop services.'
}catch{
 Step ('Incomplete: '+$_.Exception.Message)
 Info ('Installation incomplete without intentionally stopping foreign services.'+[Environment]::NewLine+
       'Reason: '+$_.Exception.Message)
 exit 1
}
