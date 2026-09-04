Add-Type -AssemblyName System.Drawing

function New-Icon {
    param(
        [int]$Size,
        [string]$Path,
        [bool]$Maskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 0x4f, 0x46, 0xe5))

    if ($Maskable) {
        # Maskable icons need the visual content inside a safe-zone circle (~40% radius)
        # so it survives OS-level circular/rounded-square masking. Keep full-bleed bg.
    } else {
        # Rounded-rect mask for standard (non-maskable) icons
        $radius = [int]($Size * 0.2)
        $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path2.AddArc(0, 0, $d, $d, 180, 90)
        $path2.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $path2.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $path2.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $path2.CloseFigure()
        $g.SetClip($path2)
        $g.Clear([System.Drawing.Color]::FromArgb(255, 0x4f, 0x46, 0xe5))
        $g.ResetClip()
    }

    $penWidth = [Math]::Max(2, [int]($Size * 0.045))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0xe6, 0xe9, 0xf2)), $penWidth
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Forgetting-curve motif: steep early drop, long shallow tail (an exponential decay path)
    $margin = [double]($Size * ($(if ($Maskable) { 0.30 } else { 0.16 })))
    $w = $Size - 2 * $margin
    $h = $Size - 2 * $margin
    $points = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $n = 40
    for ($i = 0; $i -le $n; $i++) {
        $t = $i / [double]$n
        $x = $margin + $t * $w
        $y = $margin + (1 - [Math]::Exp(-3.2 * $t)) * $h * 0.72
        $points.Add((New-Object System.Drawing.PointF ([float]$x, [float]$y)))
    }
    $g.DrawCurve($pen, $points.ToArray())

    $dotR = [Math]::Max(3, [int]($Size * 0.05))
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0xe6, 0xe9, 0xf2))
    $g.FillEllipse($brush, [float]($margin - $dotR), [float]($margin - $dotR), [float]($dotR * 2), [float]($dotR * 2))

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$dir = "C:\Users\user\Desktop\Claude\ebbinghaus\public\icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-Icon -Size 192 -Path "$dir\icon-192.png" -Maskable $false
New-Icon -Size 512 -Path "$dir\icon-512.png" -Maskable $false
New-Icon -Size 512 -Path "$dir\maskable-512.png" -Maskable $true
New-Icon -Size 180 -Path "$dir\apple-touch-icon.png" -Maskable $false

Write-Output "Icons generated in $dir"
