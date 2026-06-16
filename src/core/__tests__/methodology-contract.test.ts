import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const methodology = readFileSync(resolve('docs/methodology.md'), 'utf8');

describe('methodology document contract', () => {
  it('distinguishes enforcement levels', () => {
    expect(methodology).toContain('hard gate');
    expect(methodology).toContain('warning');
    expect(methodology).toContain('human gate');
    expect(methodology).toContain('target capability');
  });

  it('documents separate L1/L2, L3, and Task state flows', () => {
    expect(methodology).toContain('L1/L2: draft → confirmed → implemented');
    expect(methodology).toContain('L3:    draft → frozen → implemented');
    expect(methodology).toContain('Task:  draft → running ↔ waiting → completed | failed');
  });

  it('documents the quick exception and the actual R8 responsibility', () => {
    expect(methodology).toContain('quick 是受限例外');
    expect(methodology).toContain('R8 是代码调查规则');
  });

  it('keeps the compliance baseline aligned with the implementation', () => {
    expect(methodology).toContain(
      'R1(≥1) + R4(≥1) + R13(≥1) + R18(≥1) + R22(≥1)',
    );
  });

  it('frames unsupported external evidence as inspiration', () => {
    expect(methodology).toContain('### 实践启发');
    expect(methodology).not.toContain('## 方法论验证');
  });

  it('does not promise automatic or inevitable retry execution', () => {
    expect(methodology).not.toContain('失败**必然重试**');
    expect(methodology).not.toContain('每个模块**必然被执行**');
    expect(methodology).toContain('不是自动 retry 调度器');
  });

  it('documents scoped audited bypasses and active R18 decisions', () => {
    expect(methodology).toContain('--skip-r18');
    expect(methodology).toContain('--skip-verification');
    expect(methodology).toContain('--skip-verify');
    expect(methodology).toContain('必须提供原因');
    expect(methodology).toContain('只有 active 决策卡片满足 R18');
  });

  it('documents adaptive workflow profile and evidence coverage semantics', () => {
    expect(methodology).toContain('adaptive workflow 是显式启用的风险分级能力');
    expect(methodology).toContain('项目保持 legacy 行为');
    expect(methodology).toContain('`standard` 或 `governed` Profile');
    expect(methodology).toContain('当前已实现的是 Profile 配置、Task Profile 快照、关键 AC 解析、`task evidence` 动态投影');
    expect(methodology).toContain('governed 关键 AC 成功 verification 全覆盖完成门禁');
    expect(methodology).toContain('spec-manager project profile recommend --request');
    expect(methodology).toContain('推荐不会自动启用 adaptive workflow');
    expect(methodology).toContain('不是 hidden gate');
    expect(methodology).toContain('spec-manager project profile metrics');
    expect(methodology).toContain('standard warnings 和 explicit overrides');
    expect(methodology).toContain('metrics 不会自动修改配置或历史 Task');
    expect(methodology).toContain('不替代 doctor 或 task complete 门禁');
    expect(methodology).toContain('spec-manager project readiness critical');
    expect(methodology).toContain('missing');
    expect(methodology).toContain('empty');
    expect(methodology).toContain('unknown');
    expect(methodology).toContain('不会自动生成或插入关键 AC');
    expect(methodology).toContain('人工确认真实关键 AC');
    expect(methodology).toContain('spec-manager project workflow preview');
    expect(methodology).toContain('只读采用预检');
    expect(methodology).toContain('推荐 defaultProfile 和 next steps');
    expect(methodology).toContain('不是 enable 的 hidden gate');
  });
});
