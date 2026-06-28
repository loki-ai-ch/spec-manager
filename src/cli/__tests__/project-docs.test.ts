import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-docs-');
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
});

afterEach(() => {
  if (oldRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
  else process.env.SPEC_MANAGER_ROOT = oldRoot;
  logSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

describe('project docs check CLI', () => {
  it('prints a text report for warnings without failing', async () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md'] }), 'utf8');

    await program().parseAsync(['project', 'docs', 'check'], { from: 'user' });

    expect(output()).toContain('Docs consistency:');
    expect(output()).toContain('[docs.package.files.missing-linked-doc]');
    expect(output()).toContain('summary: errors=0 warnings=1 infos=0');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints json report', async () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');

    await program().parseAsync(['project', 'docs', 'check', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('docs-consistency.v1');
    expect(parsed.summary).toEqual({ errors: 0, warnings: 0, infos: 0 });
    expect(parsed.findings).toEqual([]);
  });

  it('prints generated asset findings in text mode', async () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, '.agents'), { recursive: true });

    await program().parseAsync(['project', 'docs', 'check'], { from: 'user' });

    expect(output()).toContain('[docs.generated-assets.present]');
    expect(output()).toContain('.agents');
    expect(output()).toContain('summary: errors=0 warnings=0 infos=1');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints generated asset package risk in json mode', async () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({
      files: ['README.md', 'readme_en.md', '.agents'],
    }), 'utf8');
    mkdirSync(join(project.root, '.agents'), { recursive: true });

    await program().parseAsync(['project', 'docs', 'check', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.summary).toEqual({ errors: 0, warnings: 1, infos: 0 });
    expect(parsed.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'docs.generated-assets.package-files-risk',
        severity: 'warning',
      }),
    ]));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints release notes inline risk findings in text mode', async () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, 'docs'), { recursive: true });
    writeFileSync(
      join(project.root, 'docs', 'release.md'),
      '```bash\ngh release create v1.0.0 --notes "Ship `docs`"\n```\n',
      'utf8',
    );

    await program().parseAsync(['project', 'docs', 'check'], { from: 'user' });

    expect(output()).toContain('[docs.release-notes.inline-risk]');
    expect(output()).toContain('docs/release.md');
    expect(output()).toContain('--notes-file');
    expect(output()).toContain('summary: errors=0 warnings=0 infos=1');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when docs errors exist', async () => {
    writeFileSync(join(project.root, 'README.md'), '中文 | [English](readme_en.md)\n', 'utf8');

    await expect(program().parseAsync(['project', 'docs', 'check'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');

    expect(output()).toContain('[docs.readme.english-target.missing]');
  });
});

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerProject(command);
  return command;
}

function output(): string {
  return logSpy.mock.calls.map(call => String(call[0])).join('\n');
}

function writeHealthyReadmes(): void {
  writeFileSync(join(project.root, 'README.md'), '中文 | [English](readme_en.md)\n', 'utf8');
  writeFileSync(join(project.root, 'readme_en.md'), '[中文说明](README.md)\n', 'utf8');
}
