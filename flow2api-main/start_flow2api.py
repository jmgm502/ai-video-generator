#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Flow2API 启动包装器
强制使用 UTF-8 编码以避免 Windows GBK 编码问题
"""
import sys
import os
import io

# 强制设置标准输出和错误输出为 UTF-8 编码
if sys.platform == 'win32':
    # 设置环境变量
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    os.environ['PYTHONUTF8'] = '1'
    
    # 重新配置标准输出流
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 导入并运行主程序
if __name__ == "__main__":
    # 将当前目录添加到 Python 路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # 使用 runpy 运行 main.py（这样会执行模块级代码）
    import runpy
    runpy.run_path("main.py", run_name="__main__")
