@echo off
setlocal
TITLE Mikro Sync - PostgreSQL SSH Tuneli
cd /d "%~dp0"

REM Yerel 127.0.0.1:55432 -> sunucudaki PostgreSQL 5432
REM NOT: Bu PC'de yerel PostgreSQL 18 servisi 5432'yi kullaniyor,
REM      bu yuzden tunel 55432'ye kuruluyor. .env de buna gore ayarli.

set "KEY=%USERPROFILE%\.ssh\mikro_sync_ed25519"
set "TARGET=root@72.61.119.147"
set "LOG=%~dp0logs\tunnel.log"

if not exist "%~dp0logs" mkdir "%~dp0logs"

echo ========================================
echo   PostgreSQL SSH Tuneli
echo   127.0.0.1:55432 -^> 72.61.119.147:5432
echo   Log: %LOG%
echo ========================================

:loop
echo [%date% %time%] Tunel baglaniyor...
>>"%LOG%" echo [%date% %time%] Tunel baglaniyor...

ssh -N -L 127.0.0.1:55432:localhost:5432 -i "%KEY%" -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=accept-new %TARGET% >>"%LOG%" 2>&1

echo [%date% %time%] Tunel koptu (kod %errorlevel%). 10 saniye sonra yeniden denenecek...
>>"%LOG%" echo [%date% %time%] Tunel koptu (kod %errorlevel%). Yeniden denenecek.

REM timeout yerine ping: zamanlanmis gorevde konsol olmadigi icin timeout calismaz
ping -n 11 127.0.0.1 >nul 2>&1
goto loop
