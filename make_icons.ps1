Add-Type -AssemblyName System.Drawing

$srcIcon = "C:\Users\iniya\.gemini\antigravity-ide\brain\6deaaded-39a0-44dc-ae48-ed8f777c84e2\smart_farm_icon_1789322290899.jpg"
$srcScreen = "C:\Users\iniya\.gemini\antigravity-ide\brain\6deaaded-39a0-44dc-ae48-ed8f777c84e2\app_screenshot_1789322313864.jpg"
$pubDir = "$PSScriptRoot\public"

if (!(Test-Path $pubDir)) {
    New-Item -ItemType Directory -Path $pubDir -Force
}

# 1. Generate REAL 512x512 PNG Icon
$img = [System.Drawing.Image]::FromFile($srcIcon)
$bmp512 = New-Object System.Drawing.Bitmap 512, 512
$g512 = [System.Drawing.Graphics]::FromImage($bmp512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g512.DrawImage($img, 0, 0, 512, 512)
$g512.Dispose()
$bmp512.Save("$pubDir\icon-512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()
Write-Host "Generated real 512x512 PNG icon: $pubDir\icon-512.png"

# 2. Generate REAL 192x192 PNG Icon
$bmp192 = New-Object System.Drawing.Bitmap 192, 192
$g192 = [System.Drawing.Graphics]::FromImage($bmp192)
$g192.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g192.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g192.DrawImage($img, 0, 0, 192, 192)
$g192.Dispose()
$bmp192.Save("$pubDir\icon-192.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp192.Dispose()
$img.Dispose()
Write-Host "Generated real 192x192 PNG icon: $pubDir\icon-192.png"

# 3. Generate REAL 1280x720 PNG Screenshot
$scr = [System.Drawing.Image]::FromFile($srcScreen)
$bmpScr = New-Object System.Drawing.Bitmap 1280, 720
$gScr = [System.Drawing.Graphics]::FromImage($bmpScr)
$gScr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gScr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gScr.DrawImage($scr, 0, 0, 1280, 720)
$gScr.Dispose()
$bmpScr.Save("$pubDir\screenshot-desktop.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpScr.Dispose()
$scr.Dispose()
Write-Host "Generated real 1280x720 PNG screenshot: $pubDir\screenshot-desktop.png"

Write-Host "SUCCESS: All icons & screenshots converted to valid PNG format!"
