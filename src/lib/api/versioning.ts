'use server'

import { NextRequest } from 'next/server'

export const API_VERSIONS = {
  v1: '1.0.0',
} as const

export type ApiVersion = keyof typeof API_VERSIONS

export function getApiVersion(request: NextRequest): ApiVersion {
  // Check header first
  const headerVersion = request.headers.get('X-API-Version')
  if (headerVersion && headerVersion in API_VERSIONS) {
    return headerVersion as ApiVersion
  }
  
  // Check URL path
  const path = request.nextUrl.pathname
  const versionMatch = path.match(/\/api\/(v\d+)\//)
  if (versionMatch && versionMatch[1] in API_VERSIONS) {
    return versionMatch[1] as ApiVersion
  }
  
  // Default to latest version
  return 'v1'
}

export function validateApiVersion(version: string): version is ApiVersion {
  return version in API_VERSIONS
}

export function extractVersionFromPath(path: string): {
  version: ApiVersion
  pathWithoutVersion: string
} {
  const versionMatch = path.match(/\/api\/(v\d+)(\/.*)/)
  if (versionMatch && validateApiVersion(versionMatch[1])) {
    return {
      version: versionMatch[1] as ApiVersion,
      pathWithoutVersion: versionMatch[2],
    }
  }
  
  // If no version in path, assume v1 and use full path
  return {
    version: 'v1',
    pathWithoutVersion: path.replace('/api', ''),
  }
}