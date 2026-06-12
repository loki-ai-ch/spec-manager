import { getPaths, type ProjectPaths } from '../core/paths.js';

export interface CliActionContext {
  paths: ProjectPaths;
  stdout: {
    write: (message: string) => unknown;
  };
  log: (message: string) => void;
  warn?: (message: string) => void;
  error: (message: string) => void;
  exit: (code: number) => never;
}

export interface CliKnownError {
  prefix: string;
  exitCode: number;
  formatMessage?: (message: string) => string;
  prefixSymbol?: boolean;
}

export interface CliTextPresenter<T> {
  renderText: (value: T) => string[];
  renderJson?: (value: T) => unknown;
}

export interface PrintPresentedResultInput<T> {
  context: CliActionContext;
  presenter: CliTextPresenter<T>;
  value: T;
  json?: boolean;
  warnings?: string[];
}

export interface RunCliActionInput<T> {
  context: CliActionContext;
  knownErrors?: CliKnownError[];
  action: () => T | Promise<T>;
}

export function createDefaultCliActionContext(paths: ProjectPaths = getPaths()): CliActionContext {
  return {
    paths,
    stdout: {
      write: (message: string) => process.stdout.write(message),
    },
    log: (message: string) => console.log(message),
    warn: (message: string) => console.warn(message),
    error: (message: string) => console.error(message),
    exit: (code: number): never => process.exit(code),
  };
}

export function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

export function requireInitialized(paths: ProjectPaths): void {
  if (!paths.isInitialized) {
    fail('✗ 项目未初始化。先跑: spec-manager project init');
  }
}

export function printPathGroup(label: string, paths: string[]): void {
  if (paths.length === 0) return;
  console.log(`${label}:`);
  for (const p of paths) console.log(`  - ${p}`);
}

export function splitCsv(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

export function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function printPresentedResult<T>(input: PrintPresentedResultInput<T>): void {
  if (input.json) {
    input.context.log(renderJson(input.presenter.renderJson?.(input.value) ?? input.value));
    return;
  }
  for (const line of input.presenter.renderText(input.value)) input.context.log(line);
  for (const warning of input.warnings ?? []) (input.context.warn ?? input.context.error)(`⚠ ${warning}`);
}

export async function runCliAction<T>(input: RunCliActionInput<T>): Promise<T> {
  try {
    return await input.action();
  } catch (err) {
    if (err instanceof Error) {
      const known = input.knownErrors?.find(candidate => err.message.startsWith(candidate.prefix));
      if (known) {
        const message = known.formatMessage?.(err.message) ?? err.message;
        input.context.error(known.prefixSymbol === false ? message : `✗ ${message}`);
        input.context.exit(known.exitCode);
      }
    }
    throw err;
  }
}
