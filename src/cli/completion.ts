import { Command } from 'commander';
import {
  COMPLETION_SHELLS,
  installCompletion,
  uninstallCompletions,
  type CompletionShell,
} from '../core/completion.js';
import { fail, printPathGroup } from './common.js';

export function registerCompletionCommands(program: Command): void {
  const command = program.command('completion').description('安装或卸载 zsh/bash/fish shell completion');

  command
    .command('install <shell>')
    .description('安装 shell completion')
    .action((shellRaw: string) => {
      if (!COMPLETION_SHELLS.includes(shellRaw as CompletionShell)) {
        fail(`✗ UNSUPPORTED_SHELL: ${shellRaw}（支持: ${COMPLETION_SHELLS.join(', ')}）`, 2);
      }
      const shell = shellRaw as CompletionShell;
      const target = installCompletion(shell);
      console.log(`✓ ${shell} completion installed`);
      console.log(`  path: ${target}`);
      console.log(`  reload: start a new ${shell} session or reload its completion configuration`);
    });

  command
    .command('uninstall')
    .description('卸载所有已安装的 shell completion')
    .action(() => {
      const result = uninstallCompletions();
      if (result.removed.length === 0) {
        fail('✗ COMPLETION_NOT_INSTALLED: 未找到已安装的 spec-manager completion', 2);
      }
      console.log('✓ shell completion removed');
      printPathGroup('removed', result.removed);
    });
}
