import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import {
  emptyIntegrityExemptionRegistry,
  mergeIntegrityExemptions,
  readIntegrityExemptions,
  writeIntegrityExemptions,
  type IntegrityExemption,
} from '../integrity-exemptions.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-exemptions-');
});

afterEach(() => {
  project.cleanup();
});

describe('integrity exemptions', () => {
  it('treats a missing registry as empty and round-trips valid entries', () => {
    expect(readIntegrityExemptions(project.paths)).toEqual({
      registry: emptyIntegrityExemptionRegistry(),
      problems: [],
    });
    const registry = mergeIntegrityExemptions(emptyIntegrityExemptionRegistry(), [exemption()]);
    writeIntegrityExemptions(project.paths, registry);
    expect(readIntegrityExemptions(project.paths)).toEqual({ registry, problems: [] });
  });

  it('reports invalid JSON and unsupported registry versions', () => {
    writeFileSync(project.paths.integrityExemptionsFile, '{', 'utf8');
    expect(readIntegrityExemptions(project.paths).problems[0].message).toContain('cannot parse');
    writeFileSync(project.paths.integrityExemptionsFile, JSON.stringify({ version: 2, exemptions: [] }), 'utf8');
    expect(readIntegrityExemptions(project.paths).problems[0].message).toContain('version 1');
  });

  it('rejects conflicting ids and task keys while allowing identical merges', () => {
    const first = exemption();
    const registry = mergeIntegrityExemptions(emptyIntegrityExemptionRegistry(), [first]);
    expect(mergeIntegrityExemptions(registry, [first]).exemptions).toHaveLength(1);
    expect(() => mergeIntegrityExemptions(registry, [{ ...first, reason: 'different' }])).toThrow('EXEMPTION_CONFLICT');
    expect(() => mergeIntegrityExemptions(registry, [{ ...first, id: 'other' }])).toThrow('EXEMPTION_CONFLICT');
  });
});

function exemption(): IntegrityExemption {
  return {
    id: 'migration:auth-L3.1.1:T-001',
    kind: 'legacy-missing-verification',
    specCode: 'auth-L3.1.1',
    taskId: 'T-001',
    reason: 'legacy task',
    createdAt: '2026-06-08T00:00:00.000Z',
    migrationId: 'migration',
  };
}
