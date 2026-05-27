# Empurra pra Bitbucket com branding Just incluido.
# Mantem GitHub sem qualquer referencia a Just (FlowDesk pessoal).
#
# Como funciona:
# 1. Cria branch local `bitbucket-main` a partir de origin/main (GitHub)
# 2. Force-add (-f) os arquivos gitignored com branding Just
# 3. Adiciona .gitignore-bitbucket que NAO ignora esses arquivos
# 4. Commita e push pra Bitbucket
# 5. Volta pra main (GitHub limpo)
#
# Uso: .\scripts\push-bitbucket.ps1

$ErrorActionPreference = "Stop"

# 1. Garante que remote Bitbucket existe
$remotes = git remote
if ($remotes -notcontains "bitbucket") {
  Write-Host "[setup] Adicionando remote bitbucket..." -ForegroundColor Yellow
  if (-not $env:BITBUCKET_REPO_URL) {
    Write-Host "BITBUCKET_REPO_URL nao definido. Ex: \$env:BITBUCKET_REPO_URL='https://bitbucket.org/<workspace>/<repo>.git'" -ForegroundColor Red
    exit 1
  }
  git remote add bitbucket $env:BITBUCKET_REPO_URL
}

# 2. Garante que main esta atualizada
Write-Host "[1/5] Atualizando main do GitHub..." -ForegroundColor Cyan
git fetch origin
git checkout main
git pull --ff-only origin main

# 3. Cria/atualiza branch bitbucket-main
Write-Host "[2/5] Preparando branch bitbucket-main..." -ForegroundColor Cyan
$exists = git branch --list bitbucket-main
if ($exists) {
  git branch -D bitbucket-main | Out-Null
  Write-Host "  Branch bitbucket-main antiga removida." -ForegroundColor DarkGray
}
git checkout -b bitbucket-main | Out-Null

# 4. Force-add dos arquivos gitignored com branding Just (skip se nao existir)
Write-Host "[3/5] Adicionando arquivos Just (force)..." -ForegroundColor Cyan
$brandFiles = @(
  'apps/web/src/config/branding.local.ts',
  'apps/web/public/just-logo.png',
  'apps/web/public/just-logo.svg'
)
foreach ($f in $brandFiles) {
  if (Test-Path $f) {
    git add -f $f
    Write-Host "  + $f" -ForegroundColor DarkGray
  } else {
    Write-Host "  - $f (nao existe, pulando)" -ForegroundColor Yellow
  }
}

if (git diff --cached --quiet) {
  Write-Host "  Nada novo pra commitar (Bitbucket ja tem o branding)." -ForegroundColor DarkGray
} else {
  git commit -m "chore(brand): branding Just (Bitbucket-only)"
  Write-Host "  Commit criado." -ForegroundColor Green
}

# 5. Push pra Bitbucket (forca, ja que bitbucket-main eh ramo dedicado)
Write-Host "[4/5] Push pra Bitbucket..." -ForegroundColor Cyan
git push -f bitbucket bitbucket-main:main

# 6. Volta pra main (GitHub continua limpo)
Write-Host "[5/5] Voltando pra main..." -ForegroundColor Cyan
git checkout main
git branch -D bitbucket-main

Write-Host ""
Write-Host "═══ Pronto ═══" -ForegroundColor Green
Write-Host "  GitHub (origin):     FlowDesk pessoal sem Just"
Write-Host "  Bitbucket (bitbucket): just-flow com branding Just"
Write-Host ""
Write-Host "Rode esse script sempre que quiser sincronizar mudancas do GitHub" -ForegroundColor DarkGray
Write-Host "pro Bitbucket mantendo o branding Just." -ForegroundColor DarkGray
