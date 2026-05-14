import { spawn, ChildProcess, execSync } from 'child_process'
import { join, dirname } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import * as fs from 'fs'
import http from 'http'

let flow2apiProcess: ChildProcess | null = null
let isStopping = false

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

function getSourceFlow2apiPath(): string {
  const isDev = !app.isPackaged
  
  if (isDev) {
    // 开发环境：尝试多种方式查找 flow2api-main
    const paths = [
      // 1. 相对于项目根目录
      join(process.cwd(), 'flow2api-main'),
      // 2. 相对于当前文件目录（electron 目录）
      join(__dirname, '..', 'flow2api-main'),
      // 3. 相对于 app 路径
      join(dirname(app.getPath('exe')), '..', 'flow2api-main'),
    ]
    
    for (const path of paths) {
      log.info('尝试查找 flow2api 源路径:', path)
      if (fs.existsSync(path) && fs.existsSync(join(path, 'start_flow2api.py'))) {
        log.info('找到 flow2api 源路径:', path)
        return path
      }
    }
    
    log.warn('未找到 flow2api-main，使用默认路径')
    return join(process.cwd(), 'flow2api-main')
  } else {
    // 生产环境：查找打包后的 flow2api-main
    const exePath = dirname(app.getPath('exe'))
    const paths = [
      // 1. 标准位置：resources/flow2api-main
      join(exePath, 'resources', 'flow2api-main'),
      // 2. app 目录下的 resources：resources/app/resources/flow2api-main
      join(exePath, 'resources', 'app', 'resources', 'flow2api-main'),
      // 3. app 目录下直接查找
      join(exePath, 'resources', 'app', 'flow2api-main'),
    ]
    
    for (const path of paths) {
      log.info('尝试查找 flow2api 源路径:', path)
      if (fs.existsSync(path) && fs.existsSync(join(path, 'start_flow2api.py'))) {
        log.info('找到 flow2api 源路径:', path)
        return path
      }
    }
    
    log.warn('未找到 flow2api-main，使用默认路径')
    return paths[0]
  }
}

export function getFlow2apiPath(): string {
  const isDev = !app.isPackaged
  
  if (isDev) {
    // 开发环境：直接使用源路径
    return getSourceFlow2apiPath()
  } else {
    // 生产环境：使用用户数据目录
    const userDataPath = app.getPath('userData')
    const flow2apiUserPath = join(userDataPath, 'flow2api-main')
    
    log.info('Flow2API 用户目录:', flow2apiUserPath)
    
    // 检查是否已复制
    if (!fs.existsSync(join(flow2apiUserPath, 'start_flow2api.py'))) {
      const sourcePath = getSourceFlow2apiPath()
      log.info('正在将 flow2api 复制到用户目录...')
      log.info('源路径:', sourcePath)
      log.info('目标路径:', flow2apiUserPath)
      
      try {
        copyDir(sourcePath, flow2apiUserPath)
        log.info('复制完成')
      } catch (error) {
        log.error('复制失败:', error)
      }
    }
    
    return flow2apiUserPath
  }
}

function getPythonPath(): string {
  const flow2apiPath = getFlow2apiPath()
  
  // Hardcode for your environment
  const yourPythonPath = 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
  if (fs.existsSync(yourPythonPath)) {
    log.info('找到 Python:', yourPythonPath)
    return yourPythonPath
  }
  
  const commonPaths = [
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python39', 'python.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python38', 'python.exe'),
    'C:\\Program Files\\Python312\\python.exe',
    'C:\\Program Files\\Python311\\python.exe',
    'C:\\Program Files\\Python310\\python.exe',
    'C:\\Program Files\\Python39\\python.exe',
    'C:\\Program Files\\Python38\\python.exe'
  ]
  
  for (const path of commonPaths) {
    if (fs.existsSync(path)) {
      log.info('找到 Python:', path)
      return path
    }
  }
  
  log.warn('没有找到 Python，尝试用默认命令')
  return 'python'
}

function checkPython(): boolean {
  const pythonPath = getPythonPath()
  try {
    execSync(`"${pythonPath}" --version`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function checkDependencies(pythonPath: string, flow2apiPath: string): boolean {
  try {
    execSync(`"${pythonPath}" -c "import fastapi, uvicorn, curl_cffi"`, { 
      cwd: flow2apiPath,
      stdio: 'ignore' 
    })
    return true
  } catch {
    return false
  }
}

function installDependencies(pythonPath: string, flow2apiPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    log.info('正在安装 Flow2API 依赖...')
    
    const requirementsPath = join(flow2apiPath, 'requirements.txt')
    if (!fs.existsSync(requirementsPath)) {
      log.error('requirements.txt 不存在')
      resolve(false)
      return
    }
    
    const installProcess = spawn(pythonPath, ['-m', 'pip', 'install', '-r', 'requirements.txt', '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple'], {
      cwd: flow2apiPath,
      stdio: 'pipe'
    })
    
    installProcess.stdout?.on('data', (data) => {
      log.info('[依赖安装]', data.toString().trim())
    })
    
    installProcess.stderr?.on('data', (data) => {
      log.warn('[依赖安装]', data.toString().trim())
    })
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        log.info('依赖安装完成')
        resolve(true)
      } else {
        log.error('依赖安装失败')
        resolve(false)
      }
    })
  })
}

