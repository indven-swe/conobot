@echo off
REM Build the Windows installers with the MSVC environment already loaded.
REM Usage: scripts\build-windows.cmd [extra tauri args]
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\Installer;%PATH%"
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cd /d "%~dp0.."
call npm run tauri:build -- %*
