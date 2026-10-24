#Requires -Version 5.1
# Patch only the Unix-specific shell argument array in exec_command.
# Compatible with the public checkout and the Mac local context-guard variant.
$ErrorActionPreference = 'Stop'
$repo = Join-Path $HOME 'MCPWorkspace\cokacremote'
$source = Join-Path $repo 'src\exec-tools.ts'
if (-not (Test-Path -LiteralPath $source)) { throw "Missing source: $source" }
Set-Location -LiteralPath $repo

$contents = [System.IO.File]::ReadAllText($source)
$old = '          args: [login ? "-lc" : "-c", cmd],'
$new = @'
          args: process.platform === "win32" &&
            /(?:^|[\\/])(?:powershell|pwsh)(?:\.exe)?$/i.test(executable)
            ? ["-NoProfile", "-NonInteractive", "-Command", cmd]
            : [login ? "-lc" : "-c", cmd],
'@
$new = $new.TrimEnd("`r", "`n")
$already = '          args: process.platform === "win32" &&'
$previousPatch = '          args: executionArgs,'

$v2Patched = $contents.Contains($already) -and
    $contents.Contains('            ? ["-NoProfile", "-NonInteractive", "-Command", cmd]') -and
    $contents.Contains('            : [login ? "-lc" : "-c", cmd],')
$v4Patched = $contents.Contains($previousPatch) -and
    $contents.Contains('const executionArgs = isWindowsPowerShell') -and
    $contents.Contains('["-NoProfile", "-NonInteractive", "-Command", cmd]')

if ($v2Patched -or $v4Patched) {
    Write-Host 'Windows command-line compatibility patch already present.'
} elseif ($contents.Contains($old)) {
    $first = $contents.IndexOf($old)
    if ($contents.IndexOf($old, $first + $old.Length) -ge 0) {
        throw 'Ambiguous source: more than one shell argument location. No edits made.'
    }
    $backup = "$source.before-win32-patch.bak"
    if (-not (Test-Path -LiteralPath $backup)) {
        [System.IO.File]::Copy($source, $backup)
    }
    $patched = $contents.Replace($old, $new)
    [System.IO.File]::WriteAllText($source, $patched, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Patched Windows PowerShell invocation. Backup: $backup"
} else {
    throw 'Windows shell invocation not recognized. No edits made; inspect src/exec-tools.ts.'
}

& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed after patch.' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed after patch.' }
& npm.cmd audit --omit=dev
if ($LASTEXITCODE -ne 0) { throw 'Production npm audit not clean; do not expose remote MCP.' }
Write-Host 'Windows patch, build and production dependency audit passed.'
