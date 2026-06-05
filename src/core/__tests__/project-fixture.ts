import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';

export interface TestProject {
  root: string;
  paths: ProjectPaths;
  cleanup: () => void;
}

export function createTestProject(prefix: string, opts?: { initialized?: boolean }): TestProject {
  const root = mkdtempSync(join(tmpdir(), prefix));
  if (opts?.initialized ?? true) {
    mkdirSync(join(root, '.spec-manager'), { recursive: true });
  }
  return {
    root,
    paths: getPaths(root),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
