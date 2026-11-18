param([string]$Exe = "release\ConoBot-portable.exe")

Add-Type @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  public static List<string> Titles(uint pid) {
    var list = new List<string>();
    EnumWindows((h, p) => {
      uint wpid; GetWindowThreadProcessId(h, out wpid);
      if (wpid == pid) {
        var sb = new StringBuilder(256);
        GetWindowText(h, sb, 256);
        if (sb.Length > 0) list.Add((IsWindowVisible(h) ? "[visible] " : "[hidden] ") + sb.ToString());
      }
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
'@

$proc = Start-Process -FilePath (Resolve-Path $Exe).Path -PassThru
Start-Sleep -Seconds 8
$proc.Refresh()
"running after launch: $(-not $proc.HasExited)"
"windows before close:"
[W]::Titles([uint32]$proc.Id) | ForEach-Object { "  $_" }

$hwnd = $proc.MainWindowHandle
if ($hwnd -ne [IntPtr]::Zero) {
  # WM_CLOSE == clicking the titlebar X
  [void][W]::PostMessage($hwnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
}
Start-Sleep -Seconds 3
$proc.Refresh()
"process alive after close: $(-not $proc.HasExited)"
"windows after close:"
[W]::Titles([uint32]$proc.Id) | ForEach-Object { "  $_" }

Start-Sleep -Seconds 1
Stop-Process -Id $proc.Id -Force
"cleaned up"
