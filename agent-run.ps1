# Windows sarmalayici (yedek): prompt dosyadan okunur, tek argv olarak `--` ile verilir.
# Tercih edilen yol: agent-run-win.mjs (Node; PS 5.1 argv bolme sorununu da asar).
param(
    [string]$Komut = 'agent',
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$PromptDosyasi,
    [string]$EkBayraklar = '--trust -f'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $PromptDosyasi)) { throw "Prompt dosyasi yok: $PromptDosyasi" }

# PS 7.2+: native exe argumanlarini yeniden parse etme
if (Get-Variable -Name PSNativeCommandArgumentPassing -ErrorAction SilentlyContinue) {
    $PSNativeCommandArgumentPassing = 'Standard'
}

$prompt = Get-Content $PromptDosyasi -Raw -Encoding UTF8
$bayraklar = @($EkBayraklar -split '\s+' | Where-Object { $_ })
$argList = @('-p') + $bayraklar + @('--model', $Model, '--output-format', 'text', '--', $prompt)

& $Komut @argList
if ($LASTEXITCODE -ne 0) { throw "$Komut -p basarisiz (exit $LASTEXITCODE)" }
