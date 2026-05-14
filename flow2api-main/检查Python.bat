@echo off
chcp 65001 >nul
echo ==========================================
echo   Python 环境检查工具
echo ==========================================
echo.

echo [检查 1/4] 尝试 python --version...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ python 命令可用
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo   版本: %%i
) else (
    echo   ❌ python 命令不可用
)
echo.

echo [检查 2/4] 尝试 python3 --version...
python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ python3 命令可用
    for /f "tokens=*" %%i in ('python3 --version 2^>^&1') do echo   版本: %%i
) else (
    echo   ❌ python3 命令不可用
)
echo.

echo [检查 3/4] 查找常见安装路径...
set found=0
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    echo   ✅ 找到: %LOCALAPPDATA%\Programs\Python\Python312\python.exe
    set found=1
)
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    echo   ✅ 找到: %LOCALAPPDATA%\Programs\Python\Python311\python.exe
    set found=1
)
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    echo   ✅ 找到: %LOCALAPPDATA%\Programs\Python\Python310\python.exe
    set found=1
)
if exist "%LOCALAPPDATA%\Programs\Python\Python39\python.exe" (
    echo   ✅ 找到: %LOCALAPPDATA%\Programs\Python\Python39\python.exe
    set found=1
)
if exist "%LOCALAPPDATA%\Programs\Python\Python38\python.exe" (
    echo   ✅ 找到: %LOCALAPPDATA%\Programs\Python\Python38\python.exe
    set found=1
)
if exist "C:\Program Files\Python312\python.exe" (
    echo   ✅ 找到: C:\Program Files\Python312\python.exe
    set found=1
)
if exist "C:\Program Files\Python311\python.exe" (
    echo   ✅ 找到: C:\Program Files\Python311\python.exe
    set found=1
)
if exist "C:\Program Files\Python310\python.exe" (
    echo   ✅ 找到: C:\Program Files\Python310\python.exe
    set found=1
)
if exist "C:\Program Files\Python39\python.exe" (
    echo   ✅ 找到: C:\Program Files\Python39\python.exe
    set found=1
)
if exist "C:\Program Files\Python38\python.exe" (
    echo   ✅ 找到: C:\Program Files\Python38\python.exe
    set found=1
)
if %found% equ 0 (
    echo   ❌ 未在常见位置找到 Python
)
echo.

echo [检查 4/4] 当前 PATH 环境变量:
echo %PATH% | findstr /i "python" >nul
if %errorlevel% equ 0 (
    echo   ✅ PATH 中包含 Python
) else (
    echo   ⚠️  PATH 中可能没有 Python
)
echo.

echo ==========================================
echo   检查完成！
echo ==========================================
echo.
echo 如果 python 命令不可用，但找到了安装路径：
echo   方案1: 重新安装 Python，务必勾选 "Add Python to PATH"
echo   方案2: 我们的软件会自动尝试找到并使用已安装的 Python
echo.
pause
