import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildDesignContextReport } from '../design-context.js';
import { createTestProject } from './project-fixture.js';
import { buildDesignContextReport as exportedBuildDesignContextReport } from '../../index.js';

describe('design context core', () => {
  test('builds a summary for a valid DESIGN.md', () => {
    const project = createTestProject('design-context-valid-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Heritage',
        'description: Editorial system',
        'colors:',
        '  primary: "#1A1C1E"',
        '  accent: "{colors.primary}"',
        'typography:',
        '  body:',
        '    fontFamily: Public Sans',
        'spacing:',
        '  sm: 8px',
        'rounded:',
        '  sm: 4px',
        'components:',
        '  button-primary:',
        '    backgroundColor: "{colors.primary}"',
        '---',
        '',
        '## Overview',
        '',
        'Architectural minimalism with editorial density.',
        '',
        '## Colors',
        '',
        'Primary ink anchors the interface.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.schemaVersion).toBe('design-context.v1');
      expect(report.exists).toBe(true);
      expect(report.summary?.name).toBe('Heritage');
      expect(report.summary?.description).toBe('Editorial system');
      expect(report.summary?.sections).toEqual(['Overview', 'Colors']);
      expect(report.summary?.tokenCounts).toEqual({
        colors: 2,
        typography: 1,
        spacing: 1,
        rounded: 1,
        components: 1,
      });
      expect(report.summary?.proseSummary[0]).toContain('Overview: Architectural minimalism');
      expect(report.summary?.tokenSummary).toContain('colors: primary, accent');
      expect(report.result.errors).toBe(0);
    } finally {
      project.cleanup();
    }
  });

  test('returns a warning when DESIGN.md is missing', () => {
    const project = createTestProject('design-context-missing-');
    try {
      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.exists).toBe(false);
      expect(report.summary).toBeNull();
      expect(report.result.warnings).toBe(1);
      expect(report.findings[0]?.message).toContain('DESIGN.md not found');
    } finally {
      project.cleanup();
    }
  });

  test('warns about missing YAML while still extracting sections', () => {
    const project = createTestProject('design-context-no-yaml-');
    try {
      writeDesign(project.root, [
        '# Product Design',
        '',
        '## Overview',
        '',
        'A direct document without tokens.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.exists).toBe(true);
      expect(report.summary?.sections).toEqual(['Overview']);
      expect(report.result.warnings).toBe(1);
      expect(report.findings[0]?.message).toContain('No YAML frontmatter');
    } finally {
      project.cleanup();
    }
  });

  test('reports broken token references', () => {
    const project = createTestProject('design-context-broken-ref-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Broken',
        'colors:',
        '  primary: "{colors.missing}"',
        '---',
        '',
        '## Overview',
        '',
        'Broken reference fixture.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(1);
      expect(report.findings.some(item => item.message.includes('{colors.missing}'))).toBe(true);
    } finally {
      project.cleanup();
    }
  });

  test('reports duplicate section headings', () => {
    const project = createTestProject('design-context-duplicate-section-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Duplicate',
        '---',
        '',
        '## Overview',
        '',
        'One.',
        '',
        '## Overview',
        '',
        'Two.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(1);
      expect(report.findings.some(item => item.message.includes('Duplicate section heading'))).toBe(true);
    } finally {
      project.cleanup();
    }
  });

  test('warns when known sections are out of order', () => {
    const project = createTestProject('design-context-section-order-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Out Of Order',
        '---',
        '',
        '## Typography',
        '',
        'Type first.',
        '',
        '## Colors',
        '',
        'Colors later.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.warnings).toBe(1);
      expect(report.findings[0]?.message).toContain('canonical order');
    } finally {
      project.cleanup();
    }
  });

  test('exports buildDesignContextReport from the public entrypoint', () => {
    expect(exportedBuildDesignContextReport).toBe(buildDesignContextReport);
  });
});

function writeDesign(root: string, content: string): void {
  writeFileSync(join(root, 'DESIGN.md'), content, 'utf8');
}
