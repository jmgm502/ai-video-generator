@echo off
title Flow2API
cd /d "%~dp0"
python main.py
if errorlevel 1 (
    echo 尝试使用 py 启动...
    py main.py
)
pause
