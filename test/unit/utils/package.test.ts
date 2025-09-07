import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPackageJson } from '../../../src/utils/package.ts';

vi.setConfig({ testTimeout: 100 });

vi.mock('fs');
vi.mock('path');
vi.mock('url');

const mockReadFileSync = vi.mocked(readFileSync);
const mockDirname = vi.mocked(dirname);
const mockJoin = vi.mocked(join);
const mockFileURLToPath = vi.mocked(fileURLToPath);

describe('getPackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should read and parse package.json successfully', () => {
    const mockPackageJson = {
      name: 'perf-audit-cli',
      version: '1.0.0',
      description: 'Performance audit CLI tool',
      scripts: {
        build: 'tsc',
        test: 'vitest',
      },
      dependencies: {
        chalk: '^4.1.0',
      },
    };

    const importMetaUrl = 'file:///project/src/commands/analyze.ts';
    const mockFilePath = '/project/src/commands/analyze.ts';
    const mockDirPath = '/project/src/commands';
    const mockPackageJsonPath = '/project/package.json';

    mockFileURLToPath.mockReturnValue(mockFilePath);
    mockDirname.mockReturnValue(mockDirPath);
    mockJoin.mockReturnValue(mockPackageJsonPath);
    mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

    const result = getPackageJson(importMetaUrl);

    expect(mockFileURLToPath).toHaveBeenCalledWith(importMetaUrl);
    expect(mockDirname).toHaveBeenCalledWith(mockFilePath);
    expect(mockJoin).toHaveBeenCalledWith(mockDirPath, '../../package.json');
    expect(mockReadFileSync).toHaveBeenCalledWith(mockPackageJsonPath, 'utf-8');
    expect(result).toEqual(mockPackageJson);
  });

  it('should handle different import meta URLs', () => {
    const importMetaUrl = 'file:///project/src/utils/config.ts';
    const mockFilePath = '/project/src/utils/config.ts';
    const mockDirPath = '/project/src/utils';
    const mockPackageJsonPath = '/project/package.json';

    mockFileURLToPath.mockReturnValue(mockFilePath);
    mockDirname.mockReturnValue(mockDirPath);
    mockJoin.mockReturnValue(mockPackageJsonPath);
    mockReadFileSync.mockReturnValue('{"name":"test-package","version":"2.0.0"}');

    const result = getPackageJson(importMetaUrl);

    expect(mockFileURLToPath).toHaveBeenCalledWith(importMetaUrl);
    expect(mockDirname).toHaveBeenCalledWith(mockFilePath);
    expect(mockJoin).toHaveBeenCalledWith(mockDirPath, '../../package.json');
    expect(result).toEqual({ name: 'test-package', version: '2.0.0' });
  });

  it('should throw error when package.json contains invalid JSON', () => {
    const importMetaUrl = 'file:///project/src/test.ts';

    mockFileURLToPath.mockReturnValue('/project/src/test.ts');
    mockDirname.mockReturnValue('/project/src');
    mockJoin.mockReturnValue('/project/package.json');
    mockReadFileSync.mockReturnValue('invalid json content');

    expect(() => getPackageJson(importMetaUrl)).toThrow();
  });

  it('should throw error when file reading fails', () => {
    const importMetaUrl = 'file:///project/src/test.ts';

    mockFileURLToPath.mockReturnValue('/project/src/test.ts');
    mockDirname.mockReturnValue('/project/src');
    mockJoin.mockReturnValue('/project/package.json');
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    expect(() => getPackageJson(importMetaUrl)).toThrow('ENOENT: no such file or directory');
  });

  it('should handle empty package.json', () => {
    const importMetaUrl = 'file:///project/src/test.ts';

    mockFileURLToPath.mockReturnValue('/project/src/test.ts');
    mockDirname.mockReturnValue('/project/src');
    mockJoin.mockReturnValue('/project/package.json');
    mockReadFileSync.mockReturnValue('{}');

    const result = getPackageJson(importMetaUrl);

    expect(result).toEqual({});
  });

  it('should handle complex package.json structure', () => {
    const complexPackageJson = {
      name: '@company/perf-audit',
      version: '1.2.3',
      description: 'Complex package with all fields',
      main: './dist/index.js',
      bin: {
        'perf-audit': './dist/bin/cli.js',
      },
      scripts: {
        build: 'tsc',
        test: 'vitest run',
        'test:watch': 'vitest',
      },
      dependencies: {
        chalk: '^4.1.0',
        commander: '^8.3.0',
      },
      devDependencies: {
        typescript: '^4.7.4',
        vitest: '^0.23.0',
      },
      peerDependencies: {
        node: '>=14.0.0',
      },
      keywords: ['performance', 'audit', 'cli'],
      author: 'Test Author <test@example.com>',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/company/perf-audit.git',
      },
    };

    const importMetaUrl = 'file:///project/src/test.ts';

    mockFileURLToPath.mockReturnValue('/project/src/test.ts');
    mockDirname.mockReturnValue('/project/src');
    mockJoin.mockReturnValue('/project/package.json');
    mockReadFileSync.mockReturnValue(JSON.stringify(complexPackageJson));

    const result = getPackageJson(importMetaUrl);

    expect(result).toEqual(complexPackageJson);
  });
});
