$authHeader = @{ Authorization = "Bearer $env:EASYAIM_API_KEY" }
$total = 0
for ($p=0; $p -lt 30; $p++) {
  $url = "https://easyaim.com/api/v1/scenarios?limit=100&page=$p"
  $r = curl.exe -s -H $authHeader.Authorization $url
  $data = $r | ConvertFrom-Json
  if (-not $data.data -or $data.data.Count -eq 0) {
    Write-Output "Page $p: empty, stopping"
    break
  }
  Write-Output "Page $p: $($data.data.Count) scenarios"
  $total += $data.data.Count
  # Save page data
  $r | Out-File -FilePath "C:\Users\uki\AppData\Local\Cline\scenarios_p$p.json" -Encoding utf8
}
Write-Output "Total: $total scenarios across all pages"