/**
 * Package.json type definition
 */
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  [key: string]: unknown;
}
