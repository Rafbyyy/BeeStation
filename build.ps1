param([switch]$SkipChecks, [string]$OutputDirectory = 'release/BeeStation-win-x64')
$ErrorActionPreference = 'Stop'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
$sdkCommand = Get-Command dotnet -ErrorAction SilentlyContinue
$sdkPath = if ($sdkCommand) { $sdkCommand.Source } else { Join-Path $env:LOCALAPPDATA 'BeeHooks\sdk\dotnet.exe' }
if (-not (Test-Path -LiteralPath $sdkPath)) { throw 'Pasang SDK .NET 10.0.403. Lihat README.md.' }
Push-Location $PSScriptRoot
$releaseOutput = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $OutputDirectory))
try {
    Push-Location (Join-Path $PSScriptRoot 'ui')
    try {
        & npm ci --ignore-scripts
        if ($LASTEXITCODE) { throw 'Pemulihan dependency UI gagal.' }
        & npm run build
        if ($LASTEXITCODE) { throw 'Build UI gagal.' }
    } finally { Pop-Location }
    if (-not $SkipChecks) {
        & $sdkPath run --project tests/BeeHooks.Checks -c Release
        if ($LASTEXITCODE) { throw 'Tes logika gagal.' }
    }
    & $sdkPath publish src/BeeHooks.App -c Release --self-contained true -p:RestoreLockedMode=true -o $releaseOutput
    if ($LASTEXITCODE) { throw 'Build Windows gagal.' }
    Copy-Item -LiteralPath 'README.md' -Destination (Join-Path $releaseOutput 'README.md')
    if (Test-Path -LiteralPath 'CHECKPOINT.md') { Copy-Item -LiteralPath 'CHECKPOINT.md' -Destination (Join-Path $releaseOutput 'CHECKPOINT.md') }
    Copy-Item -LiteralPath 'src/BeeHooks.Core/Presets/dungeons.json' -Destination (Join-Path $releaseOutput 'BeeStation-Dungeons-default.json')
    New-Item -ItemType Directory -Path (Join-Path $releaseOutput 'docs') -Force | Out-Null
    Get-ChildItem -LiteralPath 'docs' | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $releaseOutput 'docs') -Recurse -Force
    }
    $packagesRoot = if ($env:NUGET_PACKAGES) { $env:NUGET_PACKAGES } else { Join-Path $env:USERPROFILE '.nuget/packages' }
    $runtimeConfig = Get-Content -LiteralPath (Join-Path $releaseOutput 'BeeStation.runtimeconfig.json') -Raw | ConvertFrom-Json
    foreach ($framework in $runtimeConfig.runtimeOptions.includedFrameworks) {
        $package = $framework.name.ToLowerInvariant() + '.runtime.win-x64'
        $packagePath = Join-Path $packagesRoot "$package/$($framework.version)"
        Get-ChildItem -LiteralPath $packagePath -File | Where-Object { $_.Name -like 'LICENSE*' -or $_.Name -eq 'THIRD-PARTY-NOTICES.TXT' } | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $releaseOutput "docs/$package-$($_.Name)")
        }
    }
    $iconName = 'BeeStation-' + (Get-FileHash -LiteralPath 'src/BeeHooks.App/Assets/beestation.ico').Hash.Substring(0,12).ToLowerInvariant() + '.ico'
    $releaseIcon = Join-Path $releaseOutput $iconName
    Copy-Item -LiteralPath 'src/BeeHooks.App/Assets/beestation.ico' -Destination $releaseIcon -Force
    Compress-Archive -Path (Join-Path $releaseOutput '*') -DestinationPath ($releaseOutput + '.zip') -Force
    $releaseExe = (Resolve-Path -LiteralPath (Join-Path $releaseOutput 'BeeStation.exe')).Path
    $desktopPath = [Environment]::GetFolderPath('DesktopDirectory')
    $shortcutPath = Join-Path $desktopPath 'BeeStation.lnk'
    $shellLink = New-Object -ComObject WScript.Shell
    $shortcut = $shellLink.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $releaseExe
    $shortcut.Arguments = ''
    $shortcut.WorkingDirectory = Split-Path -Parent $releaseExe
    $shortcut.IconLocation = "$releaseIcon,0"
    $shortcut.Description = 'BeeStation — build terbaru'
    $shortcut.Save()
    $savedShortcut = $shellLink.CreateShortcut($shortcutPath)
    if (-not (Test-Path -LiteralPath $shortcutPath) -or $savedShortcut.TargetPath -ne $releaseExe -or $savedShortcut.WorkingDirectory -ne (Split-Path -Parent $releaseExe) -or $savedShortcut.IconLocation -ne "$releaseIcon,0" -or $savedShortcut.Arguments -ne '') {
        throw 'Shortcut Desktop tidak sesuai build terbaru.'
    }
    Write-Output "Build: $releaseExe"
    Write-Output "Shortcut: $shortcutPath"
} finally { Pop-Location }
