const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createReadStream } = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

function log(message, type = 'info') {
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📦';
  console.log(`${prefix} ${message}`);
}

function readVersionJson() {
  const versionFile = path.join(ROOT_DIR, 'version.json');
  if (!fs.existsSync(versionFile)) {
    throw new Error('version.json 文件不存在');
  }
  return JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
}

function updateVersionJson(newVersion, newBuildNumber) {
  const versionFile = path.join(ROOT_DIR, 'version.json');
  const versionData = readVersionJson();

  versionData.version = newVersion;
  versionData.buildNumber = newBuildNumber;

  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  log(`版本信息已更新: v${newVersion} (build ${newBuildNumber})`);

  const packageFile = path.join(ROOT_DIR, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
  packageData.version = newVersion;
  fs.writeFileSync(packageFile, JSON.stringify(packageData, null, 2));
  log(`package.json 版本已更新: v${newVersion}`);
}

async function buildProject() {
  log('开始构建项目...');

  try {
    execSync('npm run electron:build', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    log('项目构建完成');
  } catch (error) {
    throw new Error('项目构建失败');
  }
}

function updateUpdateLogs(newVersion, releaseNotes) {
  const updateLogsPath = path.join(ROOT_DIR, 'update-logs.json');
  if (fs.existsSync(updateLogsPath)) {
    try {
      const logsContent = fs.readFileSync(updateLogsPath, 'utf-8');
      const logs = JSON.parse(logsContent);
      const today = new Date().toISOString().split('T')[0];
      
      // 如果该版本已存在且已有 notes 内容，保留手动编辑的内容
      const existingNotes = logs[newVersion]?.notes;
      const finalNotes = existingNotes && existingNotes !== '性能优化和问题修复' 
        ? existingNotes 
        : releaseNotes;
      
      logs[newVersion] = {
        date: today,
        notes: finalNotes
      };
      fs.writeFileSync(updateLogsPath, JSON.stringify(logs, null, 2));
      log(`update-logs.json 已更新: v${newVersion}`);
    } catch (error) {
      log(`update-logs.json 更新失败: ${error.message}`, 'error');
    }
  }
}

function calculateFileChecksum(filePath) {
  const hash = crypto.createHash('sha512');
  const stream = createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function findFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const found = files.find(f => pattern.test(f));
  return found ? path.join(dir, found) : null;
}

async function uploadToOss(releaseDir, versionInfo, ossConfig, newVersion) {
  log('开始上传到阿里云OSS...');

  const OSS = require('ali-oss');

  const client = new OSS({
    region: ossConfig.region,
    accessKeyId: ossConfig.accessKeyId,
    accessKeySecret: ossConfig.accessKeySecret,
    bucket: ossConfig.bucket
  });

  const releaseFiles = fs.readdirSync(releaseDir);
  log(`发布目录文件: ${releaseFiles.join(', ')}`);

  const exeFiles = releaseFiles.filter(f => f.endsWith('.exe') && !f.includes('.blockmap') && f.includes(newVersion));
  if (exeFiles.length === 0) {
    throw new Error(`未找到安装包文件 (.exe) 匹配版本 ${newVersion}`);
  }
  const exeFile = exeFiles[0];

  const exePath = path.join(releaseDir, exeFile);
  const latestJsonPath = path.join(releaseDir, 'latest.json');

  if (!fs.existsSync(exePath)) {
    throw new Error(`未找到安装包文件: ${exeFile}`);
  }

  const fileChecksum = await calculateFileChecksum(exePath);
  const fileSize = fs.statSync(exePath).size;

  log(`exe 文件大小: ${fileSize} bytes`);
  log(`exe SHA512: ${fileChecksum.substring(0, 16)}...`);

  const version = newVersion;
  const releaseDate = new Date().toISOString();
  const releaseNotes = process.env.RELEASE_NOTES || '性能优化和问题修复';

  const latestJsonContent = JSON.stringify({
    version: version,
    files: [
      {
        url: exeFile,
        sha512: fileChecksum,
        size: fileSize
      }
    ],
    path: exeFile,
    sha512: fileChecksum,
    releaseDate: releaseDate,
    releaseNotes: releaseNotes
  }, null, 2);

  fs.writeFileSync(latestJsonPath, latestJsonContent, 'utf-8');
  log('latest.json 已更新');

  try {
    log(`上传安装包: ${exeFile}...`);
    await client.put(exeFile, exePath, {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    log('安装包上传成功');

    log('上传 latest.json...');
    await client.put('latest.json', Buffer.from(latestJsonContent, 'utf-8'), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    log('latest.json 上传成功');

    const versionJsonContent = JSON.stringify({
      version: version,
      buildNumber: versionInfo.buildNumber,
      releaseDate: releaseDate,
      releaseNotes: releaseNotes,
      downloadUrl: `${ossConfig.publicUrl}/${exeFile}`
    }, null, 2);

    log('上传 version.json...');
    await client.put('version.json', Buffer.from(versionJsonContent), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    log('version.json 上传成功');

    log(`✅ 上传完成！`);
    log(`   安装包地址: ${ossConfig.publicUrl}/${exeFile}`);
    log(`   版本: v${version}`);

  } catch (error) {
    log(`OSS上传失败: ${error.message}`, 'error');
    throw error;
  }
}

function parseOssUrl(url) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const parts = hostname.split('.');

  const bucket = parts[0];
  const region = parts[1];

  return {
    bucket,
    region,
    endpoint: `https://${bucket}.${region}.aliyuncs.com`,
    publicUrl: url
  };
}

async function main() {
  console.log('');
  console.log('='.repeat(50));
  console.log('  星梦AI - 打包并上传更新');
  console.log('='.repeat(50));
  console.log('');

  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('用法:');
    console.log('  node scripts/build-and-upload.js <新版本号> [新构建号] [OSS地址] [AccessKey ID] [AccessKey Secret]');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/build-and-upload.js 1.1.0');
    console.log('  node scripts/build-and-upload.js 1.1.0 2');
    console.log('  node scripts/build-and-upload.js 1.1.0 2 https://xingmengai.oss-cn-beijing.aliyuncs.com/app LTAI5tHuESQ1X4zMyKdZrL1e jY4NCG7baZwbHGLbuRIkirJsCpr4Hs');
    return;
  }

  const newVersion = args[0];
  const newBuildNumber = parseInt(args[1]) || 1;

  const ossEndpoint = args[2] || process.env.OSS_ENDPOINT || 'https://xingmengai.oss-cn-beijing.aliyuncs.com';
  const ossAccessKeyId = args[3] || process.env.OSS_ACCESS_KEY || 'LTAI5tHuESQ1X4zMyKdZrL1e';
  const ossAccessKeySecret = args[4] || process.env.OSS_SECRET_KEY || 'jY4NCG7baZwbHGLbuRIkirJsCpr4Hs';

  log(`使用OSS配置: ${ossEndpoint}`);
  log(`AccessKey: ${ossAccessKeyId.substring(0, 8)}...`);

  try {
    const versionInfo = readVersionJson();
    log(`当前版本: v${versionInfo.version} (build ${versionInfo.buildNumber})`);

    updateVersionJson(newVersion, newBuildNumber);

    const releaseNotes = process.env.RELEASE_NOTES || '性能优化和问题修复';
    updateUpdateLogs(newVersion, releaseNotes);

    await buildProject();

    const releaseDir = path.join(ROOT_DIR, 'release');
    if (!fs.existsSync(releaseDir)) {
      throw new Error('发布目录不存在，请检查构建是否成功');
    }

    const ossConfig = parseOssUrl(ossEndpoint);
    ossConfig.accessKeyId = ossAccessKeyId;
    ossConfig.accessKeySecret = ossAccessKeySecret;

    const newVersionInfo = readVersionJson();
    await uploadToOss(releaseDir, newVersionInfo, ossConfig, newVersion);

    log(`版本 v${newVersion} 打包上传完成！`, 'success');

  } catch (error) {
    log(`打包上传失败: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
