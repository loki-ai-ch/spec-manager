import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const COMPLETION_SHELLS = ['zsh', 'bash', 'fish'] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

const TOP_LEVEL_COMMANDS = [
  'project', 'spec', 'task', 'decision', 'change', 'incident', 'audit', 'dict',
  'flow', 'guide', 'assist', 'new', 'approve', 'run', 'template', 'view', 'completion',
];

const SUBCOMMANDS: Record<string, string[]> = {
  project: ['init', 'agents', 'doctor', 'status'],
  spec: ['new', 'list', 'show', 'update', 'confirm', 'freeze', 'implement', 'validate', 'add-relation', 'migrate-paths', 'validate-plan'],
  task: ['create', 'start', 'step', 'report', 'verify', 'complete', 'fail', 'wait', 'show', 'list', 'context'],
  decision: ['create', 'list', 'show', 'supersede', 'update', 'set-partial', 'delete'],
  change: ['new', 'list', 'show', 'archive'],
  incident: ['new', 'list', 'show', 'update'],
  audit: ['session', 'hit', 'report', 'show'],
  dict: ['register', 'query', 'list'],
  flow: ['status'],
  assist: ['guide', 'brief', 'critique', 'next', 'drift', 'acceptance', 'delivery', 'lessons'],
  new: ['feature'],
  completion: ['install', 'uninstall'],
};

export interface UninstallCompletionResult {
  removed: string[];
  missing: string[];
}

export function resolveCompletionHome(): string {
  return process.env.SPEC_MANAGER_COMPLETION_HOME || homedir();
}

export function completionInstallPath(shell: CompletionShell, homeDir = resolveCompletionHome()): string {
  if (shell === 'zsh') return join(homeDir, '.zsh', 'completions', '_spec-manager');
  if (shell === 'bash') return join(homeDir, '.local', 'share', 'bash-completion', 'completions', 'spec-manager');
  return join(homeDir, '.config', 'fish', 'completions', 'spec-manager.fish');
}

export function generateCompletionScript(shell: CompletionShell): string {
  if (shell === 'zsh') return generateZshScript();
  if (shell === 'bash') return generateBashScript();
  return generateFishScript();
}

export function installCompletion(shell: CompletionShell, homeDir = resolveCompletionHome()): string {
  const target = completionInstallPath(shell, homeDir);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, generateCompletionScript(shell), 'utf8');
  return target;
}

export function uninstallCompletions(homeDir = resolveCompletionHome()): UninstallCompletionResult {
  const removed: string[] = [];
  const missing: string[] = [];
  for (const shell of COMPLETION_SHELLS) {
    const target = completionInstallPath(shell, homeDir);
    if (existsSync(target)) {
      rmSync(target);
      removed.push(target);
    } else {
      missing.push(target);
    }
  }
  return { removed, missing };
}

function generateZshScript(): string {
  const cases = zshCases();
  return `#compdef spec-manager

_spec_manager_specs() {
  local -a specs
  specs=(\${(f)"$(spec-manager spec list 2>/dev/null | awk 'NR>2 && $1 !~ /^共/ {print $1}')"})
  _describe 'spec code' specs
}

_spec_manager() {
  local context state line
  typeset -A opt_args
  _arguments '1:command:(${TOP_LEVEL_COMMANDS.join(' ')})' '*::arg:->args'
  if [[ $words[2] == completion && $words[3] == install ]]; then
    _values 'shell' ${COMPLETION_SHELLS.join(' ')}
    return
  fi
  case $words[2] in
${cases}
  esac
}

compdef _spec_manager spec-manager
`;
}

function zshCases(): string {
  return Object.entries(SUBCOMMANDS)
    .map(([command, children]) => {
      if (command === 'spec' || command === 'task') {
        return `    ${command}) _values '${command} command' ${children.join(' ')}; _spec_manager_specs ;;`;
      }
      return `    ${command}) _values '${command} command' ${children.join(' ')} ;;`;
    })
    .concat([`    approve|run) _spec_manager_specs ;;`])
    .join('\n');
}

function generateBashScript(): string {
  const cases = Object.entries(SUBCOMMANDS)
    .map(([command, children]) => `    ${command}) COMPREPLY=( $(compgen -W "${children.join(' ')}" -- "$cur") ) ;;`)
    .join('\n');
  return `_spec_manager_complete() {
  local cur prev command
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  command="\${COMP_WORDS[1]}"
  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${TOP_LEVEL_COMMANDS.join(' ')}" -- "$cur") )
    return
  fi
  if [[ "$command" == completion && "$prev" == install ]]; then
    COMPREPLY=( $(compgen -W "${COMPLETION_SHELLS.join(' ')}" -- "$cur") )
    return
  fi
  case "$command" in
    spec) COMPREPLY=( $(compgen -W "${SUBCOMMANDS.spec.join(' ')} $(spec-manager spec list 2>/dev/null | awk 'NR>2 && $1 !~ /^共/ {print $1}')" -- "$cur") ) ;;
    task) COMPREPLY=( $(compgen -W "${SUBCOMMANDS.task.join(' ')} $(spec-manager spec list 2>/dev/null | awk 'NR>2 && $1 !~ /^共/ {print $1}')" -- "$cur") ) ;;
    approve|run) COMPREPLY=( $(compgen -W "$(spec-manager spec list 2>/dev/null | awk 'NR>2 && $1 !~ /^共/ {print $1}')" -- "$cur") ) ;;
${cases}
  esac
}
complete -F _spec_manager_complete spec-manager
`;
}

function generateFishScript(): string {
  const lines = [
    `complete -c spec-manager -f -n '__fish_use_subcommand' -a '${TOP_LEVEL_COMMANDS.join(' ')}'`,
  ];
  for (const [command, children] of Object.entries(SUBCOMMANDS)) {
    lines.push(`complete -c spec-manager -f -n '__fish_seen_subcommand_from ${command}' -a '${children.join(' ')}'`);
  }
  lines.push(`complete -c spec-manager -f -n '__fish_seen_subcommand_from completion; and __fish_seen_subcommand_from install' -a '${COMPLETION_SHELLS.join(' ')}'`);
  lines.push(
    `function __spec_manager_specs`,
    `  spec-manager spec list 2>/dev/null | awk 'NR>2 && $1 !~ /^共/ {print $1}'`,
    `end`,
    `complete -c spec-manager -f -n '__fish_seen_subcommand_from spec task approve run' -a '(__spec_manager_specs)'`,
  );
  return lines.join('\n') + '\n';
}
