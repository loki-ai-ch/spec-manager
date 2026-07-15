import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const agentGuidanceFiles = [
  'templates/agents/AGENTS.md',
  'templates/agents/CLAUDE.md',
  'templates/agents/CODEBUDDY.md',
  'templates/agents/CURSOR.md',
  'templates/agents/WINDSURF.md',
  'templates/agents/codebuddy-skill/SKILL.md',
  'skill/SKILL.md',
];
const installedGuidanceFiles = [
  ...agentGuidanceFiles,
  '.agents/skills/spec-manager/SKILL.md',
];
const shortcutGuidanceFiles = [
  ...installedGuidanceFiles,
  '.agents/skills/spec-manager/templates/agents/AGENTS.md',
  '.agents/skills/spec-manager/templates/agents/CLAUDE.md',
  '.agents/skills/spec-manager/templates/agents/CODEBUDDY.md',
  '.agents/skills/spec-manager/templates/agents/CURSOR.md',
  '.agents/skills/spec-manager/templates/agents/WINDSURF.md',
  '.agents/skills/spec-manager/templates/agents/codebuddy-skill/SKILL.md',
];

describe('published docs and agent guidance', () => {
  it('documents multi-repo spec stores in both READMEs', () => {
    const zh = read('README.md');
    const en = read('readme_en.md');

    for (const doc of [zh, en]) {
      expect(doc).toContain('specStore:');
      expect(doc).toContain('contextSources:');
      expect(doc).toContain('project context --json');
      expect(doc).toContain('project store doctor');
      expect(doc).toContain('write root');
      expect(doc).toContain('specs/DESIGN.md');
    }
    expect(zh).toContain('单仓库');
    expect(zh).toContain('多仓库');
    expect(en).toContain('Single-Repo');
    expect(en).toContain('Multi-Repo');
  });

  it('requires agent templates to confirm resolved writeRoot before writes', () => {
    for (const file of installedGuidanceFiles) {
      const content = read(file);
      expect(content, file).toContain('project context --json');
      expect(content, file).toContain('writeRoot');
      expect(content, file).toContain('specStore.path');
      expect(content, file).toContain('contextSources');
      expect(content, file).not.toContain('--store <id|path>');
    }
  });

  it('keeps design guidance tied to the resolved write root', () => {
    for (const file of installedGuidanceFiles) {
      const content = read(file);
      expect(content, file).toContain('specs/DESIGN.md');
      expect(content, file).toContain('resolved write root');
      expect(content, file).toContain('root `DESIGN.md` retained as a legacy fallback');
    }
  });

  it('keeps release and handoff guidance in every agent entry template', () => {
    for (const file of agentGuidanceFiles) {
      const content = read(file);
      expect(content, file).toContain('spec-manager project docs check');
      expect(content, file).toContain('spec-manager assist acceptance');
      expect(content, file).toContain('spec-manager assist delivery');
    }
  });

  it('keeps L1/L2/L3 templates free of known boundary drift', () => {
    const l1 = read('templates/L1-prd.md');
    const l2 = read('templates/L2-design.md');
    const l3 = read('templates/L3-impl.md');
    const plan = read('templates/agent-plan.json');

    expect(l1).not.toContain('以下 3 个问题');
    expect(l1).toContain('Q1');
    expect(l1).toContain('Q2');
    expect(l1).toContain('Q3');
    expect(l1).toContain('Q4 历史决策查询');

    expect(l2).toContain('实施文件清单 / 函数签名 / planJson');
    expect(l2).toContain('模块/目录/公共接口');
    expect(l2).toContain('禁止列实施文件清单');

    for (const [file, content] of [
      ['templates/L3-impl.md', l3],
      ['templates/agent-plan.json', plan],
    ] as const) {
      expect(content, file).not.toContain('.java');
      expect(content, file).not.toContain('JAR');
      expect(content, file).not.toContain('autoConfirm');
    }
  });

  it('documents task run as the L3 confirm-and-execute shortcut', () => {
    const zh = read('README.md');
    const en = read('readme_en.md');

    for (const doc of [zh, en]) {
      expect(doc).toContain('spec-manager task run auth-L3.1.1 --plan ./plan.json');
      expect(doc).toContain('spec-manager spec confirm <L3>');
      expect(doc).toContain('spec-manager task create auth-L3.1.1 --plan ./plan.json --start');
      expect(doc).toContain('spec-manager task create auth-L3.1.1 --plan ./plan.json');
      expect(doc).toContain('spec-manager task start T-001 --spec auth-L3.1.1');
    }
    expect(zh).toContain('只负责把 L3 冻结，不会自动创建 Task');
    expect(en).toContain('It does not create a task automatically');
  });

  it('teaches agents the confirm, run, and frozen create-start paths', () => {
    for (const file of shortcutGuidanceFiles) {
      const content = read(file);
      expect(content, file).toContain('confirm and run');
      expect(content, file).toContain('create and execute the task');
      expect(content, file).toContain('continue executing this L3');
      expect(content, file).toContain('spec-manager task run <L3-code> --plan <planFile>');
      expect(content, file).toContain('spec-manager task create <L3-code> --plan <planFile> --start');
      expect(content, file).toContain('compatible troubleshooting path');
      expect(content, file).toContain('spec-manager spec confirm <L3-code>');
      expect(content, file).toContain('do not create a task automatically');
      expect(content, file).toContain('explicit planJson file');
      expect(content, file).not.toContain('auto-generate planJson');
    }
  });

  it('documents graphify-style platform install commands', () => {
    const zh = read('README.md');
    const en = read('readme_en.md');

    for (const doc of [zh, en]) {
      expect(doc).toContain('spec-manager agents install');
      expect(doc).toContain('spec-manager skills install');
      expect(doc).toContain('spec-manager claude install');
      expect(doc).toContain('spec-manager codebuddy install');
      expect(doc).toContain('spec-manager codex install');
      expect(doc).toContain('spec-manager opencode install');
      expect(doc).toContain('spec-manager cursor install');
      expect(doc).toContain('spec-manager kilo install');
      expect(doc).toContain('spec-manager trae-cn install');
      expect(doc).toContain('spec-manager install --platform kimi');
      expect(doc).toContain('spec-manager antigravity install');
      expect(doc).toContain('AGENTS-compatible fallback');
      expect(doc).toContain('spec-manager project agents --provider');
    }
  });

  it('teaches agent guidance to prefer platform install commands', () => {
    for (const file of agentGuidanceFiles) {
      const content = read(file);
      expect(content, file).toContain('spec-manager <platform> install');
      expect(content, file).toContain('spec-manager agents install');
      expect(content, file).toContain('spec-manager skills install');
      expect(content, file).toContain('spec-manager project agents --provider <provider>');
    }
  });
});

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}
