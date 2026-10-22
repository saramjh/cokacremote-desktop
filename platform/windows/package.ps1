#Requires -Version 5.1
# Package upstream MCP source, existing Windows supervisor and GUI by allowlist only.
$ErrorActionPreference='Stop'
$repo=Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$stage=Join-Path $env:TEMP ('cokacremote-gui-'+[guid]::NewGuid().ToString('N'))
$payload=Join-Path $stage 'cokacremote'
$dest=Join-Path $repo 'release'
$zip=Join-Path $dest 'cokacremote-windows-manager-v0.2.0.zip'
if(Test-Path $zip){throw 'Release ZIP already exists. Refusing overwrite.'}
New-Item -ItemType Directory -Path $payload -Force|Out-Null
try{
 foreach($item in @('package.json','package-lock.json','tsconfig.json','LICENSE','README.md','.gitignore')){
  $f=Join-Path $repo $item;if(Test-Path -LiteralPath $f){Copy-Item -LiteralPath $f -Destination $payload}
 }
 foreach($dir in @('src','dist','test')){
  $f=Join-Path $repo $dir;if(Test-Path -LiteralPath $f){Copy-Item -LiteralPath $f -Destination $payload -Recurse}
 }
 New-Item -ItemType Directory -Path (Join-Path $payload 'deploy') -Force|Out-Null
 Copy-Item -LiteralPath (Join-Path $repo 'deploy\windows') -Destination (Join-Path $payload 'deploy') -Recurse
 $runtime=Join-Path $payload 'deploy\windows\manager-v2\node_modules'
 if(Test-Path -LiteralPath $runtime){Remove-Item -LiteralPath $runtime -Recurse -Force -ErrorAction Stop}
 foreach($f in @('qa-screen.png','qa-log.txt','qa-error.txt')){Remove-Item -LiteralPath (Join-Path $payload ('deploy\windows\manager-v2\'+$f)) -Force -ErrorAction SilentlyContinue}
 Get-ChildItem -LiteralPath $payload -Recurse -File | Where-Object {
  $_.Name -match '\.(bak|log|key|pem|p12|db)$' -or
  $_.Name -eq '.env' -or $_.Name -eq 'oauth-approval-key'
 } | Remove-Item -Force
 $vbs=@'
Option Explicit
Dim fso, base, script, sh, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
script = fso.BuildPath(base, "cokacremote\deploy\windows\gui\install.ps1")
If Not fso.FileExists(script) Then
  MsgBox "Missing installer: " & script, vbExclamation, "cokacremote"
  WScript.Quit 1
End If
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File """ & script & """"
sh.Run cmd, 0, False
'@
 [IO.File]::WriteAllText((Join-Path $stage 'INSTALL.vbs'),$vbs)
 $cmd='@echo off'+[Environment]::NewLine+'start "" wscript.exe "%~dp0INSTALL.vbs"'+[Environment]::NewLine
 [IO.File]::WriteAllText((Join-Path $stage 'INSTALL.cmd'),$cmd)
 New-Item -ItemType Directory -Path $dest -Force|Out-Null
 Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
 Write-Output ('ZIP='+$zip)
 Write-Output ('SHA256='+(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash)
 Write-Output ('BYTES='+(Get-Item -LiteralPath $zip).Length)
}finally{
 Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
