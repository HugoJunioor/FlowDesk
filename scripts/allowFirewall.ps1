# Permite conexoes externas na porta 8080 do Windows Firewall.
# EXECUTE COMO ADMINISTRADOR (1 vez apenas)
#
# Uso:
#   Clique direito em allowFirewall.ps1 > "Executar com PowerShell" (como admin)
#   OU no PowerShell admin: .\scripts\allowFirewall.ps1

$ruleName = "FlowDesk Dev Server (8080)"

# Remove regra antiga se existir
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

# Cria nova regra permitindo TCP 8080 inbound
New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8080 `
    -Action Allow `
    -Profile Any `
    -Description "Permite acesso ao dev server do FlowDesk via VPN/LAN"

Write-Host ""
Write-Host "✓ Regra de firewall criada: $ruleName" -ForegroundColor Green
Write-Host "  Porta 8080 agora aceita conexoes externas (VPN/LAN)." -ForegroundColor Green
Write-Host ""
Write-Host "Para remover no futuro, rode:" -ForegroundColor Yellow
Write-Host "  Remove-NetFirewallRule -DisplayName '$ruleName'" -ForegroundColor Yellow
Write-Host ""
