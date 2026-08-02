# Builds js/catalog.js + photos/ from the MN State Fair 2026 Food Database export.
# Usage: powershell -File tools\build-catalog.ps1 -Src "<extracted database folder>"
param([string]$Src = "C:\Users\timhe\AppData\Local\Temp\claude\C--Users-timhe--claude-sessions-State-Fair-APP\ccf294be-50d5-4505-ac95-2212cc9fe090\scratchpad\fooddb\MN State Fair 2026 Food Database")

$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot

function Median($arr) {
  $s = $arr | Sort-Object
  $n = $s.Count
  if ($n -eq 0) { return $null }
  if ($n % 2 -eq 1) { return $s[[int][Math]::Floor($n/2)] }
  return ($s[$n/2 - 1] + $s[$n/2]) / 2
}
function Slug($t) {
  $x = $t.ToLower() -replace "[^a-z0-9]+", "-"
  return $x.Trim('-')
}
function Norm($t) { return ($t.ToLower() -replace "[^a-z0-9]", "") }

# ---------- load ----------
$vendorsCsv = Import-Csv "$Src\Vendors.csv"
$menuCsv    = Import-Csv "$Src\Menu Items.csv"
$newCsv     = Import-Csv "$Src\New for 2026.csv" | Where-Object { $_.Name -ne 'New Vendor' }

# ---------- photo dirs ----------
$pv = Join-Path $proj "photos\v"
$pn = Join-Path $proj "photos\new"
New-Item -ItemType Directory -Force $pv | Out-Null
New-Item -ItemType Directory -Force $pn | Out-Null

# ---------- vendors ----------
$vendors = @()
$avSamples = @{}   # avenue name -> list of lats
$stSamples = @{}   # street name -> list of lons
$avenueNames = @('Dan Patch','Carnes','Judson','Randall','Wright','Murphy','Lee','Como')
$streetNames = @('Underwood','Cooper','Cosgrove','Nelson','Clough','Chambers','Liggett','Snelling')

foreach ($v in $vendorsCsv) {
  $id = $v.'Vendor ID'
  if (-not $id) { continue }
  $lat = $null; $lon = $null
  if ($v.Latitude)  { $lat = [double]$v.Latitude }
  if ($v.Longitude) { $lon = [double]$v.Longitude }

  # hours: pull the "Open ..." fragment out of Hours & Payment
  $hours = ''
  if ($v.'Hours & Payment' -match 'Open ([^\.]+(?:\.[^\)]*\))?)') { $hours = ('Open ' + $Matches[1]).Trim() }
  if ($hours.Length -gt 60) { $hours = $hours.Substring(0, 57) + '...' }

  # photo: copy + rename to photos/v/<id>.jpg
  $photo = $null
  if ($v.'Photo File') {
    $srcPhoto = Join-Path "$Src\photos\vendors" $v.'Photo File'
    if (Test-Path $srcPhoto) {
      Copy-Item $srcPhoto (Join-Path $pv "$id.jpg") -Force
      $photo = "photos/v/$id.jpg"
    }
  }

  # street geometry samples from location text
  $loc = $v.'Location / Directions'
  if ($lat -ne $null -and $loc) {
    foreach ($a in $avenueNames) {
      if ($loc -match "side of (West )?$a Ave" -or $loc -match "corner of [^&]*$a Ave" -or $loc -match "$a Ave\. &" -or $loc -match "& $a ave") {
        if (-not $avSamples[$a]) { $avSamples[$a] = @() }
        $avSamples[$a] += $lat
        break
      }
    }
    foreach ($s in $streetNames) {
      if ($loc -match "side of $s (St|Ave)" -or $loc -match "corner of [^&]*$s (St|Ave)" -or $loc -match "& $s (St|Ave)") {
        if (-not $stSamples[$s]) { $stSamples[$s] = @() }
        $stSamples[$s] += $lon
        break
      }
    }
  }

  $vendors += [ordered]@{
    id       = $id
    name     = $v.Vendor
    loc      = $loc
    hours    = $hours
    lat      = $lat
    lon      = $lon
    photo    = $photo
    url      = $v.'Vendor Page URL'
    offers   = $v.'Offers & Coupons'
    onStick  = ($v.'On-A-Stick' -eq 'Yes')
    veg      = ($v.'Vegetarian' -eq 'Yes')
    vegan    = ($v.'Vegan' -eq 'Yes')
    gf       = ($v.'Gluten-Free/Friendly' -eq 'Yes')
    value5   = ($v.'Value Items ($5-)' -eq 'Yes')
    newVend  = ($v.'New Vendor' -eq 'Yes')
    official = ($v.'Official New Food' -eq 'Yes')
  }
}

