#Requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$InstallerPath)
$ErrorActionPreference='Stop'
$installer=(Resolve-Path -LiteralPath $InstallerPath).Path
$base=Join-Path $env:TEMP ('cokacremote-nsis-smoke-'+[guid]::NewGuid().ToString('N').Substring(0,10))
$target=Join-Path $base 'installed'
New-Item -ItemType Directory -Path $base -Force | Out-Null
$stdout=Join-Path $base 'installer.stdout.txt'
$stderr=Join-Path $base 'installer.stderr.txt'
$uninstaller=$null
try{
 $before=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
 $install=Start-Process -FilePath $installer -ArgumentList @('/S',('/D='+$target)) -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 if($null -eq $install.ExitCode -or $install.ExitCode -ne 0){throw "NSIS install failed with exit code $($install.ExitCode)"}
 $app=Join-Path $target 'cokacremote-control-desk.exe'
 $node=Join-Path $target 'resources\payload\runtime\bin\node.exe'
 $cloud=Join-Path $target 'resources\payload\runtime\bin\cloudflared.exe'
 foreach($file in @($app,$node,$cloud)){
  if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "Missing installed artifact: $file"}
 }
 if(((& $node --version) -join '') -ne 'v24.22.1'){throw 'Bundled Node runtime is wrong'}
 if(((& $cloud --version) -join '') -notmatch 'cloudflared version 2026\.10\.1\b'){throw 'Bundled cloudflared version is wrong'}
 $qaImage=Join-Path $base 'control-desk.png'
 $qaOut=Join-Path $base 'gui.stdout.txt'
 $qaErr=Join-Path $base 'gui.stderr.txt'
 $qa=Start-Process -FilePath $app -ArgumentList @('--qa-screenshot='+('"' + $qaImage + '"'),'--qa-language=ko') -WindowStyle Hidden -PassThru -Wait -WorkingDirectory $target -RedirectStandardOutput $qaOut -RedirectStandardError $qaErr
 if($null -eq $qa.ExitCode -or $qa.ExitCode -ne 0 -or -not(Test-Path $qaImage)){throw "Installed Electron UI QA failed. See $qaErr"}
 if((Get-Item $qaImage).Length -lt 10000){throw 'GUI screenshot unexpectedly small'}
 if(-not(Select-String -LiteralPath $qaOut -Pattern 'DESKTOP_QA_CAPTURED' -Quiet)){throw 'GUI capture marker missing'}
 $after=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
 if($before -ne $after){throw 'Installer unexpectedly modified the existing MCP listener'}
 $uninstaller=Get-ChildItem -LiteralPath $target -Filter 'Uninstall*.exe' -File | Select-Object -First 1 -ExpandProperty FullName
 if(-not $uninstaller){throw 'NSIS uninstaller missing'}
 $uninstall=Start-Process -FilePath $uninstaller -ArgumentList @('/S') -WindowStyle Hidden -PassThru -Wait
 if($null -eq $uninstall.ExitCode -or $uninstall.ExitCode -ne 0){throw 'NSIS uninstaller returned failure'}
 Start-Sleep -Seconds 2
 if(Test-Path $app){throw 'NSIS uninstall left the app executable'}
 Write-Output 'NSIS_INSTALL_APP_QA_UNINSTALL_PASSED'
}finally{
 if($uninstaller -and (Test-Path $uninstaller)){Start-Process -FilePath $uninstaller -ArgumentList @('/S') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue | Out-Null}
 Remove-Item -LiteralPath $base -Recurse -Force -ErrorAction SilentlyContinue
}
