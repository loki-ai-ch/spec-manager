import matter from 'gray-matter';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * 读取文件，返回 { data, content }。
 * data 是 YAML frontmatter，content 是正文（已剥离 frontmatter 标记）。
 */
export function readFrontmatter(filePath: string): { data: Record<string, unknown>; content: string } {
  const raw = readFileSync(filePath, 'utf8');
  return matter(raw) as ReturnType<typeof matter>;
}

/**
 * 序列化：data + content → 带 frontmatter 的 markdown 字符串。
 * gray-matter 不接受 undefined 值；递归剔除后再 dump。
 */
export function writeFrontmatter(data: Record<string, unknown>, content: string): string {
  return matter.stringify(content, stripUndefined(data) as Record<string, unknown>);
}

/**
 * 原子写：先写临时文件，再 rename。确保并发下不会读到半截内容。
 */
export function writeAtomic(filePath: string, raw: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${randomBytes(6).toString('hex')}.tmp`);
  writeFileSync(tmp, raw, 'utf8');
  renameSync(tmp, filePath);
}

export function writeFrontmatterAtomic(filePath: string, data: Record<string, unknown>, content: string): void {
  writeAtomic(filePath, writeFrontmatter(data, content));
}

/** 序列化时跳过的字段（已废弃或由外部系统注入） */
const FM_SKIP_KEYS = new Set(['project']);

function stripUndefined(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue;
      if (FM_SKIP_KEYS.has(k)) continue;
      const cleaned = stripUndefined(val);
      // 跳过空数组和空字符串
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (cleaned === '') continue;
      out[k] = cleaned;
    }
    return out;
  }
  return v;
}
