$p = 'C:\Users\uki\Music\Aim-bench\src\app\benchmarks\[id]\BenchmarkClient.tsx'
$c = [System.IO.File]::ReadAllText($p)

# 1. Remove BadgeRankCell function
$start = $c.IndexOf('/** Badge-style rank cell')
if ($start -ge 0) {
  $endSearch = $c.IndexOf('}', $start)
  $braceCount = 1
  $i = $endSearch + 1
  while ($i -lt $c.Length -and $braceCount -gt 0) {
    if ($c[$i] -eq '{') { $braceCount++ }
    if ($c[$i] -eq '}') { $braceCount-- }
    $i++
  }
  $end = $i
  $c = $c.Substring(0, $start) + $c.Substring($end)
  "Removed BadgeRankCell" | Write-Output
}

# 2. Replace badge conditional open
$c = $c -replace '{barStyle === "badge" \? \(\r?\n                                    <BadgeRankCell\r?\n                                      cutoff={cutoff}\r?\n                                      color={color}\r?\n                                      score={score}\r?\n                                      cleared={cleared}\r?\n                                    \/>', '<div className="flex flex-col items-center gap-1.5">'
"Replaced badge conditional open" | Write-Output

# 3. Remove badge conditional close: "</div>\n                                  )}"
$c = $c -replace '</div>\r?\n                                  \}\)\r?\n                                </td>', "</div>`r`n                                </td>"
"Replaced badge conditional close" | Write-Output

# 4. Replace footer conditional
$c = $c -replace '{barStyle === "badge"\r?\n                \? "Each rank shows its cutoff value as a colored badge\. Filled dot means the rank is cleared\."\r?\n                : "Bars show your progress toward each rank', '"Bars show your progress toward each rank'
$c = $c -replace "rank's cutoff, measured from the previous cleared rank\. Filled bars mean the rank is cleared\.\}", "rank's cutoff, measured from the previous cleared rank. Filled bars mean the rank is cleared.\"}"

[System.IO.File]::WriteAllText($p, $c)
"done" | Write-Output
