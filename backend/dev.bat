@echo off
REM Lanzador portable. Evita el bloqueo por ExecutionPolicy en PCs nuevos
REM y permite arrancar con doble clic. Reenvia argumentos a dev.ps1.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
