import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

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
    for (const file of [
      'templates/agents/AGENTS.md',
      'templates/agents/CLAUDE.md',
      'templates/agents/CODEBUDDY.md',
      'templates/agents/CURSOR.md',
      'templates/agents/WINDSURF.md',
      'templates/agents/codebuddy-skill/SKILL.md',
      'skill/SKILL.md',
      '.agents/skills/spec-manager/SKILL.md',
    ]) {
      const content = read(file);
      expect(content, file).toContain('project context --json');
      expect(content, file).toContain('writeRoot');
      expect(content, file).toContain('specStore.path');
      expect(content, file).toContain('contextSources');
      expect(content, file).not.toContain('--store <id|path>');
    }
  });

  it('keeps design guidance tied to the resolved write root', () => {
    for (const file of [
      'templates/agents/codebuddy-skill/SKILL.md',
      'skill/SKILL.md',
      '.agents/skills/spec-manager/SKILL.md',
    ]) {
      const content = read(file);
      expect(content, file).toContain('specs/DESIGN.md');
      expect(content, file).toContain('resolved write root');
      expect(content, file).toContain('root `DESIGN.md` retained as a legacy fallback');
    }
  });

  it('documents task run as the L3 confirm-and-execute shortcut', () => {
    const zh = read('README.md');
    const en = read('readme_en.md');

    for (const doc of [zh, en]) {
      expect(doc).toContain('spec-manager task run auth-L3.1.1 --plan ./plan.json');
      expect(doc).toContain('spec-manager spec confirm <L3>');
      expect(doc).toContain('spec-manager task create auth-L3.1.1 --plan ./plan.json');
      expect(doc).toContain('spec-manager task start T-001 --spec auth-L3.1.1');
    }
    expect(zh).toContain('只负责把 L3 冻结，不会自动创建 Task');
    expect(en).toContain('It does not create a task automatically');
  });

  it('teaches agents to use task run only for explicit execution intent', () => {
    for (const file of [
      'templates/agents/AGENTS.md',
      'templates/agents/CLAUDE.md',
      'templates/agents/CODEBUDDY.md',
      'templates/agents/CURSOR.md',
      'templates/agents/WINDSURF.md',
      'templates/agents/codebuddy-skill/SKILL.md',
      'skill/SKILL.md',
      '.agents/skills/spec-manager/SKILL.md',
    ]) {
      const content = read(file);
      expect(content, file).toContain('confirm and run');
      expect(content, file).toContain('create and execute the task');
      expect(content, file).toContain('continue executing this L3');
      expect(content, file).toContain('spec-manager task run <L3-code> --plan <planFile>');
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
    for (const file of [
      'templates/agents/AGENTS.md',
      'templates/agents/CLAUDE.md',
      'templates/agents/CODEBUDDY.md',
      'templates/agents/CURSOR.md',
      'templates/agents/WINDSURF.md',
      'templates/agents/codebuddy-skill/SKILL.md',
      'skill/SKILL.md',
    ]) {
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
