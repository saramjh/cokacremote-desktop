#Requires -Version 5.1
# GUI bootstrap for the EXISTING Windows cokacremote source and supervisor.
param([switch]$ValidateOnly,[switch]$Silent)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$payload = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$destination=Join-Path $HOME 'MCPWorkspace\cokacremote'
$installLog=Join-Path $env:TEMP 'cokacremote-gui-install.log'
if($ValidateOnly){
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'package.json'))){throw 'Missing packaged package.json'}
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'deploy\windows\cokacremote.ps1'))){throw 'Missing existing controller'}
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'deploy\windows\gui\manager.ps1'))){throw 'Missing GUI manager'}
 Write-Output 'ONE_CLICK_INSTALL_PACKAGE_VALID'
 return
}
$form=New-Object Windows.Forms.Form
$form.Text='Install cokacremote MCP Manager'
$form.Width=625;$form.Height=252;$form.StartPosition='CenterScreen'
$form.BackColor=[Drawing.ColorTranslator]::FromHtml('#172631')
$form.ForeColor=[Drawing.Color]::White
$form.Font=New-Object Drawing.Font('Segoe UI',10)
$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false
$title=New-Object Windows.Forms.Label
$title.Text='cokacremote / Windows one-click setup'
$title.Location=New-Object Drawing.Point(24,22);$title.AutoSize=$true
$title.Font=New-Object Drawing.Font('Segoe UI',15,[Drawing.FontStyle]::Bold)
$form.Controls.Add($title)
$label=New-Object Windows.Forms.Label
$label.Text='Preparing installer...'
$label.Location=New-Object Drawing.Point(25,76);$label.Size=New-Object Drawing.Size(560,74)
$form.Controls.Add($label)
$bar=New-Object Windows.Forms.ProgressBar
$bar.Style='Marquee';$bar.Location=New-Object Drawing.Point(25,158)
$bar.Size=New-Object Drawing.Size(558,17)
$form.Controls.Add($bar)
if(-not $Silent){$form.Show();[Windows.Forms.Application]::DoEvents()}
function Step([string]$text){if($Silent){Write-Output $text;return};$label.Text=$text;$form.Refresh();[Windows.Forms.Application]::DoEvents()}
function Msg([string]$text,[string]$caption='cokacremote installation'){
 [Windows.Forms.MessageBox]::Show($form,$text,$caption,[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information)|Out-Null
}
function Ask([string]$text){
 return [Windows.Forms.MessageBox]::Show($form,$text,'Install prerequisite?',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Question) -eq [Windows.Forms.DialogResult]::Yes
}
function Reload-Path(){
 $env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
}
function Run-Installer($binary,$arguments,$workdir){
 $out=$installLog;$err=$installLog+'.err'
 Remove-Item $out,$err -Force -ErrorAction SilentlyContinue
 $p=Start-Process -FilePath $binary -ArgumentList $arguments -WorkingDirectory $workdir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
 while(-not $p.HasExited){
  Start-Sleep -Milliseconds 250
  [Windows.Forms.Application]::DoEvents()
  $p.Refresh()
 }
 $p.Refresh()
 $p.WaitForExit()
 $p.Refresh()
 $code=$p.ExitCode
 if($null -eq $code -or $code -ne 0){throw "Installation subprocess exited with status $code. Inspect $out and $err"}
 if((Test-Path $out) -and (Select-String -LiteralPath $out -Pattern 'SETUP FAILED:' -Quiet)){throw ('Supervisor reported setup failure. See '+$out)}
}
function Ensure-Program($command,$wingetID){
 if(Get-Command $command -ErrorAction SilentlyContinue){return}
 Step "$command is not installed. Preparing its prerequisite installer."
 if(-not(Ask "$command is required. Install it through winget ($wingetID)?")){throw "$command missing; installation was cancelled."}
 $winget=Get-Command winget -ErrorAction SilentlyContinue
 if(-not $winget){throw 'winget is not installed. Install this prerequisite from the official vendor, then retry.'}
 Run-Installer $winget.Source @('install','-e','--id',$wingetID,'--accept-package-agreements','--accept-source-agreements') $env:TEMP
 Reload-Path
 if(-not(Get-Command $command -ErrorAction SilentlyContinue)){throw "$command installed but not yet available on PATH. Sign out and sign in, then retry."}
}
try{
 Step 'Checking distribution source and existing installation...'
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'package.json'))){throw 'Package contents are incomplete.'}
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'deploy\windows\manager-v2\main.cjs'))){throw 'Desktop manager source is missing.'}
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'deploy\windows\manager-v2\package-lock.json'))){throw 'Desktop runtime lockfile is missing.'}
 if(-not(Test-Path -LiteralPath (Join-Path $payload 'deploy\windows\component-recovery.ps1'))){throw 'Existing service recovery component is missing.'}
 if(Test-Path -LiteralPath $destination){
  Step 'An existing installation was found. Preserving its files and credentials.'
  if(-not(Test-Path -LiteralPath (Join-Path $destination 'deploy\windows\MCP-MANAGER.vbs'))){throw "Existing installation is not this GUI version. Back it up and perform a controlled upgrade: $destination"}
  # Upgrade only GUI source/resources. Never replace a running MCP server, scheduled task, OAuth state or tunnel.
  $sourceUi=Join-Path $payload 'deploy\windows\manager-v2'
  $targetUi=Join-Path $destination 'deploy\windows\manager-v2'
  if(-not(Test-Path -LiteralPath (Join-Path $targetUi 'main.cjs'))){throw 'Existing desktop UI is not recognized; refusing an unsafe upgrade.'}
  Step 'Updating the desktop interface and translations without restarting the MCP server...'
  foreach($relative in @('ui','test')){
   $sourceDir=Join-Path $sourceUi $relative
   if(Test-Path $sourceDir){
    Get-ChildItem -LiteralPath $sourceDir -Recurse -File | ForEach-Object {
     $part=$_.FullName.Substring($sourceUi.Length).TrimStart([char]92)
     $targetFile=Join-Path $targetUi $part
     New-Item -ItemType Directory -Path (Split-Path $targetFile -Parent) -Force|Out-Null
     Copy-Item -LiteralPath $_.FullName -Destination $targetFile -Force
    }
   }
  }
  foreach($relative in @('preload.cjs','main.cjs','package.json','package-lock.json')){
   $src=Join-Path $sourceUi $relative
   if(Test-Path $src){Copy-Item -LiteralPath $src -Destination (Join-Path $targetUi $relative) -Force}
  }
 }else{
  $parent=Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $parent -Force|Out-Null
  Step 'Installing application files under the user MCPWorkspace...'
  Copy-Item -LiteralPath $payload -Destination $destination -Recurse -ErrorAction Stop
 }
 Ensure-Program 'node' 'OpenJS.NodeJS.LTS'
 Ensure-Program 'cloudflared' 'Cloudflare.cloudflared'
 Ensure-Program 'npm.cmd' 'OpenJS.NodeJS.LTS'
 $nodeMajor=[int]((& node -p "process.versions.node.split('.')[0]") -join '')
 if($nodeMajor -lt 22){throw 'Node.js 22+ is required.'}
 if(-not(Test-Path -LiteralPath (Join-Path $destination 'node_modules\@modelcontextprotocol\sdk'))){
  Step 'Installing dependencies (npm ci)...'
  Run-Installer (Get-Command npm.cmd).Source @('ci','--no-fund') $destination
 }
 Step 'Checking/building the existing Windows MCP server...'
 if(-not(Test-Path -LiteralPath (Join-Path $destination 'dist\src\server.js'))){
  Run-Installer (Get-Command npm.cmd).Source @('run','build') $destination
 }
 $manager=Join-Path $destination 'deploy\windows\manager-v2'
 $electron=Join-Path $manager 'node_modules\electron\dist\electron.exe'
 if(-not(Test-Path -LiteralPath (Join-Path $manager 'package-lock.json'))){throw 'Desktop manager lockfile missing.'}
 if(-not(Test-Path -LiteralPath $electron)){
  Step 'Installing independent Electron desktop runtime...'
  Run-Installer (Get-Command npm.cmd).Source @('ci','--no-fund','--no-audit') $manager
  if(-not(Test-Path -LiteralPath $electron)){
   Step 'Installing desktop runtime binary...'
   Run-Installer (Get-Command node).Source @('node_modules\electron\install.js') $manager
  }
  if(-not(Test-Path -LiteralPath $electron)){throw 'Electron desktop runtime is not installed; setup cannot continue.'}
 }
 Step 'Checking existing MCP and Quick Tunnel before making any changes...'
 $keepExisting=$false
 $needsManualReview=$false
 $ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 $statusScript=Join-Path $destination 'deploy\windows\gui\status.ps1'
 if(Test-Path $statusScript){
  try{
   $probeResult=& $ps -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $statusScript -VerifyRemote 2>$null|ConvertFrom-Json
   if(($probeResult.serverAlive -and -not $probeResult.serverOwned) -or ($probeResult.tunnelAlive -and -not $probeResult.tunnelOwned)){
    throw 'An unverified listener or tunnel is running. Refusing to replace it.'
   }
   $keepExisting=($probeResult.serverOwned -eq $true -or $probeResult.tunnelOwned -eq $true)
   $needsManualReview=($keepExisting -and -not($probeResult.serverOwned -and $probeResult.tunnelOwned -and $probeResult.local -eq 'HEALTHY' -and $probeResult.public -eq 'HEALTHY' -and $probeResult.oauth -eq 'HEALTHY' -and $probeResult.authorization -eq 'AUTH_REQUIRED'))
  }catch{
   if($_.Exception.Message -like '*unverified listener*'){throw}
   # A diagnostic failure is not permission to replace live processes.
   $listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
   if($listener){throw 'Cannot verify existing MCP listener. Installation paused; use manager diagnostics.'}
   throw 'Cannot verify existing service state. Installation paused without modifying the tunnel.'
  }
 }
 if($keepExisting){
  if($needsManualReview){Step 'Existing managed processes detected. Preserving them; verify degraded state from the GUI.'}
  else{Step 'Existing MCP server, Quick Tunnel and OAuth verified. Preserving the connection.'}
 }else{
  Step 'Starting existing Windows MCP/OAuth/Quick Tunnel supervisor...'
  $ctrl=Join-Path $destination 'deploy\windows\cokacremote.ps1'
  $ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  Run-Installer $ps @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$ctrl+'"'),'-Action','setup','-HideApprovalKey') $destination
 }
 Step 'Creating a one-click desktop shortcut...'
 try{ & (Join-Path $destination 'deploy\windows\gui\shortcut.ps1') | Out-Null }catch{ $label.Text='Shortcut not created; the GUI launcher in deploy\windows remains usable.' }
 Step 'Opening the connection manager...'
 $bar.Style='Continuous';$bar.Value=100
 if(-not $Silent){Start-Process -FilePath wscript.exe -ArgumentList @('"' + (Join-Path $destination 'deploy\windows\MCP-MANAGER.vbs') + '"')}
 if($Silent){Write-Output 'INSTALLER_SUCCESS_EXISTING_OR_STARTED'}else{Msg 'Installation and verified MCP startup completed. The GUI displays the live tunnel address, health and OAuth approval-key copy control. ChatGPT registration is the final manual step.'}
} catch {
 $bar.Style='Continuous';$bar.Value=0
 if($Silent){throw}else{Msg ('Setup incomplete: '+$_.Exception.Message+[Environment]::NewLine+[Environment]::NewLine+'See '+$installLog+' for details.')}
}finally{
 $form.Close();$form.Dispose()
}
