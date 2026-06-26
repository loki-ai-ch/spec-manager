import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { resolveWithin, type ProjectPaths } from './paths.js';

export type DesignFindingSeverity = 'error' | 'warning' | 'info';

export interface DesignContextFinding {
  severity: DesignFindingSeverity;
  path?: string;
  message: string;
}

export interface DesignContextSummary {
  name: string | null;
  description: string | null;
  sections: string[];
  tokenCounts: {
    colors: number;
    typography: number;
    spacing: number;
    rounded: number;
    components: number;
  };
  proseSummary: string[];
  tokenSummary: string[];
}

export interface DesignContextReport {
  schemaVersion: 'design-context.v1';
  path: string;
  exists: boolean;
  summary: DesignContextSummary | null;
  findings: DesignContextFinding[];
  result: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface BuildDesignContextInput {
  paths: ProjectPaths;
  filePath?: string;
}

export interface DesignContextDiffSet {
  added: string[];
  removed: string[];
  modified: string[];
}

export interface DesignContextDiffReport {
  schemaVersion: 'design-context-diff.v1';
  before: DesignContextReport;
  after: DesignContextReport;
  tokens: Record<TokenGroup, DesignContextDiffSet>;
  sections: DesignContextDiffSet;
  findings: {
    before: DesignContextReport['result'];
    after: DesignContextReport['result'];
    delta: {
      errors: number;
      warnings: number;
      infos: number;
    };
  };
  regression: boolean;
}

export interface BuildDesignContextDiffInput {
  paths: ProjectPaths;
  beforePath: string;
  afterPath: string;
}

export type DesignContextExportFormat = 'tokens-json' | 'dtcg-json';

export interface BuildDesignContextExportInput {
  paths: ProjectPaths;
  filePath?: string;
  format: DesignContextExportFormat;
}

export interface DesignContextExportReport {
  schemaVersion: 'design-context-export.v1';
  source: DesignContextReport;
  format: DesignContextExportFormat;
  output: Record<string, unknown>;
}

interface DesignSection {
  heading: string;
  content: string;
}

interface ParsedFrontmatter {
  yamlText: string | null;
  body: string;
}

interface DesignContextParts {
  report: DesignContextReport;
  tokens: Record<string, unknown> | null;
  sections: DesignSection[];
}

const DESIGN_FILE = 'DESIGN.md';
const TOKEN_GROUPS = ['colors', 'typography', 'spacing', 'rounded', 'components'] as const;
type TokenGroup = typeof TOKEN_GROUPS[number];
const KNOWN_SECTION_ORDER = [
  'Overview',
  'Colors',
  'Typography',
  'Layout',
  'Elevation & Depth',
  'Shapes',
  'Components',
  "Do's and Don'ts",
];
const SECTION_ALIASES: Record<string, string> = {
  'Brand & Style': 'Overview',
  'Layout & Spacing': 'Layout',
  Elevation: 'Elevation & Depth',
};
const TOKEN_REF_RE = /\{([a-zA-Z0-9_.-]+)\}/g;
const DIMENSION_RE = /^-?(?:\d+|\d*\.\d+)(?:px|em|rem)$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SIMPLE_COLOR_FUNCTION_RE = /^(?:rgb|rgba|hsl|hsla)\(.+\)$/i;
const MODERN_COLOR_FUNCTION_RE = /^(?:oklch|oklab|lch|lab|hwb|color|color-mix)\(.+\)$/i;
const NAMED_COLORS = new Set([
  'black',
  'blue',
  'cornflowerblue',
  'currentcolor',
  'gray',
  'green',
  'grey',
  'orange',
  'purple',
  'red',
  'transparent',
  'white',
  'yellow',
]);
const TYPOGRAPHY_FIELDS = new Set([
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'fontFeature',
  'fontVariation',
]);
const COMPONENT_FIELDS = new Set([
  'backgroundColor',
  'textColor',
  'typography',
  'rounded',
  'padding',
  'size',
  'height',
  'width',
]);

export function buildDesignContextReport(input: BuildDesignContextInput): DesignContextReport {
  return readDesignContextParts(input).report;
}

export function buildDesignContextDiffReport(input: BuildDesignContextDiffInput): DesignContextDiffReport {
  const beforeParts = readDesignContextParts({ paths: input.paths, filePath: input.beforePath });
  const afterParts = readDesignContextParts({ paths: input.paths, filePath: input.afterPath });
  const tokens = Object.fromEntries(
    TOKEN_GROUPS.map(group => [
      group,
      diffRecordKeys(tokenGroup(beforeParts.tokens, group), tokenGroup(afterParts.tokens, group)),
    ]),
  ) as Record<TokenGroup, DesignContextDiffSet>;
  const sections = diffRecordKeys(sectionMap(beforeParts.sections), sectionMap(afterParts.sections));
  const findingDelta = {
    errors: afterParts.report.result.errors - beforeParts.report.result.errors,
    warnings: afterParts.report.result.warnings - beforeParts.report.result.warnings,
    infos: afterParts.report.result.infos - beforeParts.report.result.infos,
  };
  return {
    schemaVersion: 'design-context-diff.v1',
    before: beforeParts.report,
    after: afterParts.report,
    tokens,
    sections,
    findings: {
      before: beforeParts.report.result,
      after: afterParts.report.result,
      delta: findingDelta,
    },
    regression: findingDelta.errors > 0
      || findingDelta.warnings > 0
      || TOKEN_GROUPS.some(group => tokens[group].removed.length > 0),
  };
}

export function buildDesignContextExportReport(input: BuildDesignContextExportInput): DesignContextExportReport {
  const parts = readDesignContextParts({ paths: input.paths, filePath: input.filePath });
  return {
    schemaVersion: 'design-context-export.v1',
    source: parts.report,
    format: input.format,
    output: parts.report.exists && parts.report.result.errors === 0
      ? buildExportOutput(parts.tokens, input.format)
      : {},
  };
}

export function buildDesignContextTemplate(): string {
  return [
    '---',
    'name: Product Design System',
    'description: Starter design context for UI work.',
    'colors:',
    '  primary: "#1A1C1E"',
    '  surface: "#FFFFFF"',
    '  text: "#1A1C1E"',
    'typography:',
    '  body:',
    '    fontFamily: Inter',
    '    fontSize: 16px',
    '    fontWeight: 400',
    '    lineHeight: 1.5',
    'spacing:',
    '  sm: 8px',
    '  md: 16px',
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
    'Describe the visual intent, product mood, and interface density.',
    '',
    '## Colors',
    '',
    'Explain how primary, surface, and text colors should be applied.',
    '',
    '## Typography',
    '',
    'Describe type hierarchy, rhythm, and reading density.',
    '',
    '## Components',
    '',
    'Document reusable component behavior and visual constraints.',
  ].join('\n') + '\n';
}

export function isDesignRelevantRequest(request: string): boolean {
  return /\b(ui|ux|visual|style|styles|styling|css|design|theme|color|typography|layout|component|frontend|front-end)\b|界面|视觉|样式|颜色|字体|排版|布局|组件/.test(request.toLowerCase());
}

function readDesignContextParts(input: BuildDesignContextInput): DesignContextParts {
  const filePath = resolveDesignPath(input.paths, input.filePath);
  const findings: DesignContextFinding[] = [];
  if (!existsSync(filePath)) {
    findings.push({
      severity: 'warning',
      path: filePath,
      message: `${DESIGN_FILE} not found`,
    });
    return { report: report(filePath, false, null, findings), tokens: null, sections: [] };
  }

  const content = readFileSync(filePath, 'utf8');
  const frontmatter = extractFrontmatter(content);
  const sections = extractH2Sections(frontmatter.body);
  const rawTokens = parseDesignYaml(frontmatter.yamlText, findings);
  findings.push(...lintSections(sections));
  if (!frontmatter.yamlText) {
    findings.push({
      severity: 'warning',
      message: 'No YAML frontmatter found. Expected DESIGN.md to start with ---.',
    });
  }
  if (rawTokens && typeof rawTokens['name'] !== 'string') {
    findings.push({
      severity: 'warning',
      path: 'name',
      message: 'Missing design system name.',
    });
  }
  if (rawTokens) {
    findings.push(...lintDesignTokenSchema(rawTokens));
    findings.push(...lintTokenReferences(rawTokens));
  }

  return {
    report: report(filePath, true, buildSummary(rawTokens, sections), findings),
    tokens: rawTokens,
    sections,
  };
}

function resolveDesignPath(paths: ProjectPaths, filePath?: string): string {
  if (!filePath?.trim()) return join(paths.root, DESIGN_FILE);
  return resolveWithin(paths.root, filePath);
}

function report(
  filePath: string,
  exists: boolean,
  summary: DesignContextSummary | null,
  findings: DesignContextFinding[],
): DesignContextReport {
  return {
    schemaVersion: 'design-context.v1',
    path: filePath,
    exists,
    summary,
    findings,
    result: {
      errors: findings.filter(item => item.severity === 'error').length,
      warnings: findings.filter(item => item.severity === 'warning').length,
      infos: findings.filter(item => item.severity === 'info').length,
    },
  };
}

function extractFrontmatter(content: string): ParsedFrontmatter {
  const normalized = content.replace(/^\uFEFF/, '');
  if (!normalized.startsWith('---\n') && normalized.trim() !== '---') {
    return { yamlText: null, body: normalized };
  }
  const lines = normalized.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      return {
        yamlText: lines.slice(1, i).join('\n'),
        body: lines.slice(i + 1).join('\n'),
      };
    }
  }
  return { yamlText: null, body: normalized };
}

