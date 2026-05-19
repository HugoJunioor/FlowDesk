# Inicia FlowDesk local com sync ativo.
# Le SLACK_BOT_TOKEN do .env e injeta na sessao,
# garantindo sobrepor qualquer valor persistente (User/Machine env).

$envFile = Join-Path $PSScriptRoot '..\.env'
if (Test-Path $envFile) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^SLACK_BOT_TOKEN=' } | Select-Object -First 1
  if ($line) {
    $token = $line -replace '^SLACK_BOT_TOKEN=', ''
    $env:SLACK_BOT_TOKEN = $token
    Write-Host ('[ok] SLACK_BOT_TOKEN setado (prefixo: ' + $token.Substring(0,8) + '...)') -ForegroundColor Green
  } else {
    Write-Host '[warn] SLACK_BOT_TOKEN nao encontrado no .env — sync vai falhar' -ForegroundColor Yellow
  }
} else {
  Write-Host '[erro] .env nao encontrado na raiz do projeto' -ForegroundColor Red
  exit 1
}

Write-Host '[run] npm run dev:all -w @flowdesk/web' -ForegroundColor Cyan
npm run dev:all -w '@flowdesk/web'
