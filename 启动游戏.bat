@echo off
cd /d "%~dp0"
title Liar Bar - Game Server
echo ========================================
echo    骗子酒馆 猫狗羊  正在启动...
echo ========================================
echo.
if not exist "node_modules" (
  echo 首次启动，正在安装依赖，请稍候...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请确认已安装 Node.js 后重试。
    pause
    exit /b 1
  )
)
set "LANIP="
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike ''169.*'' -and $_.IPAddress -ne ''127.0.0.1'' -and $_.PrefixOrigin -ne ''WellKnown'' } ^| Select-Object -First 1).IPAddress"') do set "LANIP=%%i"
echo.
echo ========================================
echo    游戏地址
echo ----------------------------------------
echo    本机访问:  http://localhost:5173
if defined LANIP (
  echo    局域网:    http://%LANIP%:5173    ^<- 手机/好友用这个
) else (
  echo    局域网:    见下方 Vite 输出的 Network 地址
)
echo ========================================
echo.
echo 关闭此窗口即可停止服务器。
echo.
call npm run dev -- --open --port=5173
pause
