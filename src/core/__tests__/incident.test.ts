import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createIncident, updateIncidentStatus, findIncident } from '../incident.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-incident-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('updateIncidentStatus', () => {
  it('拒绝非法 status 且保留原状态', () => {
    const inc = createIncident({
      paths,
      ruleId: 'R1',
      severity: 'high',
      title: 'Bad status test',
    });

    expect(() => updateIncidentStatus(paths, inc.id, 'done' as never)).toThrow(/status 非法/);
    expect(findIncident(paths, inc.id)!.fm.status).toBe('open');
  });
});
