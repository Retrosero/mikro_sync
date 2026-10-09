@echo off
TITLE Mikro Sync Dashboard
cd /d "%~dp0"

REM --- 1) PostgreSQL SSH tuneli ayakta mi? ---
REM Veritabani 127.0.0.1:55432 uzerinden tunelle sunucuya gidiyor.
REM Tunel normalde oturum acilisinda zamanlanmis gorevle baslar;
REM herhangi bir sebeple dusmusse burada yeniden kaldiriyoruz.

echo Tunel kontrol ediliyor...
netstat -an | findstr "127.0.0.1:55432" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   Tunel kapali, baslatiliyor...
    schtasks /run /tn "Mikro Sync - PostgreSQL Tuneli" >nul 2>&1
    if errorlevel 1 start "" wscript.exe "%~dp0Tunel-Gizli.vbs"

    REM baglanti kurulana kadar en fazla 20 saniye bekle
    for /l %%i in (1,1,20) do (
        ping -n 2 127.0.0.1 >nul 2>&1
        netstat -an | findstr "127.0.0.1:55432" | findstr "LISTENING" >nul 2>&1
        if not errorlevel 1 goto tunel_hazir
    )
    echo.
    echo   *** UYARI: Tunel kurulamadi! ***
    echo   Veritabanina baglanilamayacak. logs\tunnel.log dosyasina bakin.
    echo.
    pause
    goto tunel_hazir
)

:tunel_hazir
echo   Tunel hazir ^(127.0.0.1:55432^)
echo.

REM --- 2) Dashboard ---
echo Dashboard baslatiliyor...
npm run dashboard
pause
