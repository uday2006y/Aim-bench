$auth = "Bearer ea_k6usdfErPhlq_4MsBjLnv3xxOEb9vSkMtBC1O3uSAaaq6DgKPeOkRST1"
for ($p=6; $p -le 20; $p++) {
  $url = "https://easyaim.com/api/v1/scenarios?limit=100&page=$p"
  $r = curl.exe -s -H $auth $url
  $data = $r | ConvertFrom-Json
  if (-not $data.data -or $data.data.Count -eq 0) {
    Write-Output "Page ${p}: empty, stopping"
    break
  }
  Write-Output "Page ${p}: $($data.data.Count) scenarios"
  $r | Out-File -FilePath "C:\Users\uki\AppData\Local\Cline\scenarios_p${p}.json" -Encoding utf8
}