# ---------- foods (menu items) ----------
function InferCats($name) {
  $n = $name.ToLower()
  $cats = @()
  if ($n -match 'lemonade|beer|wine|soda|pop\b|iced tea|sweet tea|\btea\b|coffee|cocoa|shake|malt\b|smoothie|juice|cider|float|refresher|sparkler|mocktail|cocktail|seltzer|kombucha|slush|latte|espresso|cold press|cold brew|water|drink|limeade|horchata|mangonada|punch\b') { $cats += 'Drinks' }
  if ($n -match 'cookie|donut|doughnut|ice cream|sundae|\bpie\b|cake|candy|caramel|chocolate|fudge|churro|funnel|smore|s''more|dessert|cinnamon|marshmallow|brownie|tart\b|pastry|cupcake|custard|gelato|sorbet|parfait|honey\b|strudel|cheesecake|cobbler|taffy|licorice|whoopie|tanghulu|puff\b|glazed|frosted|sugar') { $cats += 'Sweet' }
  if ($n -match 'fried|frites|fries|curds|corn dog|pronto|tots\b|tempura|chicharron|cracklin|poppers|croquette|lumpia|egg roll|funnel') { $cats += 'Deep Fried' }
  if ($n -match 'on-a-stick|on a stick|skewer|kabob|kebab|corn dog|pronto pup') { $cats += 'On a Stick' }
  if ($n -match 'cheese|curd|milk|cream\b|dairy|yogurt|malt\b') { $cats += 'Dairy' }
  if (($cats -notcontains 'Sweet') -and ($cats -notcontains 'Drinks')) { $cats += 'Savory' }
  return @($cats | Select-Object -Unique)
}
function InferEmoji($name) {
  $n = $name.ToLower()
  if ($n -match 'corn dog|pronto') { return '🌭' }
  if ($n -match 'hot dog|brat|sausage|wiener') { return '🌭' }
  if ($n -match 'cheese curd|curds') { return '🧀' }
  if ($n -match 'fries|tots|potato') { return '🍟' }
  if ($n -match 'pizza') { return '🍕' }
  if ($n -match 'burger|slider') { return '🍔' }
  if ($n -match 'taco|burrito|quesadilla|nacho') { return '🌮' }
  if ($n -match 'ice cream|sundae|gelato|custard|soft serve|cone') { return '🍦' }
  if ($n -match 'cookie|dough') { return '🍪' }
  if ($n -match 'donut|doughnut') { return '🍩' }
  if ($n -match 'cake|whoopie') { return '🍰' }
  if ($n -match '\bpie\b') { return '🥧' }
  if ($n -match 'lemonade|limeade') { return '🍋' }
  if ($n -match 'coffee|espresso|latte|cold press|cold brew') { return '☕' }
  if ($n -match 'beer|ale\b|lager|ipa') { return '🍺' }
  if ($n -match 'corn\b|elote') { return '🌽' }
  if ($n -match 'chicken|wings') { return '🍗' }
  if ($n -match 'pork|bbq|rib|bacon|brisket|ham\b') { return '🍖' }
  if ($n -match 'walleye|fish|shrimp|lobster|salmon') { return '🐟' }
  if ($n -match 'pretzel') { return '🥨' }
  if ($n -match 'egg roll|lumpia|dumpling|wonton|bao') { return '🥟' }
  if ($n -match 'strawberr|berry|fruit|grape') { return '🍓' }
  if ($n -match 'apple') { return '🍎' }
  if ($n -match 'candy|taffy|licorice') { return '🍬' }
  if ($n -match 'shake|malt|smoothie|float|soda|pop\b|drink|tea|refresher|sparkler|mocktail|punch') { return '🥤' }
  if ($n -match 'cheese') { return '🧀' }
  if ($n -match 'sandwich|grinder|sub\b|hoagie|melt') { return '🥪' }
  if ($n -match 'milk') { return '🥛' }
  return '🍴'
}
function TitleCase($t) {
  if ($t -cmatch '^[a-z]') {
    return (Get-Culture).TextInfo.ToTitleCase($t)
  }
  return $t
}

$foods = @()
$byNorm = @{} # normalized name+vendor -> food ref index
$i = 0
foreach ($m in $menuCsv) {
  if (-not $m.Item -or -not $m.'Vendor ID') { continue }
  $name = TitleCase $m.Item.Trim()
  $desc = $m.'Description / Components'
  if ($desc) { $desc = ($desc -replace ';\s*', ', ') }
  $f = [ordered]@{
    id      = "f$i"
    name    = $name
    vendorId= $m.'Vendor ID'
    cats    = InferCats $name
    emoji   = InferEmoji $name
    isNew   = ($m.'New 2026 Item' -eq 'Yes')
    sip     = ($m.'Specialty Sip' -eq 'Yes')
    official= $false
    photo   = $null
    dietary = @()
    desc    = $desc
    soldOut = $false
  }
  $foods += $f
  $byNorm[(Norm $name) + '|' + $m.'Vendor ID'] = $foods.Count - 1
  $i++
}

# ---------- enrich with official 36 new foods ----------
$vendorByName = @{}
foreach ($v in $vendors) { $vendorByName[(Norm $v.name)] = $v.id }

