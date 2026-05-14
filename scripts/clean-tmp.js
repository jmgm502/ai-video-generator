const fs = require('fs');
const path = require('path');

const tmpDir = path.join(__dirname, '..', 'flow2api-main', 'src', 'tmp');

function deleteDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`✓ 已清理临时目录: ${dirPath}`);
  } catch (error) {
    console.warn(`⚠ 清理临时目录时遇到问题: ${error.message}`);
    console.log(`提示: 请关闭正在运行的应用程序后重试`);
  }
}

deleteDirectory(tmpDir);

console.log('✓ 临时文件清理完成');
