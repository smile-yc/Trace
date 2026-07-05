param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("backend", "frontend")]
  [string] $Target
)

$ErrorActionPreference = "Stop"

if ($env:CODEX_NODE_BIN) {
  $env:Path = "$env:CODEX_NODE_BIN;$env:Path"
}

if ($env:CODEX_BIN) {
  $env:Path = "$env:CODEX_BIN;$env:Path"
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($Target -eq "backend") {
  pnpm --filter "@trace-report/backend" dev
} else {
  pnpm --filter "@trace-report/frontend" dev
}
