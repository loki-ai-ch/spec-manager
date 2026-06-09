import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { ProjectPaths } from './paths.js';
import { writeAtomic } from './frontmatter.js';

export class FileTransaction {
  private readonly snapshots = new Map<string, string | null>();

  snapshot(filePath: string): void {
    if (!this.snapshots.has(filePath)) {
      this.snapshots.set(filePath, existsSync(filePath) ? readFileSync(filePath, 'utf8') : null);
    }
  }

  write(filePath: string, content: string): void {
    this.snapshot(filePath);
    writeAtomic(filePath, content);
  }

  remove(filePath: string): void {
    this.snapshot(filePath);
    rmSync(filePath, { force: true });
  }

  rollback(): void {
    for (const [filePath, content] of [...this.snapshots].reverse()) {
      if (content === null) rmSync(filePath, { force: true });
      else writeAtomic(filePath, content);
    }
  }
}

const activeTransactions = new Map<string, FileTransaction>();

export function withProjectTransaction<T>(
  paths: ProjectPaths,
  operation: string,
  callback: (tx: FileTransaction) => T,
): T {
  const lockPath = join(paths.configDir, 'write.lock');
  const active = activeTransactions.get(lockPath);
  if (active) return callback(active);
  let lockCreated = false;
  try {
    writeFileSync(lockPath, JSON.stringify({
      operation,
      createdAt: new Date().toISOString(),
      nonce: randomBytes(6).toString('hex'),
    }), { encoding: 'utf8', flag: 'wx' });
    lockCreated = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`WRITE_CONFLICT: project is locked by another write operation`);
    }
    throw err;
  }

  const tx = new FileTransaction();
  activeTransactions.set(lockPath, tx);
  try {
    return callback(tx);
  } catch (err) {
    tx.rollback();
    throw err;
  } finally {
    activeTransactions.delete(lockPath);
    if (lockCreated) rmSync(lockPath, { force: true });
  }
}
