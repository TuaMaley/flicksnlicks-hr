# Run from Nexora project root. Corrects imports in misplaced routes without deleting code.
$ErrorActionPreference = 'Stop'
$fixes = @(
  @{ Path='app/api/training/evaluations/route.ts'; From='../../../../../lib/'; To='../../../../lib/' },
  @{ Path='app/api/training/evaluations/responses/route.ts'; From='../../../../../../lib/'; To='../../../../../lib/' }
)
foreach ($f in $fixes) {
  if (-not (Test-Path -LiteralPath $f.Path)) { Write-Host "Not present: $($f.Path)"; continue }
  $source = Get-Content -LiteralPath $f.Path -Raw
  if ($source.Contains($f.From)) {
    Copy-Item -LiteralPath $f.Path -Destination ($f.Path + '.bak') -Force
    $source = $source.Replace($f.From, $f.To)
    Set-Content -LiteralPath $f.Path -Value $source -Encoding UTF8
    Write-Host "Fixed: $($f.Path)"
  } else { Write-Host "No matching bad imports: $($f.Path)" }
}
Write-Host 'Done. Run npm.cmd run build and review whether the non-[id] routes are actually required.'
