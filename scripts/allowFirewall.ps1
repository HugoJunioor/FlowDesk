# Permite conexoes externas na porta 8080 do Windows Firewall.
# EXECUTE COMO ADMINISTRADOR (1 vez apenas)

$ruleName = "FlowDesk Dev Server (8080)"

# Verifica se esta rodando como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "[ERRO] Este script precisa ser executado como Administrador." -ForegroundColor Red
    Write-Host ""
    Write-Host "Como abrir o PowerShell como Admin:" -ForegroundColor Yellow
    Write-Host "  1. Menu Iniciar > digite 'PowerShell'" -ForegroundColor Yellow
    Write-Host "  2. Clique direito em 'Windows PowerShell'" -ForegroundColor Yellow
    Write-Host "  3. Escolha 'Executar como administrador'" -ForegroundColor Yellow
    Write-Host "  4. Na nova janela, rode de novo:" -ForegroundColor Yellow
    Write-Host "       cd '$($PSScriptRoot)\..'" -ForegroundColor Cyan
    Write-Host "       .\scripts\allowFirewall.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Remove regra antiga se existir
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

# Cria nova regra
try {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Any -Description "Permite acesso ao dev server do FlowDesk via VPN/LAN" -ErrorAction Stop | Out-Null

    Write-Host ""
    Write-Host "[OK] Regra de firewall criada: $ruleName" -ForegroundColor Green
    Write-Host "     Porta 8080 agora aceita conexoes externas (VPN/LAN)." -ForegroundColor Green
    Write-Host ""
    Write-Host "Para remover no futuro, rode como admin:" -ForegroundColor Yellow
    Write-Host "  Remove-NetFirewallRule -DisplayName ""$ruleName""" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "[ERRO] Falha ao criar regra de firewall: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
