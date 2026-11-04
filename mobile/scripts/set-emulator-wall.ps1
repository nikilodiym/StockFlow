param([string]$ProjectRoot='C:\Users\Admin\OneDrive\Desktop\StockFlow')
$ErrorActionPreference='Stop'
$emulatorExe=Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'
$adbExe=Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$asset=Join-Path $ProjectRoot 'mobile\assets\emulator-test-ean13.png'
$avdName='Medium_Phone_API_37.0'
if (!(Test-Path $asset)) { throw "Barcode image missing: $asset" }
$env:ANDROID_AVD_HOME=Join-Path $env:USERPROFILE '.android\avd'
$running=& $adbExe devices | Select-String '^emulator-'
if (!$running) {
    Start-Process -FilePath $emulatorExe -ArgumentList @('-avd',$avdName,'-camera-back','virtualscene') -WindowStyle Hidden
    $deadline=(Get-Date).AddMinutes(3)
    do { Start-Sleep -Seconds 2; $running=& $adbExe devices | Select-String '^emulator-' } while (!$running -and (Get-Date) -lt $deadline)
}
if (!$running) { throw 'Emulator did not become available to adb.' }
$port=([regex]::Match($running.Line,'emulator-(\d+)').Groups[1].Value)
if (!$port) { throw "Could not read emulator console port from: $($running.Line)" }
$consolePort=[int]$port
$tokenPath=Join-Path $env:USERPROFILE '.emulator_console_auth_token'
$token=(Get-Content -LiteralPath $tokenPath -Raw).Trim()
$client=[System.Net.Sockets.TcpClient]::new('127.0.0.1',$consolePort)
$stream=$client.GetStream(); $stream.ReadTimeout=4000; $reader=[System.IO.StreamReader]::new($stream); $writer=[System.IO.StreamWriter]::new($stream); $writer.NewLine="`n"; $writer.AutoFlush=$true
$banner=$reader.ReadLine(); $writer.WriteLine("auth $token"); $auth=$reader.ReadLine(); if ($auth -notmatch 'OK') { throw "Console auth failed: $auth" }
$writer.WriteLine("virtualscene-image wall $asset"); $result=$reader.ReadLine(); if ($result -notmatch 'OK') { throw "Could not set virtual scene wall image: $result" }
$writer.WriteLine('quit'); $null=$reader.ReadLine(); $client.Dispose()
"Wall barcode applied to $avdName on $($running.Line.Trim())."
