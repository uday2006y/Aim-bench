$userScenarioIds = @()
Get-Content "C:\Users\uki\AppData\Local\Cline\runs.json" -Raw | ConvertFrom-Json | Select-Object -ExpandProperty data | ForEach-Object { $userScenarioIds += $_.scenarioId.ToString() }

Write-Output ("User's run scenario IDs: " + ($userScenarioIds -join ', '))
Write-Output ""

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

Write-Output ("Total current EasyAim scenarios: " + $allScenarios.Count)
Write-Output ""
Write-Output "=== User runs matched to current EasyAim scenarios ==="

foreach ($sid in $userScenarioIds) {
  if ($allScenarios.ContainsKey($sid)) {
    Write-Output ("User scenario " + $sid + " → EasyAim scenario " + $sid + ": " + $allScenarios[$sid])
  } else {
    Write-Output ("User scenario " + $sid + " → NOT FOUND in current EasyAim library")
  }
}