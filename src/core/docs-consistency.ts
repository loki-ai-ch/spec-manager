import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, normalize, relative } from 'node:path';
import type { ProjectPaths } from './paths.js';

export type DocsFindingSeverity = 'error' | 'warning' | 'info';

export interface DocsConsistencyFinding {
  id: string;
  severity: DocsFindingSeverity;
  title: string;
  detail: string;
  path?: string;
  suggestion?: string;
}

export interface DocsConsistencyReport {
  schemaVersion: 'docs-consistency.v1';
  findings: DocsConsistencyFinding[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface DocsConsistencyOptions {
  packageRoot?: string;
}

const ENGLISH_README = 'readme_en.md';
const README = 'README.md';
const GUIDANCE_PHRASES = ['spec-manager', 'project docs check'];
const GENERATED_AGENT_ASSET_DIRS = ['.agents', '.claude', '.codebuddy', '.codex', '.cursor', '.windsurf'];
const RELEASE_SCAN_FILES = [README, ENGLISH_README, 'skill/subskills/release.md'];
const RELEASE_SCAN_DIRS = ['docs', 'releases'];

export function buildDocsConsistencyReport(paths: ProjectPaths, options: DocsConsistencyOptions = {}): DocsConsistencyReport {
  const root = options.packageRoot ?? paths.root;
  const findings: DocsConsistencyFinding[] = [];
  const readmePath = join(root, README);
  const englishReadmePath = join(root, ENGLISH_README);

  if (!existsSync(readmePath)) {
    findings.push(finding(
      'docs.readme.primary.missing',
      'error',
      'Primary README is missing',
      'README.md is required as the primary package and repository entry point.',
      README,
      'Add README.md before publishing or handing the project to agents.',
    ));
  } else {
    const readme = readFileSync(readmePath, 'utf8');
    const linkedDocs = markdownDocumentLinks(readme);
    const linksEnglishReadme = linkedDocs.includes(ENGLISH_README);
    if (!linksEnglishReadme) {
      findings.push(finding(
        'docs.readme.english-link.missing',
        'warning',
        'English README link is missing',
        'README.md should link to readme_en.md so users can switch languages.',
        README,
        'Add a markdown link to readme_en.md near the top of README.md.',
      ));
    } else if (!existsSync(englishReadmePath)) {
      findings.push(finding(
        'docs.readme.english-target.missing',
        'error',
        'English README target is missing',
        'README.md links to readme_en.md, but that file does not exist.',
        ENGLISH_README,
        'Create readme_en.md or remove the broken README.md link.',
      ));
    }
    findings.push(...packageFilesFindings(root, linkedDocs));
  }

  if (existsSync(englishReadmePath)) {
    const englishReadme = readFileSync(englishReadmePath, 'utf8');
    if (!markdownDocumentLinks(englishReadme).includes(README)) {
      findings.push(finding(
        'docs.readme.backlink.missing',
        'warning',
        'Chinese README backlink is missing',
        'readme_en.md should link back to README.md.',
        ENGLISH_README,
        'Add a markdown link to README.md near the top of readme_en.md.',
      ));
    }
  }

  findings.push(...guidanceFindings(root));
  findings.push(...generatedAssetFindings(root));
  findings.push(...releaseNotesInlineRiskFindings(root));

  return {
    schemaVersion: 'docs-consistency.v1',
    findings,
    summary: {
      errors: findings.filter(item => item.severity === 'error').length,
      warnings: findings.filter(item => item.severity === 'warning').length,
      infos: findings.filter(item => item.severity === 'info').length,
    },
  };
}

function releaseNotesInlineRiskFindings(root: string): DocsConsistencyFinding[] {
  const findings: DocsConsistencyFinding[] = [];
  for (const rel of releaseScanMarkdownFiles(root)) {
    const fullPath = join(root, rel);
    const content = readFileSync(fullPath, 'utf8');
    if (!hasReleaseInlineNotesRisk(content)) continue;
    findings.push(finding(
      'docs.release-notes.inline-risk',
      'info',
      'Release notes use risky inline shell quoting',
      `${rel} contains a gh release create --notes example that may be affected by shell quoting or command substitution.`,
      rel,
      'Write release notes to a file and use `gh release create ... --notes-file <file>`.',
    ));
  }
  return findings;
}

function packageFilesFindings(root: string, linkedDocs: string[]): DocsConsistencyFinding[] {
  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) return [];
  const files = readPackageFiles(root);
  if (!files) return [];
  const publicDocs = linkedDocs.filter(isPublicMarkdownDoc);
  return publicDocs
    .filter(doc => !isCoveredByPackageFiles(doc, files))
    .map(doc => finding(
      'docs.package.files.missing-linked-doc',
      'warning',
      'Linked public document is missing from package files',
      `${doc} is linked from README.md but is not included in package.json files.`,
      'package.json',
      `Add "${doc}" to package.json files or remove the public README link.`,
    ));
}

function generatedAssetFindings(root: string): DocsConsistencyFinding[] {
  const files = readPackageFiles(root) ?? [];
  const findings: DocsConsistencyFinding[] = [];
  for (const dir of GENERATED_AGENT_ASSET_DIRS) {
    const path = join(root, dir);
    if (!existsSync(path) || !statSafe(path)?.isDirectory()) continue;
    const includedInPackage = isCoveredByPackageFiles(dir, files);
    if (includedInPackage) {
      findings.push(finding(
        'docs.generated-assets.package-files-risk',
        'warning',
        'Generated agent asset is included in package files',
        `${dir}/ looks like local generated Agent output but is included in package.json files.`,
        'package.json',
        `Remove "${dir}" from package.json files unless you intentionally vendor generated Agent assets.`,
      ));
    } else {
      findings.push(finding(
        'docs.generated-assets.present',
        'info',
        'Generated agent asset directory is present',
        `${dir}/ is treated as local Agent output; do not commit or publish it unless intentionally vendoring it.`,
        dir,
        'Keep generated Agent output out of release artifacts unless the repository explicitly owns it.',
      ));
    }
  }
  return findings;
}

function guidanceFindings(root: string): DocsConsistencyFinding[] {
  const files = [
    join(root, 'skill', 'SKILL.md'),
    ...agentTemplateSkillFiles(root),
  ];
  const findings: DocsConsistencyFinding[] = [];
  for (const file of files) {
    const rel = slash(relative(root, file));
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8').toLowerCase();
    const missing = GUIDANCE_PHRASES.filter(phrase => !content.includes(phrase));
    if (missing.length === 0) continue;
    findings.push(finding(
      rel === 'skill/SKILL.md' ? 'docs.skill.guidance.missing' : 'docs.agent-template.guidance.missing',
      'warning',
      'Agent guidance is missing docs check instructions',
      `${rel} does not mention ${missing.map(item => `"${item}"`).join(', ')}.`,
      rel,
      'Mention `spec-manager project docs check` as a pre-release/pre-handoff consistency check.',
    ));
  }
  return findings;
}

function agentTemplateSkillFiles(root: string): string[] {
  const templatesDir = join(root, 'templates', 'agents');
  if (!existsSync(templatesDir) || !statSafe(templatesDir)?.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(templatesDir, entry.name, 'SKILL.md');
    if (existsSync(skillPath)) files.push(skillPath);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function releaseScanMarkdownFiles(root: string): string[] {
  const files = new Set<string>();
  for (const rel of RELEASE_SCAN_FILES) {
    if (existsSync(join(root, rel))) files.add(rel);
  }
  for (const dir of RELEASE_SCAN_DIRS) {
    collectMarkdownFiles(root, dir, files);
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function collectMarkdownFiles(root: string, relDir: string, out: Set<string>): void {
  const dir = join(root, relDir);
  if (!existsSync(dir) || !statSafe(dir)?.isDirectory()) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = slash(join(relDir, entry.name));
    if (entry.isDirectory()) {
      collectMarkdownFiles(root, rel, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.add(rel);
    }
  }
}

function hasReleaseInlineNotesRisk(content: string): boolean {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\bgh\s+release\s+create\b/.test(line)) continue;
    const snippet = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join('\n');
    if (/--notes-file\b/.test(snippet)) continue;
    if (!/--notes\b/.test(snippet)) continue;
    if (/[`]|[$][(]/.test(snippet)) return true;
    if (/--notes\s+["'][\s\S]*\n[\s\S]*["']/.test(snippet)) return true;
  }
  return false;
}

function markdownDocumentLinks(content: string): string[] {
  const links = new Set<string>();
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    const href = raw.split('#')[0]?.trim();
    if (!href || /^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith('#')) continue;
    const normalized = slash(normalize(href));
    if (normalized.startsWith('../') || normalized.startsWith('/')) continue;
    if (basename(normalized).toLowerCase().endsWith('.md')) links.add(normalized);
  }
  return [...links].sort((a, b) => a.localeCompare(b));
}

function isPublicMarkdownDoc(doc: string): boolean {
  const lower = doc.toLowerCase();
  if (!lower.endsWith('.md')) return false;
  if (lower === README.toLowerCase()) return false;
  if (lower.startsWith('.')) return false;
  return true;
}

function isCoveredByPackageFiles(doc: string, files: string[]): boolean {
  return files.some(entry => {
    const normalized = slash(normalize(entry))
      .replace(/\/\*\*?$/g, '')
      .replace(/\/+$/g, '');
    return normalized === doc || doc.startsWith(`${normalized}/`);
  });
}

function readPackageFiles(root: string): string[] | null {
  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) return null;
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { files?: unknown };
  if (!Array.isArray(pkg.files)) return null;
  return pkg.files.map(item => String(item));
}

function finding(
  id: string,
  severity: DocsFindingSeverity,
  title: string,
  detail: string,
  path?: string,
  suggestion?: string,
): DocsConsistencyFinding {
  return { id, severity, title, detail, path, suggestion };
}

function statSafe(path: string) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function slash(value: string): string {
  return value.replace(/\\/g, '/');
}
