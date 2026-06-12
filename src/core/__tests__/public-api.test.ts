import { describe, expect, it } from 'vitest';

describe('public API contract', () => {
  it('exports architecture refactor boundaries and existing compatibility facades', async () => {
    const api = await import('../../index.js');

    for (const exportName of [
      'runTaskCompletion',
      'validateSpecParentPolicy',
      'applySpecStatusPolicy',
      'buildProjectSnapshot',
      'planArchiveChange',
      'createSpec',
      'updateSpec',
      'completeTask',
    ]) {
      expect(typeof api[exportName as keyof typeof api]).toBe('function');
    }
  });

  it('does not expand the public archive facade implicitly', async () => {
    const api = await import('../../index.js');

    expect('archiveChange' in api).toBe(false);
  });
});
