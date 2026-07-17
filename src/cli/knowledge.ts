import { Command } from 'commander';
import {
  KnowledgeStateSchema,
  resolveKnowledge,
  setKnowledgeAnnotation,
  type ResolvedKnowledge,
} from '../core/knowledge.js';
import { getWritePaths, renderJson, requireInitialized } from './common.js';

export function registerKnowledgeCommands(program: Command): void {
  const command = program
    .command('knowledge')
    .description('知识有效性注册表（显式人工写入，只读解析）');

  command
    .command('show <sourceRef>')
    .description('查看来源的知识有效性、判断依据与替代来源')
    .option('--json', '输出 JSON', false)
    .action((sourceRef: string, opts: { json?: boolean }) => {
      const paths = getWritePaths();
      requireInitialized(paths);
      const result = resolveKnowledge(paths, sourceRef);
      printKnowledge(result, Boolean(opts.json));
    });

  command
    .command('set <sourceRef>')
    .description('显式设置来源的知识有效性')
    .requiredOption('--state <state>', 'current/historical/superseded/invalidated/unknown')
    .requiredOption('--reason <reason>', '可审计的人工判断理由')
    .option('--replacement <sourceRef>', '替代来源；superseded 时必填')
    .option('--reviewed-by <reviewer>', '审阅主体', 'human')
    .option('--json', '输出 JSON', false)
    .action((sourceRef: string, opts: {
      state: string;
      reason: string;
      replacement?: string;
      reviewedBy?: string;
      json?: boolean;
    }) => {
      const paths = getWritePaths();
      requireInitialized(paths);
      const parsedState = KnowledgeStateSchema.safeParse(opts.state);
      if (!parsedState.success) {
        throw new Error(`KNOWLEDGE_STATE_INVALID: ${opts.state}`);
      }
      const result = setKnowledgeAnnotation({
        paths,
        sourceRef,
        state: parsedState.data,
        reason: opts.reason,
        replacementRef: opts.replacement,
        reviewedBy: opts.reviewedBy,
      });
      printKnowledge(result, Boolean(opts.json));
    });
}

function printKnowledge(result: ResolvedKnowledge, json: boolean): void {
  if (json) {
    console.log(renderJson(result));
    return;
  }
  console.log(`source:      ${result.sourceRef}`);
  console.log(`state:       ${result.state}`);
  console.log(`basis:       ${result.basis}`);
  console.log(`reason:      ${result.reason}`);
  console.log(`replacement: ${result.replacementRef ?? '(none)'}`);
  console.log(`reviewedAt:  ${result.reviewedAt || '(derived)'}`);
  console.log(`reviewedBy:  ${result.reviewedBy}`);
}
