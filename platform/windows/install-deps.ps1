#Requires -Version 5.1
[CmdletBinding()]
param([switch]$Consent,[string]$ApprovedMissingCsv='', [switch]$ProbeOnly)
$ErrorActionPreference='Stop'
$required=@('node','npm.cmd','git','cloudflared')
$ids=@{node='OpenJS.NodeJS.LTS';'npm.cmd'='OpenJS.NodeJS.LTS';git='Git.Git';cloudflared='Cloudflare.cloudflared'}
function Refresh-Path {
 $env:Path=([Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'))
}
function Missing {
 return @($required|Where-Object {-not(Get-Command $_ -ErrorAction SilentlyContinue)})
}
$before=@(Missing)
if($ProbeOnly){@{missing=$before;ready=$before.Count -eq 0;winget=[bool](Get-Command winget -ErrorAction SilentlyContinue)}|ConvertTo-Json -Compress;return}
if(-not $Consent){throw 'DEPENDENCY_CONSENT_REQUIRED'}
if($ApprovedMissingCsv -match '[^a-zA-Z0-9.,_-]'){throw 'UNRECOGNIZED_DEPENDENCY_LIST'}
$approved=if($ApprovedMissingCsv){@($ApprovedMissingCsv.Split(','))}else{@()}
if((@($approved) -join ',') -cne (@($before) -join ',')){throw 'DEPENDENCY_PLAN_CHANGED'}
if(@($approved|Where-Object {$_ -notin $required}).Count -gt 0){throw 'UNRECOGNIZED_PACKAGE'}
if($before.Count -and -not(Get-Command winget -ErrorAction SilentlyContinue)){throw 'WINGET_NOT_AVAILABLE'}
$unique=@($before|ForEach-Object {$ids[$_]}|Select-Object -Unique)
foreach($id in $unique) {
 Write-Output ('INSTALLING '+$id)
 & winget.exe install --id $id --exact --accept-package-agreements --accept-source-agreements --disable-interactivity
 if($LASTEXITCODE -ne 0){throw ('INSTALL_FAILED '+$id+' exit '+$LASTEXITCODE)}
 Refresh-Path
}
Refresh-Path
$after=@(Missing)
if($after.Count){throw ('DEPENDENCIES_STILL_MISSING '+($after -join ','))}
Write-Output 'DEPENDENCIES_VERIFIED'
