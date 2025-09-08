import fs from 'fs';
import path from 'path';
import { beforeEach, vi } from 'vitest';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup test data directory
const testDataDir = path.join(process.cwd(), 'test/test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Clean up test data before each test suite
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test helpers
global.testHelpers = {
  createTempDir: () => {
    const tempDir = path.join(testDataDir, `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },
};

// Type declarations for global helpers
declare global {
  var testHelpers: {
    createTempDir: () => string;
  };
}
