$benchTitles = @(
  "1w4 PASU 80% Larger",
  "MIRA Pasu Perfected 4T Initiate",
  "eth Pasu Micro Easier [MOBILE]",
  "1w4t pulse ig",
  "Anima goaTS Hard",
  "Anima B180TS",
  "z1ye voxTS v2",
  "Sky Click"
)

$allScenarios = @{}
foreach ($p in 0..5) {
  $file = "C:\Users\uki\AppData\Local\Cline\scenarios_p${p}.json"
  $data = Get-Content $file -Raw | ConvertFrom-Json
  if ($data.data) {
    foreach ($s in $data.data) {
      $allScenarios[$s.id.ToString()] = $s.title
    }
  }
}

Write-Output "=== Searching for close matches ==="
foreach ($title in $benchTitles) {
  $words = $title -split ' ' | Where-Object { $_.Length -gt 2 }
  $hits = [System.Collections.Generic.List[PSObject]]::new()
  foreach ($k in $allScenarios.Keys) {
    $st = $allScenarios[$k]
    $score = 0
    foreach ($w in $words) {
      if ($st -match [regex]::Escape($w)) { $score++ }
    }
    if ($score -gt 0) {
      $hits.Add([PSCustomObject]@{ id=$k; title=$st; score=$score })
    }
  }
  $hits = $hits | Sort-Object score -Descending | Select-Object -First 5
  Write-Output ""
  Write-Output "BENCHMARK: $title"
  if ($hits.Count -eq 0) {
    Write-Output "  NO MATCHES AT ALL"
  } else {
    foreach ($m in $hits) {
      Write-Output ("  {0} | {1} | score={2}" -f $m.id, $m.title, $m.score)
    }
  }
}