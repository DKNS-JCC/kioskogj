@echo off
REM Lanzador portable del frontend. Bypass de ExecutionPolicy para PCs nuevos.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
