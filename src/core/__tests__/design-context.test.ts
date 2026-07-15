import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  buildDesignContextDiffReport,
  buildDesignContextExportReport,
  buildDesignContextReport,
  buildDesignContextTemplate,
} from '../design-context.js';
import { createTestProject } from './project-fixture.js';
import {
  buildDesignContextDiffReport as exportedBuildDesignContextDiffReport,
  buildDesignContextExportReport as exportedBuildDesignContextExportReport,
  buildDesignContextReport as exportedBuildDesignContextReport,
  buildDesignContextTemplate as exportedBuildDesignContextTemplate,
} from '../../index.js';

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

  test('prefers specs/DESIGN.md over root DESIGN.md by default', () => {
    const project = createTestProject('design-context-managed-default-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Legacy Root',
        'colors:',
        '  primary: "#111111"',
        '---',
        '',
        '## Overview',
        '',
        'Legacy root design.',
      ].join('\n'));
      writeManagedDesign(project.root, [
        '---',
        'name: Managed Specs',
        'colors:',
        '  primary: "#222222"',
        '---',
        '',
        '## Overview',
        '',
        'Managed specs design.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.exists).toBe(true);
      expect(report.path).toBe(join(project.root, 'specs', 'DESIGN.md'));
      expect(report.summary?.name).toBe('Managed Specs');
    } finally {
      project.cleanup();
    }
  });

  test('allows explicit root DESIGN.md to override managed default', () => {
    const project = createTestProject('design-context-explicit-root-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Explicit Root',
        'colors:',
        '  primary: "#111111"',
        '---',
        '',
        '## Overview',
        '',
        'Explicit root design.',
      ].join('\n'));
      writeManagedDesign(project.root, [
        '---',
        'name: Managed Specs',
        'colors:',
        '  primary: "#222222"',
        '---',
        '',
        '## Overview',
        '',
        'Managed specs design.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths, filePath: 'DESIGN.md' });

      expect(report.exists).toBe(true);
      expect(report.path).toBe(join(project.root, 'DESIGN.md'));
      expect(report.summary?.name).toBe('Explicit Root');
    } finally {
      project.cleanup();
    }
  });

  test('returns a warning when DESIGN.md is missing', () => {
    const project = createTestProject('design-context-missing-');
    try {
      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.exists).toBe(false);
      expect(report.path).toBe(join(project.root, 'specs', 'DESIGN.md'));
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

  test('accepts valid token schema including component typography composite references', () => {
    const project = createTestProject('design-context-schema-valid-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Schema Valid',
        'colors:',
        '  primary: "#123abc"',
        '  surface: "rgb(255 255 255)"',
        'typography:',
        '  body:',
        '    fontFamily: Inter',
        '    fontSize: 16px',
        '    fontWeight: 400',
        '    lineHeight: 1.5',
        '    letterSpacing: 0em',
        'spacing:',
        '  sm: 8px',
        '  columns: 12',
        'rounded:',
        '  sm: 4px',
        'components:',
        '  button-primary:',
        '    backgroundColor: "{colors.primary}"',
        '    textColor: "{colors.surface}"',
        '    typography: "{typography.body}"',
        '    rounded: "{rounded.sm}"',
        '    padding: "{spacing.sm}"',
        '---',
        '',
        '## Overview',
        '',
        'Valid schema fixture.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(0);
      expect(report.findings.some(item => item.message.includes('primitive value'))).toBe(false);
    } finally {
      project.cleanup();
    }
  });

  test('reports invalid color dimension typography and component schema', () => {
    const project = createTestProject('design-context-schema-invalid-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Schema Invalid',
        'colors:',
        '  primary: "not a color"',
        'spacing:',
        '  sm: huge',
        'rounded:',
        '  - 4px',
        'typography:',
        '  body: Public Sans',
        '  caption:',
        '    fontFamily: Inter',
        '    fontSize: large',
        'components:',
        '  button-primary: solid',
        '---',
        '',
        '## Overview',
        '',
        'Invalid schema fixture.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBeGreaterThanOrEqual(5);
      expect(report.findings.some(item => item.path === 'colors.primary')).toBe(true);
      expect(report.findings.some(item => item.path === 'spacing.sm')).toBe(true);
      expect(report.findings.some(item => item.path === 'rounded')).toBe(true);
      expect(report.findings.some(item => item.path === 'typography.body')).toBe(true);
      expect(report.findings.some(item => item.path === 'components.button-primary')).toBe(true);
    } finally {
      project.cleanup();
    }
  });

  test('reports invalid rgb and rgba color functions', () => {
    const project = createTestProject('design-context-invalid-rgb-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Invalid RGB',
        'colors:',
        '  primary: "rgb(nope)"',
        '  accent: "rgba(300, 0, 0, 2)"',
        '  surface: "rgb(255 255 255 / 50%)"',
        '---',
        '',
        '## Overview',
        '',
        'Invalid color function fixture.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(2);
      expect(report.findings.some(item => item.path === 'colors.primary')).toBe(true);
      expect(report.findings.some(item => item.path === 'colors.accent')).toBe(true);
      expect(report.findings.some(item => item.path === 'colors.surface')).toBe(false);
    } finally {
      project.cleanup();
    }
  });

  test('warns for unknown component properties without failing schema lint', () => {
    const project = createTestProject('design-context-schema-component-warning-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Component Warning',
        'colors:',
        '  primary: "#123456"',
        'components:',
        '  button-primary:',
        '    backgroundColor: "{colors.primary}"',
        '    animation: spring',
        '---',
        '',
        '## Overview',
        '',
        'Unknown component property fixture.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(0);
      expect(report.result.warnings).toBeGreaterThanOrEqual(1);
      expect(report.findings.some(item => item.path === 'components.button-primary.animation')).toBe(true);
    } finally {
      project.cleanup();
    }
  });

  test('rejects non-component references to composite tokens', () => {
    const project = createTestProject('design-context-schema-composite-ref-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Composite Ref',
        'colors:',
        '  primary: "{typography.body}"',
        'typography:',
        '  body:',
        '    fontFamily: Inter',
        '    fontSize: 16px',
        '---',
        '',
        '## Overview',
        '',
        'Composite reference fixture.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(1);
      expect(report.findings[0]?.message).toContain('primitive value');
    } finally {
      project.cleanup();
    }
  });

  test('reports design lint parity findings for missing and token-like design system details', () => {
    const project = createTestProject('design-context-lint-parity-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Parity',
        'colours:',
        '  brand: "#123456"',
        'colors:',
        '  accent: "#777777"',
        '  unused: "#abcdef"',
        'components:',
        '  button-primary:',
        '    backgroundColor: "{colors.accent}"',
        '    textColor: "#777777"',
        '---',
        '',
        '## Overview',
        '',
        'Use {colors.missing} only in prose.',
      ].join('\n'));

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.result.errors).toBe(0);
      expect(report.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', path: 'colors', message: expect.stringContaining("No 'primary' color") }),
        expect.objectContaining({ severity: 'warning', path: 'typography', message: expect.stringContaining('No typography tokens') }),
        expect.objectContaining({ severity: 'info', path: 'tokens', message: expect.stringContaining('Design system defines') }),
        expect.objectContaining({ severity: 'warning', path: 'colours', message: expect.stringContaining('did you mean "colors"') }),
        expect.objectContaining({ severity: 'warning', path: 'colours', message: expect.stringContaining('looks like a design-token map') }),
        expect.objectContaining({ severity: 'info', path: 'sections.Colors', message: expect.stringContaining("No 'Colors' section") }),
        expect.objectContaining({ severity: 'info', path: 'sections.Overview', message: expect.stringContaining('{colors.missing}') }),
        expect.objectContaining({ severity: 'warning', path: 'colors.unused', message: expect.stringContaining('never referenced') }),
        expect.objectContaining({ severity: 'warning', path: 'components.button-primary', message: expect.stringContaining('contrast ratio 1.00:1') }),
      ]));
    } finally {
      project.cleanup();
    }
  });

  test('diffs token groups with stable added removed and modified keys', () => {
    const project = createTestProject('design-context-diff-tokens-');
    try {
      writeDesignFile(project.root, 'DESIGN.before.md', [
        '---',
        'name: Diff Before',
        'colors:',
        '  primary: "#111111"',
        '  secondary: "#222222"',
        'spacing:',
        '  sm: 8px',
        'components:',
        '  button:',
        '    backgroundColor: "{colors.primary}"',
        '---',
        '',
        '## Overview',
        '',
        'Original design.',
      ].join('\n'));
      writeDesign(project.root, [
        '---',
        'name: Diff After',
        'colors:',
        '  accent: "#444444"',
        '  primary: "#333333"',
        'spacing:',
        '  sm: 8px',
        '  md: 16px',
        'components:',
        '  button:',
        '    backgroundColor: "{colors.accent}"',
        '---',
        '',
        '## Overview',
        '',
        'Original design.',
      ].join('\n'));

      const diff = buildDesignContextDiffReport({
        paths: project.paths,
        beforePath: 'DESIGN.before.md',
        afterPath: 'DESIGN.md',
      });

      expect(diff.schemaVersion).toBe('design-context-diff.v1');
      expect(diff.tokens.colors.added).toEqual(['accent']);
      expect(diff.tokens.colors.removed).toEqual(['secondary']);
      expect(diff.tokens.colors.modified).toEqual(['primary']);
      expect(diff.tokens.spacing.added).toEqual(['md']);
      expect(diff.tokens.components.modified).toEqual(['button']);
      expect(diff.regression).toBe(true);
    } finally {
      project.cleanup();
    }
  });

  test('diffs canonical H2 sections by prose content', () => {
    const project = createTestProject('design-context-diff-sections-');
    try {
      writeDesignFile(project.root, 'DESIGN.before.md', [
        '---',
        'name: Sections Before',
        'colors:',
        '  primary: "#111111"',
        '---',
        '',
        '## Overview',
        '',
        'Static design overview.',
        '',
        '## Colors',
        '',
        'Palette remains.',
        '',
        '## Typography',
        '',
        'Type rules.',
      ].join('\n'));
      writeDesign(project.root, [
        '---',
        'name: Sections After',
        'colors:',
        '  primary: "#111111"',
        '---',
        '',
        '## Overview',
        '',
        'Changed design overview.',
        '',
        '## Colors',
        '',
        'Palette remains.',
        '',
        '## Components',
        '',
        'Component guidance.',
      ].join('\n'));

      const diff = buildDesignContextDiffReport({
        paths: project.paths,
        beforePath: 'DESIGN.before.md',
        afterPath: 'DESIGN.md',
      });

      expect(diff.sections.added).toEqual(['Components']);
      expect(diff.sections.removed).toEqual(['Typography']);
      expect(diff.sections.modified).toEqual(['Overview']);
    } finally {
      project.cleanup();
    }
  });

  test('reports lint result delta as a regression when after findings increase', () => {
    const project = createTestProject('design-context-diff-findings-');
    try {
      writeDesignFile(project.root, 'DESIGN.before.md', [
        '---',
        'name: Clean Before',
        'colors:',
        '  primary: "#111111"',
        '---',
        '',
        '## Overview',
        '',
        'Clean design.',
      ].join('\n'));
      writeDesign(project.root, [
        '---',
        'name: Broken After',
        'colors:',
        '  primary: "not a color"',
        '---',
        '',
        '## Overview',
        '',
        'Broken design.',
      ].join('\n'));

      const diff = buildDesignContextDiffReport({
        paths: project.paths,
        beforePath: 'DESIGN.before.md',
        afterPath: 'DESIGN.md',
      });

      expect(diff.findings.before.errors).toBe(0);
      expect(diff.findings.after.errors).toBe(1);
      expect(diff.findings.delta.errors).toBe(1);
      expect(diff.regression).toBe(true);
    } finally {
      project.cleanup();
    }
  });

  test('exports tokens-json with stable token groups', () => {
    const project = createTestProject('design-context-export-tokens-');
    try {
      writeDesign(project.root, exportFixture());

      const report = buildDesignContextExportReport({ paths: project.paths, format: 'tokens-json' });

      expect(report.schemaVersion).toBe('design-context-export.v1');
      expect(report.format).toBe('tokens-json');
      expect(report.source.result.errors).toBe(0);
      expect(report.output).toEqual({
        colors: {
          accent: '#445566',
          primary: '#112233',
        },
        typography: {
          body: {
            fontFamily: 'Inter',
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: 1.5,
          },
        },
        spacing: {
          md: '16px',
          sm: '8px',
        },
        rounded: {
          sm: '4px',
        },
        components: {
          'button-primary': {
            backgroundColor: '{colors.primary}',
            padding: '{spacing.sm}',
            rounded: '{rounded.sm}',
            typography: '{typography.body}',
          },
        },
      });
    } finally {
      project.cleanup();
    }
  });

  test('exports dtcg-json with token type and value wrappers', () => {
    const project = createTestProject('design-context-export-dtcg-');
    try {
      writeDesign(project.root, exportFixture());

      const report = buildDesignContextExportReport({ paths: project.paths, format: 'dtcg-json' });

      expect(report.output).toMatchObject({
        colors: {
          primary: {
            $type: 'color',
            $value: '#112233',
          },
        },
        spacing: {
          sm: {
            $type: 'dimension',
            $value: '8px',
          },
        },
        rounded: {
          sm: {
            $type: 'dimension',
            $value: '4px',
          },
        },
        typography: {
          body: {
            $type: 'typography',
            $value: {
              fontFamily: 'Inter',
              fontSize: '16px',
              fontWeight: 400,
              lineHeight: 1.5,
            },
          },
        },
        components: {
          'button-primary': {
            $type: 'component',
            $value: {
              backgroundColor: '{colors.primary}',
              padding: '{spacing.sm}',
              rounded: '{rounded.sm}',
              typography: '{typography.body}',
            },
          },
        },
      });
    } finally {
      project.cleanup();
    }
  });

  test('exports tailwind-json with theme extend mappings', () => {
    const project = createTestProject('design-context-export-tailwind-json-');
    try {
      writeDesign(project.root, exportFixture());

      const report = buildDesignContextExportReport({ paths: project.paths, format: 'tailwind-json' });

      expect(report.output).toEqual({
        theme: {
          extend: {
            colors: {
              primary: '#112233',
              accent: '#445566',
            },
            fontFamily: {
              body: ['Inter'],
            },
            fontSize: {
              body: ['16px', {
                lineHeight: '1.5',
                fontWeight: '400',
              }],
            },
            borderRadius: {
              sm: '4px',
            },
            spacing: {
              sm: '8px',
              md: '16px',
            },
          },
        },
      });
    } finally {
      project.cleanup();
    }
  });

  test('exports tailwind-css with stable theme variables', () => {
    const project = createTestProject('design-context-export-tailwind-css-');
    try {
      writeDesign(project.root, exportFixture());

      const report = buildDesignContextExportReport({ paths: project.paths, format: 'tailwind-css' });

      expect(report.output.css).toBe([
        '@theme {',
        '  --color-primary: #112233;',
        '  --color-accent: #445566;',
        '  --font-body: "Inter";',
        '  --text-body: 16px;',
        '  --leading-body: 1.5;',
        '  --font-weight-body: 400;',
        '  --radius-sm: 4px;',
        '  --spacing-sm: 8px;',
        '  --spacing-md: 16px;',
        '}',
        '',
      ].join('\n'));
    } finally {
      project.cleanup();
    }
  });

  test('returns empty export output while preserving source errors for invalid DESIGN.md', () => {
    const project = createTestProject('design-context-export-invalid-');
    try {
      writeDesign(project.root, [
        '---',
        'name: Invalid Export',
        'colors:',
        '  primary: not-a-color',
        '---',
        '',
        '## Overview',
        '',
        'Invalid export fixture.',
      ].join('\n'));

      const report = buildDesignContextExportReport({ paths: project.paths, format: 'tokens-json' });

      expect(report.source.exists).toBe(true);
      expect(report.source.result.errors).toBe(1);
      expect(report.output).toEqual({});
    } finally {
      project.cleanup();
    }
  });

  test('builds a starter DESIGN.md template that passes lint', () => {
    const project = createTestProject('design-context-template-');
    try {
      writeDesign(project.root, buildDesignContextTemplate());

      const report = buildDesignContextReport({ paths: project.paths });

      expect(report.exists).toBe(true);
      expect(report.result.errors).toBe(0);
      expect(report.summary?.name).toBe('Product Design System');
      expect(report.summary?.sections).toEqual(['Overview', 'Colors', 'Typography', 'Components']);
      expect(report.summary?.tokenCounts).toMatchObject({
        colors: 3,
        typography: 1,
        spacing: 2,
        rounded: 1,
        components: 1,
      });
    } finally {
      project.cleanup();
    }
  });

  test('exports design context builders from the public entrypoint', () => {
    expect(exportedBuildDesignContextReport).toBe(buildDesignContextReport);
    expect(exportedBuildDesignContextDiffReport).toBe(buildDesignContextDiffReport);
    expect(exportedBuildDesignContextExportReport).toBe(buildDesignContextExportReport);
    expect(exportedBuildDesignContextTemplate).toBe(buildDesignContextTemplate);
  });

  describe('fixture conformance', () => {
    const validFixtures = [
      ['examples/paws-and-paths.md', 'Paws & Paths'],
      ['examples/atmospheric-glass.md', 'Atmospheric Glass'],
      ['examples/totality-festival.md', 'Totality Festival Design System'],
      ['parity/heritage.md', 'Heritage'],
      ['parity/alpine-observatory.md', 'The Alpine Observatory'],
    ] as const;

    test.each(validFixtures)('parses %s without errors', (fixturePath, expectedName) => {
      const project = createTestProject('design-context-fixture-valid-');
      try {
        writeDesign(project.root, readDesignFixture(fixturePath));

        const report = buildDesignContextReport({ paths: project.paths });

        expect(report.exists).toBe(true);
        expect(report.summary?.name).toBe(expectedName);
        expect(report.result.errors).toBe(0);
        expect(report.summary?.tokenCounts.colors).toBeGreaterThan(0);
        expect(report.summary?.tokenCounts.typography).toBeGreaterThan(0);
      } finally {
        project.cleanup();
      }
    });

    test('reports stable findings for invalid fixtures', () => {
      expect(reportFixture('invalid/no-frontmatter.md').findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('No YAML frontmatter'),
        }),
      ]));

      expect(reportFixture('invalid/out-of-order.md').findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          path: 'sections',
          message: expect.stringContaining('canonical order'),
        }),
      ]));

      expect(reportFixture('invalid/broken-ref.md').findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          path: 'colors.primary',
          message: expect.stringContaining('{colors.missing}'),
        }),
        expect.objectContaining({
          severity: 'info',
          path: 'sections.Overview',
          message: expect.stringContaining('{colors.ghost}'),
        }),
      ]));

      expect(reportFixture('invalid/bad-schema.md').findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ severity: 'error', path: 'colors.primary' }),
        expect.objectContaining({ severity: 'error', path: 'spacing.sm' }),
        expect.objectContaining({ severity: 'error', path: 'rounded' }),
        expect.objectContaining({ severity: 'error', path: 'typography.body' }),
        expect.objectContaining({ severity: 'error', path: 'components.button-primary' }),
      ]));
    });

    test('exports a copied fixture in all supported formats', () => {
      const project = createTestProject('design-context-fixture-export-');
      try {
        writeDesign(project.root, readDesignFixture('examples/paws-and-paths.md'));

        const tokensJson = buildDesignContextExportReport({ paths: project.paths, format: 'tokens-json' });
        expect(tokensJson.source.result.errors).toBe(0);
        expect(tokensJson.output.colors.primary).toBe('#855300');
        expect(tokensJson.output.typography['body-md'].fontFamily).toBe('Plus Jakarta Sans');

        const dtcgJson = buildDesignContextExportReport({ paths: project.paths, format: 'dtcg-json' });
        expect(dtcgJson.output.colors.primary).toMatchObject({
          $type: 'color',
          $value: '#855300',
        });

        const tailwindJson = buildDesignContextExportReport({ paths: project.paths, format: 'tailwind-json' });
        expect(tailwindJson.output.theme.extend.colors.primary).toBe('#855300');
        expect(tailwindJson.output.theme.extend.fontFamily['body-md']).toEqual(['Plus Jakarta Sans']);

        const tailwindCss = buildDesignContextExportReport({ paths: project.paths, format: 'tailwind-css' });
        expect(tailwindCss.output.css).toContain('--color-primary: #855300;');
        expect(tailwindCss.output.css).toContain('--font-body-md: "Plus Jakarta Sans";');
      } finally {
        project.cleanup();
      }
    });

    test('diffs copied parity fixtures with stable token and section deltas', () => {
      const project = createTestProject('design-context-fixture-diff-');
      try {
        writeDesignFile(project.root, 'DESIGN.before.md', readDesignFixture('parity/diff-before.md'));
        writeDesign(project.root, readDesignFixture('parity/diff-after.md'));

        const diff = buildDesignContextDiffReport({
          paths: project.paths,
          beforePath: 'DESIGN.before.md',
          afterPath: 'DESIGN.md',
        });

        expect(diff.tokens.colors.added).toEqual(['accent']);
        expect(diff.tokens.colors.removed).toEqual(['secondary']);
        expect(diff.tokens.colors.modified).toEqual(['primary']);
        expect(diff.tokens.spacing.added).toEqual(['md']);
        expect(diff.tokens.components.modified).toEqual(['button']);
        expect(diff.sections.added).toEqual(['Components']);
        expect(diff.sections.removed).toEqual(['Typography']);
        expect(diff.sections.modified).toEqual(['Overview']);
      } finally {
        project.cleanup();
      }
    });
  });
});

