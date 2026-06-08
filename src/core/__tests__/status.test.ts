import { describe, it, expect } from 'vitest';
import { canTransition, nextStatuses, isActiveStatus, isCompleteStatus, ALL_STATUSES } from '../status.js';

describe('canTransition — 状态转移校验', () => {
  it('draft → confirmed', () => {
    expect(canTransition('draft', 'confirmed')).toBe(true);
  });

  it('draft → archived', () => {
    expect(canTransition('draft', 'archived')).toBe(true);
  });

  it('confirmed → frozen', () => {
    expect(canTransition('confirmed', 'frozen')).toBe(true);
  });

  it('confirmed → archived', () => {
    expect(canTransition('confirmed', 'archived')).toBe(true);
  });

  it('frozen → implemented', () => {
    expect(canTransition('frozen', 'implemented')).toBe(true);
  });

  it('frozen → confirmed (重审)', () => {
    expect(canTransition('frozen', 'confirmed')).toBe(true);
  });

  it('frozen → archived', () => {
    expect(canTransition('frozen', 'archived')).toBe(true);
  });

  it('implemented → archived', () => {
    expect(canTransition('implemented', 'archived')).toBe(true);
  });

  it('archived 是终态，无出边', () => {
    expect(canTransition('archived', 'draft')).toBe(false);
    expect(canTransition('archived', 'confirmed')).toBe(false);
    expect(canTransition('archived', 'frozen')).toBe(false);
    expect(canTransition('archived', 'implemented')).toBe(false);
  });

  it('禁止回退: confirmed → draft', () => {
    expect(canTransition('confirmed', 'draft')).toBe(false);
  });

  it('禁止回退: implemented → frozen', () => {
    expect(canTransition('implemented', 'frozen')).toBe(false);
  });

  it('禁止回退: implemented → draft', () => {
    expect(canTransition('implemented', 'draft')).toBe(false);
  });

  it('允许 L3 批准入口使用 draft → frozen', () => {
    expect(canTransition('draft', 'frozen')).toBe(true);
  });

  it('禁止跳步: draft → implemented', () => {
    expect(canTransition('draft', 'implemented')).toBe(false);
  });

  it('禁止自环: draft → draft', () => {
    expect(canTransition('draft', 'draft')).toBe(false);
  });
});

describe('nextStatuses — 可达状态列表', () => {
  it('draft 可达 confirmed, frozen, archived', () => {
    expect(nextStatuses('draft')).toEqual(expect.arrayContaining(['confirmed', 'frozen', 'archived']));
    expect(nextStatuses('draft')).toHaveLength(3);
  });

  it('confirmed 可达 frozen, archived', () => {
    expect(nextStatuses('confirmed')).toEqual(expect.arrayContaining(['frozen', 'archived']));
    expect(nextStatuses('confirmed')).toHaveLength(2);
  });

  it('frozen 可达 implemented, confirmed, archived', () => {
    expect(nextStatuses('frozen')).toEqual(expect.arrayContaining(['implemented', 'confirmed', 'archived']));
    expect(nextStatuses('frozen')).toHaveLength(3);
  });

  it('implemented 可达 archived', () => {
    expect(nextStatuses('implemented')).toEqual(['archived']);
  });

  it('archived 无可达', () => {
    expect(nextStatuses('archived')).toEqual([]);
  });
});

describe('isActiveStatus / isCompleteStatus', () => {
  it('draft, confirmed, frozen, implemented 都是 active', () => {
    expect(isActiveStatus('draft')).toBe(true);
    expect(isActiveStatus('confirmed')).toBe(true);
    expect(isActiveStatus('frozen')).toBe(true);
    expect(isActiveStatus('implemented')).toBe(true);
  });

  it('archived 不是 active', () => {
    expect(isActiveStatus('archived')).toBe(false);
  });

  it('implemented 和 archived 是 complete', () => {
    expect(isCompleteStatus('implemented')).toBe(true);
    expect(isCompleteStatus('archived')).toBe(true);
  });

  it('draft, confirmed, frozen 不是 complete', () => {
    expect(isCompleteStatus('draft')).toBe(false);
    expect(isCompleteStatus('confirmed')).toBe(false);
    expect(isCompleteStatus('frozen')).toBe(false);
  });
});

describe('ALL_STATUSES', () => {
  it('包含全部 5 种状态', () => {
    expect(ALL_STATUSES).toEqual(['draft', 'confirmed', 'frozen', 'implemented', 'archived']);
  });
});
