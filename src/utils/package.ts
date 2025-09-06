import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { PackageJson } from '../types/package.ts';

/**
 * Get package.json data from the project root
 * @param importMetaUrl - import.meta.url from the calling module
 * @returns Package.json data
 */
export function getPackageJson(importMetaUrl: string): PackageJson {
  const __dirname = dirname(fileURLToPath(importMetaUrl));
  const packageJsonPath = join(__dirname, '../../package.json');
  return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
}