function checkServerReady(port: number = 8001): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/docs',
      method: 'GET',
      timeout: 1000
    }
    
    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 307)
    })
    
    req.on('error', () => {
      resolve(false)
    })
    
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    
    req.end()
  })
}

function updateFlow2apiConfig(flow2apiPath: string, port: number): void {
  const configPath = join(flow2apiPath, 'config', 'setting.toml')
  const exampleConfigPath = join(flow2apiPath, 'config', 'setting_example.toml')
  
  if (!fs.existsSync(configPath) && fs.existsSync(exampleConfigPath)) {
    log.info('正在复制配置文件...')
    fs.copyFileSync(exampleConfigPath, configPath)
  }
  
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, 'utf-8')
    const oldPortMatch = configContent.match(/port\s*=\s*(\d+)/)
    if (oldPortMatch) {
      const oldPort = oldPortMatch[1]
      configContent = configContent.replace(/port\s*=\s*\d+/, `port = ${port}`)
      log.info(`已将 Flow2API 端口从 ${oldPort} 改为 ${port}`)
      fs.writeFileSync(configPath, configContent, 'utf-8')
    }
  }
}

export async function startFlow2api(port: number = 8001): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      log.info('============================================')
      log.info('开始启动 Flow2API')
      log.info('============================================')
      
      if (!checkPython()) {
        const errorMsg = '未找到 Python，请先安装 Python 3.8+'
        log.error(errorMsg)
        reject(new Error(errorMsg))
        return
      }
      
      const flow2apiPath = getFlow2apiPath()
      const startScriptPath = join(flow2apiPath, 'start_flow2api.py')
      log.info('Flow2API 路径:', flow2apiPath)
      log.info('启动脚本路径:', startScriptPath)
      
      if (!fs.existsSync(startScriptPath)) {
        log.error('Flow2API 启动脚本不存在:', startScriptPath)
        reject(new Error('Flow2API 启动脚本不存在'))
        return
      }
      
      log.info('正在更新配置文件，端口:', port)
      updateFlow2apiConfig(flow2apiPath, port)
      
      const pythonPath = getPythonPath()
      log.info('使用的 Python:', pythonPath)
      
      if (!checkDependencies(pythonPath, flow2apiPath)) {
        log.info('首次使用，正在安装依赖...')
        const installSuccess = await installDependencies(pythonPath, flow2apiPath)
        if (!installSuccess) {
          log.error('依赖安装失败，无法启动')
          reject(new Error('依赖安装失败'))
          return
        }
      }
      
      log.info('正在启动 Flow2API...')
      
      flow2apiProcess = spawn(pythonPath, [startScriptPath], {
        cwd: flow2apiPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      })
      
      let stdoutBuffer = ''
      let stderrBuffer = ''
      
      if (flow2apiProcess.stdout) {
        flow2apiProcess.stdout.on('data', (data) => {
          const output = data.toString()
          stdoutBuffer += output
          log.info('[Flow2API]', output.trim())
        })
      }
      
      if (flow2apiProcess.stderr) {
        flow2apiProcess.stderr.on('data', (data) => {
          const output = data.toString()
          stderrBuffer += output
          log.warn('[Flow2API Error]', output.trim())
        })
      }
      
      flow2apiProcess.on('close', (code, signal) => {
        log.info('Flow2API 进程关闭，退出码:', code, '信号:', signal)
        if (!isStopping) {
          log.warn('Flow2API 异常退出！')
          log.warn('stdout 最后:', stdoutBuffer.slice(-500))
          log.warn('stderr:', stderrBuffer)
        }
        flow2apiProcess = null
      })
      
      flow2apiProcess.on('error', (error) => {
        log.error('Flow2API 进程错误:', error)
        reject(error)
      })
      
      log.info('Flow2API 进程已启动，PID:', flow2apiProcess.pid)
      log.info('正在等待服务就绪...')
      
      const maxAttempts = 60
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 1000))
        log.info(`[第 ${i+1}/${maxAttempts} 次检查] 检查端口 ${port}...`)
        
        const ready = await checkServerReady(port)
        if (ready) {
          log.info('============================================')
          log.info('✅ Flow2API 启动成功！')
          log.info('============================================')
          resolve(true)
          return
        }
      }
      
      log.error('============================================')
      log.error('❌ Flow2API 启动超时（60秒）')
      log.error('stdout:', stdoutBuffer)
      log.error('stderr:', stderrBuffer)
      log.error('============================================')
      reject(new Error('Flow2API 启动超时'))
      
    } catch (error) {
      log.error('启动 Flow2API 失败:', error)
      console.error('启动 Flow2API 失败:', error)
      reject(error)
    }
  })
}

export function stopFlow2api(): Promise<void> {
  return new Promise((resolve) => {
    if (!flow2apiProcess) {
      resolve()
      return
    }
    
    isStopping = true
    log.info('正在停止 Flow2API...')
    
    flow2apiProcess.kill('SIGTERM')
    
    const timeout = setTimeout(() => {
      if (flow2apiProcess) {
        flow2apiProcess.kill('SIGKILL')
      }
    }, 5000)
    
    flow2apiProcess.on('close', () => {
      clearTimeout(timeout)
      log.info('Flow2API 已停止')
      isStopping = false
      flow2apiProcess = null
      resolve()
    })
  })
}

export function isFlow2apiRunning(): boolean {
  return flow2apiProcess !== null && !flow2apiProcess.killed
}
