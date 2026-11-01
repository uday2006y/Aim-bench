$benchScenarios = @(
  "2670|1w4 PASU 80% Larger",
  "1328|MIRA Pasu Perfected 4T Initiate",
  "2444|eth Pasu Micro Easier [MOBILE]",
  "2804|dom 3T",
  "2877|eth Pasu Switch Micro Easier [MOBILE]",
  "2548|1w4t pulse ig",
  "1344|Anima goaTS Hard",
  "1349|Anima B180TS",
  "2878|1w4 PASU 80% Larger Switch",
  "314|z1ye voxTS v2",
  "2671|Sky Click",
  "2879|Sky Switch"
)

$allScenarios = @{}
foreach ($p in @(0,1,2,3,4,5)) {
  $file = "C:\Users\uki\AppData\Local\Cline\scenarios_p$p.json"
  $data = Get-Content $file -Raw | ConvertFrom-Json
  if ($data.data) {
    foreach ($s in $data.data) {
      $allScenarios[$s.id.ToString()] = $s.title
    }
  }
}

Write-Output "Total EasyAim scenarios: $($allScenarios.Count)"
Write-Output ""
Write-Output "=== Benchmark scenarios → matched current EasyAim IDs ==="
foreach ($bs in $benchScenarios) {
  $oldId, $title = $bs -split '\|', 2
  $match = $null
  foreach ($k in $allScenarios.Keys) {
    if ($allScenarios[$k] -eq $title) {
      $match = $k
      break
    }
  }
  if ($match) {
    Write-Output "OLD: $oldId → NEW: $match | $title"
  } else {
    Write-Output "OLD: $oldId → NO MATCH | $title"
  }
}