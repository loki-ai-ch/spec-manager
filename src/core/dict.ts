/**
 * 数据字典 — 外部系统元数据（表.字段 → 业务含义）
 * 存储位置：.spec-manager/dict.yaml
 * 格式：
 *   <table>:
 *     <field>:
 *       meaning: <string>
 *       updated: <iso>
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import YAML from 'yaml';
import type { ProjectPaths } from './paths.js';

export interface DictEntry {
  table: string;
  field: string;
  meaning: string;
  updated: string;
}

export interface DictData {
  [table: string]: {
    [field: string]: Omit<DictEntry, 'table' | 'field'>;
  };
}

export function readDict(paths: ProjectPaths): DictData {
  if (!existsSync(paths.dictFile)) return {};
  const raw = readFileSync(paths.dictFile, 'utf8');
  return (YAML.parse(raw) as DictData) ?? {};
}

export function writeDict(paths: ProjectPaths, data: DictData): void {
  const dir = dirname(paths.dictFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(paths.dictFile, YAML.stringify(data), 'utf8');
}

export function registerField(paths: ProjectPaths, table: string, field: string, meaning: string): DictData {
  const data = readDict(paths);
  if (!data[table]) data[table] = {};
  data[table][field] = {
    meaning,
    updated: new Date().toISOString(),
  };
  writeDict(paths, data);
  return data;
}

export function queryField(paths: ProjectPaths, table: string, field: string): DictEntry | null {
  const data = readDict(paths);
  const t = data[table];
  if (!t) return null;
  const f = t[field];
  if (!f) return null;
  return { table, field, ...f };
}

export function listFieldsByTable(paths: ProjectPaths, table: string): DictEntry[] {
  const data = readDict(paths);
  const t = data[table];
  if (!t) return [];
  return Object.entries(t).map(([field, v]) => ({ table, field, ...v }));
}

export function listAllTables(paths: ProjectPaths): string[] {
  const data = readDict(paths);
  return Object.keys(data).sort();
}
