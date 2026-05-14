@echo off
echo ==========================================
echo   Flow2API Simple Install
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/4] Finding Python...
set "PYTHON_CMD="

if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    echo Found Python 3.11
) else if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    echo Found Python 3.10
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    echo Found Python 3.12
) else if exist "%LOCALAPPDATA%\Programs\Python\Python39\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
    echo Found Python 3.9
) else (
    echo ERROR: Python not found!
    echo Please install Python 3.8+
    pause
    exit /b 1
)

"%PYTHON_CMD%" --version
echo OK: Python found
echo.

echo [2/4] Installing dependencies...
"%PYTHON_CMD%" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK: Dependencies installed
echo.

echo [3/4] Checking config...
if not exist "config\setting.toml" (
    if exist "config\setting_example.toml" (
        copy "config\setting_example.toml" "config\setting.toml" >nul
        echo OK: Config created
    )
)
echo.

echo [4/4] Starting Flow2API...
echo.
echo ==========================================
echo   INSTALLATION COMPLETE!
echo ==========================================
echo.
echo You can now:
echo   1. Start your StarDream app
echo   2. Or run: %PYTHON_CMD% main.py
echo.
echo Default:
echo   Admin: http://localhost:8000
echo   User: admin
echo   Pass: admin
echo.
echo Starting Flow2API now...
echo.
"%PYTHON_CMD%" main.py
pause
