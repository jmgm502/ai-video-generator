/**
 * Windows 控制台默认多为 GBK(936)，而本工程源码与日志为 UTF-8，
 * 不重设代码页时 electron-log / console 中文会乱码。
 * 须在 main 进程、任何 log 输出之前执行。
 */
import { execSync } from 'node:child_process'

if (process.platform === 'win32') {
  try {
    const shell = process.env.ComSpec || `${process.env.windir}\\System32\\cmd.exe`
    // 执行 chcp 65001 并等待完成
    execSync('chcp 65001', { stdio: 'ignore', shell })
    // 设置环境变量以确保所有子进程使用 UTF-8
    process.env.LANG = 'zh_CN.UTF-8'
    process.env.LC_ALL = 'zh_CN.UTF-8'
  } catch {
    /* ignore */
  }
}
