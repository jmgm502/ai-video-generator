@echo off
chcp 65001 >nul
echo ==========================================
echo   Flow2API 自动安装脚本
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/5] 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Python，请先安装 Python 3.8+
    echo    下载地址: https://www.python.org/downloads/
    echo    安装时请勾选 "Add Python to PATH"
    pause
    exit /b 1
)
python --version
echo ✅ Python 检查通过
echo.

echo [2/5] 创建虚拟环境...
if not exist "venv" (
    python -m venv venv
    echo ✅ 虚拟环境创建完成
) else (
    echo ⚠️  虚拟环境已存在，跳过创建
)
echo.

echo [3/5] 激活虚拟环境并安装依赖...
call venv\Scripts\activate.bat
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ 错误: 依赖安装失败
    pause
    exit /b 1
)
echo ✅ 依赖安装完成
echo.

echo [4/5] 安装 Playwright 浏览器...
playwright install chromium
if %errorlevel% neq 0 (
    echo ⚠️  Playwright 浏览器安装可能失败，但不影响基础功能
    echo    如果需要 browser/personal 打码模式，请手动运行: playwright install chromium
) else (
    echo ✅ Playwright 浏览器安装完成
)
echo.

echo [5/5] 配置文件检查...
if not exist "config\setting.toml" (
    if exist "config\setting_example.toml" (
        copy "config\setting_example.toml" "config\setting.toml" >nul
        echo ✅ 已复制示例配置文件
    )
)
echo.

echo ==========================================
echo   ✅ 安装完成！
echo ==========================================
echo.
echo 启动方式:
echo   - 直接运行你的星梦动画软件，Flow2API 会自动启动
echo   - 或手动运行: python main.py
echo.
echo 默认配置:
echo   - 管理后台: http://localhost:8000
echo   - 用户名: admin
echo   - 密码: admin
echo.
pause
