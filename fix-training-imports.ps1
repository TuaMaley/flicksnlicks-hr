$ErrorActionPreference = 'Stop'
$files = @(
  @{ Path = 'app/api/training/evaluations/route.ts'; Prefix = '../../../../' },
  @{ Path = 'app/api/training/evaluations/responses/route.ts'; Prefix = '../../../../../' },
  @{ Path = 'app/api/training/[id]/evaluations/route.ts'; Prefix = '../../../../../' },
  @{ Path = 'app/api/training/[id]/evaluations/responses/route.ts'; Prefix = '../../../../../../' }
)
$changed = 0
foreach ($item in $files) {
  $path = Join-Path (Get-Location) $item.Path
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $original = [System.IO.File]::ReadAllText($path)
  $updated = [regex]::Replace($original, '(?m)(from\s+[''"])(?:\.\./)+(lib/(?:db|auth|http))([''"])', { param($m) $m.Groups[1].Value + $item.Prefix + $m.Groups[2].Value + $m.Groups[3].Value })
  if ($updated -ne $original) {
    [System.IO.File]::WriteAllText($path, $updated, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Fixed: $($item.Path)"
    $changed++
  }
}
if ($changed -eq 0) { Write-Host 'No changes needed or target files not found.' }
Write-Host 'Run npm run build to verify.'
