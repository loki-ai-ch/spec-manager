import { PLACEHOLDER_CONTENT_MAX, PLACEHOLDER_MARKER } from './constants.js';

/**
 * R22: contentTemplate 是不是只剩 createSpec 写出的占位?
 * 占位 = 文件里有 marker 行,且去掉 marker 后正文长度 < PLACEHOLDER_CONTENT_MAX。
 */
export function isPlaceholderContent(content: string): boolean {
  if (!content || !content.includes(PLACEHOLDER_MARKER)) return false;
  const stripped = content.replace(PLACEHOLDER_MARKER, '').trim();
  return stripped.length < PLACEHOLDER_CONTENT_MAX;
}
