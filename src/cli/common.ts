import type { ProjectPaths } from '../core/paths.js';

export function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

export function requireInitialized(paths: ProjectPaths): void {
  if (!paths.isInitialized) {
    fail('✗ 项目未初始化。先跑: spec-manager project init');
  }
}

export function printPathGroup(label: string, paths: string[]): void {
  if (paths.length === 0) return;
  console.log(`${label}:`);
  for (const p of paths) console.log(`  - ${p}`);
}
