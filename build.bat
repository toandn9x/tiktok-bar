@echo off
setlocal EnableExtensions
title Cai dat va build Toandn LIVE

set "ROOT=%~dp0"
set "BRIDGE_DIR=%ROOT%TikTokBridge"
set "PROJECT_DIR=%ROOT%UnityProject"
set "BUILD_DIR=%ROOT%Build"
set "GAME_EXE=%BUILD_DIR%\Toandn_Live.exe"
set "LOG_FILE=%ROOT%build_log.txt"
set "UNITY_VERSION="
set "UNITY_CHANGESET="
set "UNITY_EXE="
set "UNITY_CLI=%LocalAppData%\Unity\bin\unity.exe"

for /f "tokens=2" %%V in ('findstr /b /c:"m_EditorVersion:" "%PROJECT_DIR%\ProjectSettings\ProjectVersion.txt" 2^>nul') do set "UNITY_VERSION=%%V"
for /f "tokens=2 delims=()" %%C in ('findstr /b /c:"m_EditorVersionWithRevision:" "%PROJECT_DIR%\ProjectSettings\ProjectVersion.txt" 2^>nul') do set "UNITY_CHANGESET=%%C"
if not defined UNITY_VERSION set "UNITY_VERSION=6000.2.10f1"

echo ======================================================
echo       HUONG DAN CAI DAT VA BUILD Toandn LIVE
echo ======================================================
echo.
echo Script se kiem tra Node.js, thu vien npm va Unity.
echo Moi lua chon chi can bam Y hoac N.
echo.

rem -----------------------------------------------------------------
rem Node.js and npm dependencies
rem -----------------------------------------------------------------
where node.exe >nul 2>&1
if errorlevel 1 goto node_missing

for /f "delims=" %%V in ('node --version 2^>nul') do set "NODE_VERSION=%%V"
echo [OK] Da tim thay Node.js %NODE_VERSION%.
goto ask_npm

:node_missing
echo [THIEU] Chua tim thay Node.js. Du an can Node.js 20 tro len.
choice /c YN /n /m "Cai Node.js LTS bang winget? [Y/N]: "
if errorlevel 2 goto skip_node

where winget.exe >nul 2>&1
if errorlevel 1 (
    echo [LOI] May khong co winget. Hay cai Node.js 20+ tai https://nodejs.org/
    goto skip_node
)

winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo [LOI] Khong cai duoc Node.js tu dong.
    echo Hay cai thu cong tai https://nodejs.org/ roi chay lai file nay.
    goto skip_node
)

echo.
echo [OK] Da cai Node.js. Hay dong cua so nay, mo lai build.bat de tiep tuc.
goto finish

:skip_node
echo [BO QUA] Chua cai Node.js. Phan TikTok Bridge se chua chay duoc.
goto check_unity

:ask_npm
echo.
choice /c YN /n /m "Cai/cap nhat thu vien npm cho TikTok Bridge? [Y/N]: "
if errorlevel 2 goto check_unity

if not exist "%BRIDGE_DIR%\package.json" (
    echo [LOI] Khong tim thay TikTokBridge\package.json.
    goto check_unity
)

pushd "%BRIDGE_DIR%"
if exist "package-lock.json" (
    call npm.cmd ci
) else (
    call npm.cmd install
)
set "NPM_RESULT=%ERRORLEVEL%"
popd

if not "%NPM_RESULT%"=="0" (
    echo [LOI] Cai thu vien npm that bai. Kiem tra mang va thu lai.
) else (
    echo [OK] Thu vien npm da san sang.
)

rem -----------------------------------------------------------------
rem Unity CLI and the project editor version
rem -----------------------------------------------------------------
:check_unity
echo.
echo Phien ban Unity cua du an: %UNITY_VERSION%

if exist "%ProgramFiles%\Unity\Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe" set "UNITY_EXE=%ProgramFiles%\Unity\Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe"
if not defined UNITY_EXE if exist "%ProgramFiles%\Unity Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe" set "UNITY_EXE=%ProgramFiles%\Unity Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe"

if defined UNITY_EXE (
    echo [OK] Da tim thay Unity %UNITY_VERSION%.
    goto ask_build
)

echo [THIEU] Chua tim thay Unity %UNITY_VERSION%.

if exist "%UNITY_CLI%" goto unity_cli_ready

choice /c YN /n /m "Tu dong tai va cai Unity CLI chinh thuc? [Y/N]: "
if errorlevel 2 goto finish

set "CLI_INSTALLER=%TEMP%\Toandn_UnityCLI-install.ps1"
echo.
echo Dang tai trinh cai Unity CLI tu may chu chinh thuc cua Unity...
curl.exe -fL --retry 3 --output "%CLI_INSTALLER%" "https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.ps1"
if errorlevel 1 goto unity_cli_install_failed
if not exist "%CLI_INSTALLER%" goto unity_cli_install_failed

echo Dang cai Unity CLI. Bo cai se tu kiem tra SHA-256...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CLI_INSTALLER%" -Channel beta
set "CLI_INSTALL_RESULT=%ERRORLEVEL%"
del /q "%CLI_INSTALLER%" >nul 2>&1
if not "%CLI_INSTALL_RESULT%"=="0" goto unity_cli_install_failed
if not exist "%UNITY_CLI%" goto unity_cli_install_failed

echo [OK] Da cai Unity CLI.

:unity_cli_ready
for /f "delims=" %%V in ('"%UNITY_CLI%" --version 2^>nul') do set "UNITY_CLI_VERSION=%%V"
echo [OK] Unity CLI %UNITY_CLI_VERSION%.

