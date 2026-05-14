<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../includes/functions.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['action']) ? $_GET['action'] : '';

switch ($method . ':' . $path) {
    case 'GET:check':
        getLatestVersion();
        break;
    default:
        jsonError('接口不存在', 404);
}

function getLatestVersion() {
    $currentVersion = isset($_GET['version']) ? $_GET['version'] : '1.0.0';
    $currentBuildNumber = isset($_GET['buildNumber']) ? intval($_GET['buildNumber']) : 1;

    $ossEndpoint = 'https://xingmengai.oss-cn-beijing.aliyuncs.com';
    $versionFileUrl = $ossEndpoint . '/app/version.json';

    $versionData = @file_get_contents($versionFileUrl);

    if ($versionData === false) {
        jsonError('无法读取版本文件', 500);
        return;
    }

    $remoteInfo = json_decode($versionData, true);

    if (!$remoteInfo || !isset($remoteInfo['version'])) {
        jsonError('版本文件格式无效', 500);
        return;
    }

    $remoteVersion = $remoteInfo['version'];
    $remoteBuildNumber = isset($remoteInfo['buildNumber']) ? intval($remoteInfo['buildNumber']) : 1;

    $needsUpdate = compareVersion($currentVersion, $remoteVersion) < 0 ||
        ($currentVersion === $remoteVersion && $currentBuildNumber < $remoteBuildNumber);

    jsonSuccess([
        'hasUpdate' => $needsUpdate,
        'versionInfo' => [
            'version' => $remoteVersion,
            'buildNumber' => $remoteBuildNumber,
            'releaseDate' => isset($remoteInfo['releaseDate']) ? $remoteInfo['releaseDate'] : date('Y-m-d'),
            'releaseNotes' => isset($remoteInfo['releaseNotes']) ? $remoteInfo['releaseNotes'] : '',
            'downloadUrl' => isset($remoteInfo['downloadUrl']) ? $remoteInfo['downloadUrl'] : '',
            'minVersion' => isset($remoteInfo['minVersion']) ? $remoteInfo['minVersion'] : '',
            'forceUpdate' => isset($remoteInfo['forceUpdate']) ? $remoteInfo['forceUpdate'] : true
        ]
    ]);
}

function compareVersion($v1, $v2) {
    $parts1 = array_map('intval', explode('.', $v1));
    $parts2 = array_map('intval', explode('.', $v2));

    for ($i = 0; $i < max(count($parts1), count($parts2)); $i++) {
        $p1 = $parts1[$i] ?? 0;
        $p2 = $parts2[$i] ?? 0;
        if ($p1 > $p2) return 1;
        if ($p1 < $p2) return -1;
    }
    return 0;
}