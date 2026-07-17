import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { withProjectTransaction } from '../transaction.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-transaction-');
});

afterEach(() => {
  project.cleanup();
});

describe('withProjectTransaction', () => {
  it('rejects a concurrent writer', () => {
    const lockPath = join(project.paths.configDir, 'write.lock');
    writeFileSync(lockPath, '{"operation":"other process"}', 'utf8');
    expect(() => withProjectTransaction(project.paths, 'write', () => undefined)).toThrow(/WRITE_CONFLICT/);
    expect(existsSync(lockPath)).toBe(true);
  });

  it('reuses the active transaction for nested domain writes', () => {
    withProjectTransaction(project.paths, 'outer', outer => {
      withProjectTransaction(project.paths, 'inner', inner => {
        expect(inner).toBe(outer);
      });
    });
    expect(existsSync(join(project.paths.configDir, 'write.lock'))).toBe(false);
  });

  it('rolls back written files after failure', () => {
    const target = join(project.root, 'state.json');
    expect(() => withProjectTransaction(project.paths, 'write', tx => {
      tx.write(target, '{"changed":true}');
      throw new Error('fail');
    })).toThrow(/fail/);
    expect(existsSync(target)).toBe(false);
  });

  it('rolls back a knowledge registry write after failure', () => {
    expect(() => withProjectTransaction(project.paths, 'knowledge write', tx => {
      tx.write(project.paths.knowledgeFile, '{"schemaVersion":"knowledge-registry.v1"}');
      throw new Error('knowledge failure');
    })).toThrow(/knowledge failure/);
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });

  it('commits successful writes', () => {
    const target = join(project.root, 'state.json');
    withProjectTransaction(project.paths, 'write', tx => tx.write(target, '{"ok":true}'));
    expect(readFileSync(target, 'utf8')).toBe('{"ok":true}');
  });
});