function parseDesignYaml(yamlText: string | null, findings: DesignContextFinding[]): Record<string, unknown> | null {
  if (!yamlText) return null;
  try {
    const parsed = parseYaml(yamlText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      findings.push({
        severity: 'error',
        message: 'YAML frontmatter must be an object.',
      });
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    findings.push({
      severity: 'error',
      message: `YAML parse failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}

function extractH2Sections(content: string): DesignSection[] {
  const lines = content.split('\n');
  const headings: Array<{ heading: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^##\s+(.+?)\s*$/.exec(lines[i] ?? '');
    if (match?.[1]) headings.push({ heading: match[1].trim(), line: i });
  }
  if (headings.length === 0) return [];

  return headings.map((item, index) => {
    const next = headings[index + 1];
    const end = next ? next.line : lines.length;
    return {
      heading: item.heading,
      content: lines.slice(item.line + 1, end).join('\n').trim(),
    };
  });
}

function lintSections(sections: DesignSection[]): DesignContextFinding[] {
  const findings: DesignContextFinding[] = [];
  const seen = new Set<string>();
  const knownIndexes: number[] = [];
  for (const section of sections) {
    const canonical = canonicalSection(section.heading);
    const key = canonical.toLowerCase();
    if (seen.has(key)) {
      findings.push({
        severity: 'error',
        path: `sections.${section.heading}`,
        message: `Duplicate section heading: ${section.heading}`,
      });
    }
    seen.add(key);

    const index = KNOWN_SECTION_ORDER.indexOf(canonical);
    if (index >= 0) knownIndexes.push(index);
  }

  for (let i = 1; i < knownIndexes.length; i++) {
    if ((knownIndexes[i] ?? 0) < (knownIndexes[i - 1] ?? 0)) {
      findings.push({
        severity: 'warning',
        path: 'sections',
        message: 'Known DESIGN.md sections are out of canonical order.',
      });
      break;
    }
  }
  return findings;
}

function lintTokenReferences(rawTokens: Record<string, unknown>): DesignContextFinding[] {
  const findings: DesignContextFinding[] = [];
  const refs = collectReferences(rawTokens);
  for (const ref of refs) {
    const target = getTokenPath(rawTokens, ref.ref);
    if (target === undefined) {
      findings.push({
        severity: 'error',
        path: ref.path,
        message: `Broken token reference: {${ref.ref}}`,
      });
    } else if (isPlainObject(target) && !allowsCompositeReference(ref.path, ref.ref)) {
      findings.push({
        severity: 'error',
        path: ref.path,
        message: `Token reference must point to a primitive value: {${ref.ref}}`,
      });
    }
  }
  return findings;
}

function lintDesignTokenSchema(rawTokens: Record<string, unknown>): DesignContextFinding[] {
  return [
    ...lintTokenGroups(rawTokens),
    ...lintColorTokens(rawTokens),
    ...lintDimensionGroup(rawTokens, 'spacing'),
    ...lintDimensionGroup(rawTokens, 'rounded'),
    ...lintTypographyTokens(rawTokens),
    ...lintComponentTokens(rawTokens),
  ];
}

function lintTokenGroups(rawTokens: Record<string, unknown>): DesignContextFinding[] {
  const findings: DesignContextFinding[] = [];
  for (const group of TOKEN_GROUPS) {
    const value = rawTokens[group];
    if (value === undefined || isPlainObject(value)) continue;
    findings.push({
      severity: 'error',
      path: group,
      message: `Token group '${group}' must be an object.`,
    });
  }
  return findings;
}

function lintColorTokens(rawTokens: Record<string, unknown>): DesignContextFinding[] {
  const colors = rawTokens['colors'];
  if (!isPlainObject(colors)) return [];

  const findings: DesignContextFinding[] = [];
  for (const [name, value] of Object.entries(colors)) {
    const path = `colors.${name}`;
    if (isTokenReferenceString(value)) continue;
    if (typeof value !== 'string') {
      findings.push({
        severity: 'error',
        path,
        message: `Color token '${name}' must be a string color value or token reference.`,
      });
      continue;
    }
    const normalized = value.trim();
    if (isSupportedColor(normalized)) continue;
    if (MODERN_COLOR_FUNCTION_RE.test(normalized)) {
      findings.push({
        severity: 'warning',
        path,
        message: `Color token '${name}' uses a modern CSS color function that is accepted without full parsing.`,
      });
      continue;
    }
    findings.push({
      severity: 'error',
      path,
      message: `Color token '${name}' is not a supported color value.`,
    });
  }
  return findings;
}

function lintDimensionGroup(rawTokens: Record<string, unknown>, group: 'spacing' | 'rounded'): DesignContextFinding[] {
  const values = rawTokens[group];
  if (!isPlainObject(values)) return [];

  const findings: DesignContextFinding[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (isTokenReferenceString(value) || isDimensionValue(value)) continue;
    findings.push({
      severity: 'error',
      path: `${group}.${name}`,
      message: `${group} token '${name}' must be a number, px/em/rem dimension, or token reference.`,
    });
  }
  return findings;
}

function lintTypographyTokens(rawTokens: Record<string, unknown>): DesignContextFinding[] {
  const typography = rawTokens['typography'];
  if (!isPlainObject(typography)) return [];

  const findings: DesignContextFinding[] = [];
  for (const [name, value] of Object.entries(typography)) {
    const path = `typography.${name}`;
    if (!isPlainObject(value)) {
      findings.push({
        severity: 'error',
        path,
        message: `Typography token '${name}' must be an object.`,
      });
      continue;
    }
    if (typeof value['fontFamily'] !== 'string') {
      findings.push({
        severity: 'warning',
        path: `${path}.fontFamily`,
        message: `Typography token '${name}' should define fontFamily.`,
      });
    }
    if (!isDimensionValue(value['fontSize'])) {
      findings.push({
        severity: 'warning',
        path: `${path}.fontSize`,
        message: `Typography token '${name}' should define fontSize as a dimension.`,
      });
    }
    for (const [field, fieldValue] of Object.entries(value)) {
      if (!TYPOGRAPHY_FIELDS.has(field)) {
        findings.push({
          severity: 'warning',
          path: `${path}.${field}`,
          message: `Unknown typography property '${field}'.`,
        });
        continue;
      }
      if (!isValidTypographyField(field, fieldValue)) {
        findings.push({
          severity: 'error',
          path: `${path}.${field}`,
          message: `Typography property '${field}' has an invalid value.`,
        });
      }
    }
  }
  return findings;
}

function lintComponentTokens(rawTokens: Record<string, unknown>): DesignContextFinding[] {
  const components = rawTokens['components'];
  if (!isPlainObject(components)) return [];

  const findings: DesignContextFinding[] = [];
  for (const [name, value] of Object.entries(components)) {
    const path = `components.${name}`;
    if (!isPlainObject(value)) {
      findings.push({
        severity: 'error',
        path,
        message: `Component token '${name}' must be an object.`,
      });
      continue;
    }
    for (const property of Object.keys(value)) {
      if (!COMPONENT_FIELDS.has(property)) {
        findings.push({
          severity: 'warning',
          path: `${path}.${property}`,
          message: `Unknown component property '${property}'.`,
        });
      }
    }
  }
  return findings;
}

function collectReferences(value: unknown, path = ''): Array<{ path: string; ref: string }> {
  const refs: Array<{ path: string; ref: string }> = [];
  if (typeof value === 'string') {
    for (const match of value.matchAll(TOKEN_REF_RE)) {
      const ref = match[1];
      if (ref) refs.push({ path, ref });
    }
    return refs;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return refs;
  for (const [key, child] of Object.entries(value)) {
    refs.push(...collectReferences(child, path ? `${path}.${key}` : key));
  }
  return refs;
}

function getTokenPath(rawTokens: Record<string, unknown>, ref: string): unknown {
  const parts = ref.split('.');
  let current: unknown = rawTokens;
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined;
    if (!(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function allowsCompositeReference(path: string, ref: string): boolean {
  return path.startsWith('components.') && path.endsWith('.typography') && ref.startsWith('typography.');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTokenReferenceString(value: unknown): value is string {
  return typeof value === 'string' && /^\{[a-zA-Z0-9_.-]+\}$/.test(value.trim());
}

function isDimensionValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return isTokenReferenceString(text) || DIMENSION_RE.test(text);
}

function isSupportedColor(value: string): boolean {
  const normalized = value.trim();
  return HEX_COLOR_RE.test(normalized)
    || SIMPLE_COLOR_FUNCTION_RE.test(normalized)
    || NAMED_COLORS.has(normalized.toLowerCase());
}

function isValidTypographyField(field: string, value: unknown): boolean {
  if (isTokenReferenceString(value)) return true;
  if (field === 'fontFamily' || field === 'fontFeature' || field === 'fontVariation') return typeof value === 'string';
  if (field === 'fontSize' || field === 'letterSpacing') return isDimensionValue(value);
  if (field === 'fontWeight') return typeof value === 'number' || typeof value === 'string';
  if (field === 'lineHeight') return typeof value === 'number' || isDimensionValue(value);
  return true;
}

function buildExportOutput(tokens: Record<string, unknown> | null, format: DesignContextExportFormat): Record<string, unknown> {
  if (!tokens) return {};
  const normalized = exportableTokenGroups(tokens);
  return format === 'tokens-json' ? normalized : toDtcgTokens(normalized);
}

function exportableTokenGroups(tokens: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const group of TOKEN_GROUPS) {
    const value = tokens[group];
    if (isPlainObject(value)) out[group] = stableNormalize(value);
  }
  return out;
}

function toDtcgTokens(tokens: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const group of TOKEN_GROUPS) {
    const value = tokens[group];
    if (!isPlainObject(value)) continue;
    out[group] = Object.fromEntries(
      Object.keys(value).sort().map(key => [key, dtcgToken(group, value[key])]),
    );
  }
  return out;
}

function dtcgToken(group: TokenGroup, value: unknown): Record<string, unknown> {
  const type = group === 'colors'
    ? 'color'
    : group === 'spacing' || group === 'rounded'
      ? 'dimension'
      : group === 'typography'
        ? 'typography'
        : 'component';
  return {
    $type: type,
    $value: stableNormalize(value),
  };
}

function tokenGroup(tokens: Record<string, unknown> | null, group: TokenGroup): Record<string, unknown> {
  const value = tokens?.[group];
  return isPlainObject(value) ? value : {};
}

function sectionMap(sections: DesignSection[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of sections) {
    out[canonicalSection(section.heading)] = section.content;
  }
  return out;
}

function diffRecordKeys(before: Record<string, unknown>, after: Record<string, unknown>): DesignContextDiffSet {
  const beforeKeys = Object.keys(before).sort();
  const afterKeys = Object.keys(after).sort();
  const beforeSet = new Set(beforeKeys);
  const afterSet = new Set(afterKeys);
  return {
    added: afterKeys.filter(key => !beforeSet.has(key)),
    removed: beforeKeys.filter(key => !afterSet.has(key)),
    modified: afterKeys.filter(key => beforeSet.has(key) && stableStringify(before[key]) !== stableStringify(after[key])),
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (!isPlainObject(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = stableNormalize(value[key]);
  }
  return sorted;
}

function buildSummary(rawTokens: Record<string, unknown> | null, sections: DesignSection[]): DesignContextSummary {
  return {
    name: stringValue(rawTokens?.['name']),
    description: stringValue(rawTokens?.['description']),
    sections: sections.map(section => section.heading),
    tokenCounts: {
      colors: countTokens(rawTokens?.['colors']),
      typography: countTokens(rawTokens?.['typography']),
      spacing: countTokens(rawTokens?.['spacing']),
      rounded: countTokens(rawTokens?.['rounded']),
      components: countTokens(rawTokens?.['components']),
    },
    proseSummary: summarizeProse(sections),
    tokenSummary: summarizeTokens(rawTokens),
  };
}

function summarizeProse(sections: DesignSection[]): string[] {
  return sections
    .filter(section => KNOWN_SECTION_ORDER.includes(canonicalSection(section.heading)))
    .map(section => `${section.heading}: ${firstSentence(section.content)}`)
    .filter(item => !item.endsWith(': '))
    .slice(0, 5);
}

function summarizeTokens(rawTokens: Record<string, unknown> | null): string[] {
  if (!rawTokens) return [];
  const out: string[] = [];
  for (const group of TOKEN_GROUPS) {
    const value = rawTokens[group];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const keys = Object.keys(value).slice(0, 4);
    if (keys.length > 0) out.push(`${group}: ${keys.join(', ')}`);
  }
  return out.slice(0, 8);
}

function countTokens(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

function canonicalSection(heading: string): string {
  return SECTION_ALIASES[heading] ?? heading;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstSentence(content: string): string {
  const flattened = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');
  if (!flattened) return '';
  const sentence = flattened.match(/^(.+?[.!?。！？])(\s|$)/)?.[1] ?? flattened;
  return sentence.length > 180 ? `${sentence.slice(0, 177)}...` : sentence;
}
