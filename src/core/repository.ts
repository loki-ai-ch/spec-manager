import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectPaths } from './paths.js';

export type TopicMetaDir = 'tasks' | 'decisions';

export interface TopicMetaFile {
  topic: string;
  fileName: string;
  filePath: string;
}

export function listTopicMetaFiles(
  paths: ProjectPaths,
  dirName: TopicMetaDir,
  opts?: { topic?: string; extension?: string; filePrefix?: string },
): TopicMetaFile[] {
  const out: TopicMetaFile[] = [];
  if (!existsSync(paths.specsDir)) return out;

  for (const topicEntry of readdirSync(paths.specsDir, { withFileTypes: true })) {
    if (!topicEntry.isDirectory() || topicEntry.name.startsWith('.')) continue;
    if (opts?.topic && topicEntry.name !== opts.topic) continue;

    const metaDir = join(paths.specsDir, topicEntry.name, dirName);
    if (!existsSync(metaDir)) continue;

    for (const fileName of readdirSync(metaDir)) {
      if (opts?.extension && !fileName.endsWith(opts.extension)) continue;
      if (opts?.filePrefix && !fileName.startsWith(opts.filePrefix)) continue;
      out.push({
        topic: topicEntry.name,
        fileName,
        filePath: join(metaDir, fileName),
      });
    }
  }

  return out.sort((a, b) => a.filePath.localeCompare(b.filePath));
}