function writeDesignFile(root: string, fileName: string, content: string): void {
  writeFileSync(join(root, fileName), content, 'utf8');
}

function writeDesign(root: string, content: string): void {
  writeDesignFile(root, 'DESIGN.md', content);
}

function writeManagedDesign(root: string, content: string): void {
  mkdirSync(join(root, 'specs'), { recursive: true });
  writeDesignFile(root, join('specs', 'DESIGN.md'), content);
}

function readDesignFixture(relativePath: string): string {
  return readFileSync(new URL(`./fixtures/design-context/${relativePath}`, import.meta.url), 'utf8');
}

function reportFixture(relativePath: string): ReturnType<typeof buildDesignContextReport> {
  const project = createTestProject('design-context-fixture-invalid-');
  try {
    writeDesign(project.root, readDesignFixture(relativePath));
    return buildDesignContextReport({ paths: project.paths });
  } finally {
    project.cleanup();
  }
}

function exportFixture(): string {
  return [
    '---',
    'name: Export Fixture',
    'colors:',
    '  primary: "#112233"',
    '  accent: "#445566"',
    'typography:',
    '  body:',
    '    lineHeight: 1.5',
    '    fontWeight: 400',
    '    fontSize: 16px',
    '    fontFamily: Inter',
    'spacing:',
    '  sm: 8px',
    '  md: 16px',
    'rounded:',
    '  sm: 4px',
    'components:',
    '  button-primary:',
    '    typography: "{typography.body}"',
    '    rounded: "{rounded.sm}"',
    '    padding: "{spacing.sm}"',
    '    backgroundColor: "{colors.primary}"',
    '---',
    '',
    '## Overview',
    '',
    'Export fixture.',
  ].join('\n');
}
