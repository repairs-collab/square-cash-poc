param(
    [switch]$NoBrowser
)

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) {
    $nodeCommand.Source
} else {
    Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    throw "Node.js was not found. Install Node.js 24 or run this harness from Codex Desktop."
}

$localUrl = "http://127.0.0.1:8787/"
$browserJob = $null

if (-not $NoBrowser) {
    $browserJob = Start-Job -ScriptBlock {
        param($url)
        Start-Sleep -Milliseconds 900
        Start-Process $url
    } -ArgumentList $localUrl
}

try {
    & $nodeExecutable (Join-Path $scriptDirectory "server.mjs")
} finally {
    if ($browserJob) {
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
}
