# Windows sarmalayici: prompt'u dosyadan okuyup Cursor CLI'ye STDIN ile verir.
# Boylece prompt icindeki "-14" gibi parcalar CLI bayragi sanilmaz
# (eski argv yolu: unknown option '-14'). cmd.exe 8191 siniri da asilir.
param(
    [string]$Komut = 'agent',
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$PromptDosyasi,
    [string]$EkBayraklar = '--trust -f'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $PromptDosyasi)) { throw "Prompt dosyasi yok: $PromptDosyasi" }

$bayraklar = @($EkBayraklar -split '\s+' | Where-Object { $_ })

Get-Content $PromptDosyasi -Raw -Encoding UTF8 | & $Komut -p @bayraklar --model $Model --output-format text
if ($LASTEXITCODE -ne 0) { throw "$Komut -p basarisiz (exit $LASTEXITCODE)" }