foreach ($nf in $newCsv) {
  $nfNorm = Norm $nf.Name
  $vid = $vendorByName[(Norm $nf.Vendor)]
  $diet = @()
  if ($nf.'Full Description' -match '\(([^)]*Vegetarian[^)]*)\)') { $diet += 'vegetarian' }
  if ($nf.'Full Description' -match 'Vegan') { $diet += 'vegan' }
  if ($nf.'Full Description' -match 'Gluten-free|Gluten-friendly') { $diet += 'gluten-free' }

  # photo
  $photoRel = $null
  if ($nf.'Photo File') {
    $srcP = Join-Path "$Src\photos\new-foods" $nf.'Photo File'
    if (Test-Path $srcP) {
      $slug = Slug $nf.Name
      Copy-Item $srcP (Join-Path $pn "$slug.jpg") -Force
      $photoRel = "photos/new/$slug.jpg"
    }
  }

  # find matching menu item (same vendor preferred, fuzzy contains)
  $matchIdx = -1
  foreach ($k in $byNorm.Keys) {
    $parts = $k -split '\|'
    $isSameVendor = ($vid -and $parts[1] -eq $vid)
    if ($parts[0] -eq $nfNorm -or ($parts[0].Length -gt 6 -and $nfNorm.Contains($parts[0])) -or ($nfNorm.Length -gt 6 -and $parts[0].Contains($nfNorm))) {
      $matchIdx = $byNorm[$k]
      if ($isSameVendor) { break } # exact-vendor match wins
    }
  }
  if ($matchIdx -ge 0) {
    $foods[$matchIdx].name    = $nf.Name
    $foods[$matchIdx].desc    = $nf.'Full Description'
    $foods[$matchIdx].official= $true
    $foods[$matchIdx].isNew   = $true
    $foods[$matchIdx].photo   = $photoRel
    $foods[$matchIdx].dietary = $diet
    if ($vid) { $foods[$matchIdx].vendorId = $vid }
  } else {
    $foods += [ordered]@{
      id = "f$i"; name = $nf.Name; vendorId = $vid; cats = (InferCats $nf.Name); emoji = (InferEmoji $nf.Name)
      isNew = $true; sip = $false; official = $true; photo = $photoRel; dietary = $diet
      desc = $nf.'Full Description'; soldOut = $false
    }
    $i++
  }
}

# ---------- street geometry ----------
$avenues = @()
foreach ($a in $avenueNames) {
  if ($avSamples[$a] -and $avSamples[$a].Count -ge 2) {
    $avenues += [ordered]@{ name = "$a Ave"; lat = [double](Median $avSamples[$a]); n = $avSamples[$a].Count }
  }
}
$streets = @()
foreach ($s in $streetNames) {
  if ($stSamples[$s] -and $stSamples[$s].Count -ge 2) {
    $label = if ($s -eq 'Snelling') { "$s Ave" } else { "$s St" }
    $streets += [ordered]@{ name = $label; lon = [double](Median $stSamples[$s]); n = $stSamples[$s].Count }
  }
}
$avenues = @($avenues | Sort-Object lat -Descending)  # north (high lat) first
$streets = @($streets | Sort-Object lon)              # west first

$lats = @($vendors | Where-Object { $_.lat } | ForEach-Object { $_.lat })
$lons = @($vendors | Where-Object { $_.lon } | ForEach-Object { $_.lon })
$geo = [ordered]@{
  minLat = ($lats | Measure-Object -Minimum).Minimum
  maxLat = ($lats | Measure-Object -Maximum).Maximum
  minLon = ($lons | Measure-Object -Minimum).Minimum
  maxLon = ($lons | Measure-Object -Maximum).Maximum
  avenues = $avenues
  streets = $streets
}

# ---------- write catalog.js ----------
$catalog = [ordered]@{ builtFrom = 'MN State Fair 2026 Food Database'; vendors = $vendors; foods = $foods; geo = $geo }
$json = $catalog | ConvertTo-Json -Depth 6 -Compress
$outPath = Join-Path $proj "js\catalog.js"
$content = "/* Generated by tools/build-catalog.ps1 - do not edit by hand. */`nconst CATALOG = " + $json + ";`n"
[System.IO.File]::WriteAllText($outPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ("vendors: " + $vendors.Count)
Write-Output ("foods: " + $foods.Count)
Write-Output ("official new foods: " + (@($foods | Where-Object { $_.official }).Count))
Write-Output ("foods with photos: " + (@($foods | Where-Object { $_.photo }).Count))
Write-Output ("vendor photos copied: " + (Get-ChildItem $pv).Count)
Write-Output ("new-food photos copied: " + (Get-ChildItem $pn).Count)
Write-Output ("avenues: " + (($avenues | ForEach-Object { $_.name + '(' + $_.n + ')' }) -join ', '))
Write-Output ("streets: " + (($streets | ForEach-Object { $_.name + '(' + $_.n + ')' }) -join ', '))
Write-Output ("catalog.js: " + [Math]::Round((Get-Item $outPath).Length / 1KB) + " KB")