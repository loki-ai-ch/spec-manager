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
});
