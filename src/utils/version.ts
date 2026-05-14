import versionInfo from '../../version.json'

export interface VersionInfo {
  version: string
  buildNumber: number
  releaseDate: string
  updateUrl: string
}

export const getVersion = (): string => {
  return versionInfo.version
}

export const getBuildNumber = (): number => {
  return versionInfo.buildNumber
}

export const getVersionInfo = (): VersionInfo => {
  return {
    ...versionInfo,
    version: getVersion(),
    buildNumber: getBuildNumber(),
  }
}

export const getFullVersion = (): string => {
  return `v${getVersion()}`
}

export const compareVersion = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

export const isNewerVersion = (remoteVersion: string): boolean => {
  return compareVersion(remoteVersion, getVersion()) > 0
}
