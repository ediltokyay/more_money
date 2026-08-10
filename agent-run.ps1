# Windows sarmalayici: prompt'u dosyadan okuyup Cursor CLI'ye native argv olarak verir.
# cmd.exe tirnak/8191 karakter sinirini tamamen atlar. Cagri sekli scripts/dogrula.ps1 ile ayni.
param(
    [string]$Komut = 'agent',
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$PromptDosyasi,
    [string]$EkBayraklar = '--trust -f'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $PromptDosyasi)) { throw "Prompt dosyasi yok: $PromptDosyasi" }

$prompt = Get-Content $PromptDosyasi -Raw -Encoding UTF8
$bayraklar = @($EkBayraklar -split '\s+' | Where-Object { $_ })

& $Komut -p @bayraklar --model $Model --output-format text $prompt
if ($LASTEXITCODE -ne 0) { throw "$Komut -p basarisiz (exit $LASTEXITCODE)" }
