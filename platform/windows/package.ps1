#Requires -Version 5.1
[CmdletBinding()]
param([switch]$ValidateOnly)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$version='0.5.0-rc.2'
$folder='cokacremote-manager-windows-'+$version
$filename=$folder+'-SOURCE-INSTALL.zip'
$allowed=@('INSTALL.cmd','LICENSE','README.md','package.json','package-lock.json',
           'assets','desktop','core','bootstrap','ui','platform\windows','test')
foreach($item in $allowed){
 if(-not(Test-Path -LiteralPath (Join-Path $root $item))){throw ('MISSING_PACKAGE_ASSET '+$item)}
}
if($ValidateOnly){
 & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $root 'platform\windows\install.ps1') -ValidateOnly
 if($LASTEXITCODE -ne 0){throw 'INSTALLER_VALIDATION_FAILED'}
 Write-Output 'WINDOWS_SOURCE_PACKAGE_INPUTS_VALID'
 return
}
$release=Join-Path $root 'release'
$temp=Join-Path $env:TEMP ('cokac-release-'+[guid]::NewGuid().ToString('N'))
$dest=Join-Path $temp $folder
$zip=Join-Path $release $filename
if(Test-Path -LiteralPath $zip){throw 'RELEASE_ALREADY_EXISTS'}
New-Item -ItemType Directory -Force $dest|Out-Null
try{
 foreach($item in $allowed){
  $from=Join-Path $root $item
  $to=Join-Path $dest $item
  New-Item -ItemType Directory -Force (Split-Path $to -Parent)|Out-Null
  Copy-Item -LiteralPath $from -Destination $to -Recurse
 }
 # Explicitly refuse potentially sensitive or accidentally nested host artifacts.
 $bad=Get-ChildItem $dest -Recurse -File|Where-Object {
   $_.Name -match '^(?:\._|\.env$)|\.(?:pem|p12|key|db|sqlite|log)$' -or
   $_.FullName -match '(\\|/)(?:node_modules|\.git|\.context|\.qa-|release)(\\|/)'
 }
 if($bad){throw ('DISALLOWED_ARTIFACT: '+$bad[0].FullName)}
 New-Item $release -ItemType Directory -Force|Out-Null
 Compress-Archive -LiteralPath $dest -DestinationPath $zip -CompressionLevel Optimal
 Write-Output ('WINDOWS_PACKAGE_CREATED '+$zip)
 (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash
}finally{
 Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
