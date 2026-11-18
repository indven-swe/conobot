param(
  [string]$Exe = "release\ConoBot-portable.exe",
  [string]$Out = "$env:TEMP\conobot-window.png",
  [int]$WaitSeconds = 10
)

Add-Type -AssemblyName System.Drawing

$signature = @'
using System;
using System.Runtime.InteropServices;
public class WinCap {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
'@
Add-Type -TypeDefinition $signature -ReferencedAssemblies System.Drawing

$resolved = (Resolve-Path $Exe).Path
$proc = Start-Process -FilePath $resolved -PassThru
Start-Sleep -Seconds $WaitSeconds
$proc.Refresh()

if ($proc.HasExited) {
  "process exited early: code=$($proc.ExitCode)"
  exit 1
}

$hwnd = $proc.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) {
  "no main window handle"
  exit 2
}

[void][WinCap]::ShowWindow($hwnd, 9)
[void][WinCap]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 1200

$rect = New-Object WinCap+RECT
[void][WinCap]::GetWindowRect($hwnd, [ref]$rect)
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
"window ${w}x${h} title='$($proc.MainWindowTitle)'"

$bmp = New-Object System.Drawing.Bitmap $w, $h
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $gfx.GetHdc()
# 2 = PW_RENDERFULLCONTENT (captures composited webview content)
$ok = [WinCap]::PrintWindow($hwnd, $hdc, 2)
$gfx.ReleaseHdc($hdc)
$gfx.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
"saved=$Out printwindow=$ok"
