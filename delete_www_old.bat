@echo off
setlocal

set "TARGET=C:\Users\arvid\Documents\VoxelGobblin\DemoMaze2\www-old-164652"

echo.
echo Intentando eliminar reparse points (junctions / symlinks) dentro de %TARGET%
echo.

rem Eliminar cualquier reparse point/junction encontrado (no borra el contenido apuntado)
for /f "delims=" %%R in ('dir /aL /s /b "%TARGET%" 2^>nul') do (
  echo rmdir "%%R"
  rmdir "%%R" 2>nul || echo ERROR al eliminar junction "%%R"
)

echo.
echo Intentando borrar la carpeta completa (usa prefijo extendido para evitar MAX_PATH)
rd /s /q "\\?\%TARGET%" 2>rd_error.txt

if exist rd_error.txt (
  echo.
  echo rd devolvio errores. Mostrando rd_error.txt:
  type rd_error.txt
) else (
  echo.
  echo rd finalizo sin errores aparentes.
)

echo.
echo Comprobando existencia:
powershell -Command "if (Test-Path '%TARGET%') { Write-Host 'EXISTE' } else { Write-Host 'NO_EXISTE' }"

echo.
pause
endlocal