rem -----------------------------------------------------------------
rem Unity Editor cai vao %ProgramFiles%, bat buoc phai co quyen
rem Administrator. Kiem tra TRUOC khi tai ~4 GB, tranh truong hop
rem tai xong moi that bai o buoc ghi file.
rem -----------------------------------------------------------------
net session >nul 2>&1
if not errorlevel 1 goto admin_ok

echo.
echo [CANH BAO] Cua so nay KHONG co quyen Administrator.
echo.
echo Unity Editor se duoc cai vao:
echo   %ProgramFiles%\Unity\Hub\Editor
echo Thu muc nay bat buoc phai co quyen Administrator moi ghi duoc.
echo Neu chay tiep, may se tai ve ~4 GB roi that bai o buoc cai dat.
echo.
echo Cach xu ly: dong cua so nay lai, chuot phai vao build.bat
echo roi chon "Run as administrator", sau do chay lai file nay.
echo Phan da tai ve nam trong cache nen se khong phai tai lai tu dau.
echo.
choice /c YN /n /m "Van muon thu cai ngay bay gio? [Y/N]: "
if errorlevel 2 goto finish

:admin_ok
echo.
echo Script co the tu tai va cai:
echo - Unity Editor %UNITY_VERSION%
echo Luu y: bo cai co dung luong lon va se can ket noi Internet.
choice /c YN /n /m "Tu dong cai tat ca ngay bay gio? [Y/N]: "
if errorlevel 2 goto finish

echo.
echo Dang tai va cai Unity %UNITY_VERSION%. Vui long doi...
if defined UNITY_CHANGESET (
    "%UNITY_CLI%" install "%UNITY_VERSION%" -c "%UNITY_CHANGESET%" --accept-eula --non-interactive --yes
) else (
    "%UNITY_CLI%" install "%UNITY_VERSION%" --accept-eula --non-interactive --yes
)
set "UNITY_INSTALL_RESULT=%ERRORLEVEL%"

if not "%UNITY_INSTALL_RESULT%"=="0" goto unity_install_failed

if exist "%ProgramFiles%\Unity\Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe" set "UNITY_EXE=%ProgramFiles%\Unity\Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe"
if not defined UNITY_EXE if exist "%ProgramFiles%\Unity Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe" set "UNITY_EXE=%ProgramFiles%\Unity Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe"
if not defined UNITY_EXE if exist "%LocalAppData%\Unity\Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe" set "UNITY_EXE=%LocalAppData%\Unity\Hub\Editor\%UNITY_VERSION%\Editor\Unity.exe"

if not defined UNITY_EXE goto unity_install_failed
echo [OK] Da cai Unity Editor.
goto ask_build

:unity_cli_install_failed
echo.
echo [LOI] Khong the tai hoac cai Unity CLI tu dong.
echo Kiem tra ket noi Internet va thu lai.
echo Script se khong tu mo trang web.
goto finish

:unity_install_failed
echo.
echo [LOI] Khong the tu dong cai Unity Editor.
echo Kiem tra ket noi Internet, dung luong dia va quyen Administrator.
echo Co the xem loi chi tiet ngay phia tren.
goto finish

rem -----------------------------------------------------------------
rem Build
rem -----------------------------------------------------------------
:ask_build
echo.
choice /c YN /n /m "Build game Windows ngay bay gio? [Y/N]: "
if errorlevel 2 goto finish

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

echo.
echo Dang build game. Qua trinh nay co the mat vai phut...
"%UNITY_EXE%" -quit -batchmode -projectPath "%PROJECT_DIR%" -buildWindows64Player "%GAME_EXE%" -logFile "%LOG_FILE%"
set "BUILD_RESULT=%ERRORLEVEL%"

if not "%BUILD_RESULT%"=="0" goto build_failed
if not exist "%GAME_EXE%" goto build_failed

rem -----------------------------------------------------------------
rem Dong bo asset ra thu muc Build.
rem
rem Dung robocopy /MIR chu KHONG dung xcopy /Y. xcopy chi ghi them va ghi de,
rem no khong bao gio xoa file da bien mat o nguon, nen asset cu nam lai trong
rem Build\ vinh vien. Da tung gay ra chuyen xoa DJ_VIDEO\dj.mp4 o nguon roi
rem build lai ma game van phat video do, vi no doc ban copy canh file exe.
rem robocopy tra ve 0-7 la thanh cong, tu 8 tro len moi la loi.
rem -----------------------------------------------------------------
echo Dang dong goi LiveAssets, DJ_MUSIC va DJ_VIDEO...
call :mirror "%ROOT%LiveAssets" "%BUILD_DIR%\LiveAssets"
call :mirror "%ROOT%DJ_MUSIC" "%BUILD_DIR%\DJ_MUSIC"
call :mirror "%ROOT%DJ_VIDEO" "%BUILD_DIR%\DJ_VIDEO"
goto assets_done

:mirror
if not exist "%~1" (
    rem Nguon khong con thi thu muc dich cung phai bien mat theo
    if exist "%~2" rd /s /q "%~2"
    exit /b 0
)
robocopy "%~1" "%~2" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 echo [CANH BAO] Khong dong bo duoc %~nx1 ra thu muc Build.
exit /b 0

:assets_done

echo.
echo [THANH CONG] Da tao: %GAME_EXE%
choice /c YN /n /m "Chay game va TikTok Bridge ngay? [Y/N]: "
if errorlevel 2 goto finish
call "%ROOT%run.bat"
goto finish

:build_failed
echo.
echo [LOI] Build khong thanh cong.
echo Xem chi tiet tai: %LOG_FILE%

:finish
echo.
echo Hoan tat.
pause
endlocal
