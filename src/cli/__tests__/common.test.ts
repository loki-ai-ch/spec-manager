import { describe, expect, it, vi } from 'vitest';
import { getPaths } from '../../core/paths.js';
import {
  createDefaultCliActionContext,
  printPresentedResult,
  renderJson,
  runCliAction,
  splitCsv,
  type CliActionContext,
} from '../common.js';

function createContext(): CliActionContext & {
  logs: string[];
  warnings: string[];
  errors: string[];
  writes: string[];
  exits: number[];
} {
  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const writes: string[] = [];
  const exits: number[] = [];
  return {
    paths: getPaths('/tmp/spec-manager-cli-common-test'),
    stdout: {
      write: (message: string) => {
        writes.push(message);
        return true;
      },
    },
    log: (message: string) => logs.push(message),
    warn: (message: string) => warnings.push(message),
    error: (message: string) => errors.push(message),
    exit: (code: number): never => {
      exits.push(code);
      throw new Error(`exit:${code}`);
    },
    logs,
    warnings,
    errors,
    writes,
    exits,
  };
}

describe('CLI common runtime helpers', () => {
  it('creates a default context with current global output behavior', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    try {
      const context = createDefaultCliActionContext(getPaths('/tmp/spec-manager-default-context'));
      context.log('hello');
      context.warn?.('careful');
      context.error('bad');
      context.stdout.write('raw');
      expect(() => context.exit(7)).toThrow('process.exit:7');

      expect(logSpy).toHaveBeenCalledWith('hello');
      expect(warnSpy).toHaveBeenCalledWith('careful');
      expect(errorSpy).toHaveBeenCalledWith('bad');
      expect(writeSpy).toHaveBeenCalledWith('raw');
      expect(exitSpy).toHaveBeenCalledWith(7);
      expect(context.paths.root).toBe('/tmp/spec-manager-default-context');
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      writeSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it('splits comma-separated flags and filters empty items', () => {
    expect(splitCsv(undefined)).toBeUndefined();
    expect(splitCsv('')).toEqual([]);
    expect(splitCsv('src/a.ts, src/b.ts,, src/c.ts ')).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('renders JSON with two-space indentation', () => {
    expect(renderJson({ code: 'T-001', status: 'running' })).toBe('{\n  "code": "T-001",\n  "status": "running"\n}');
  });

  it('prints text presenter output and warnings', () => {
    const context = createContext();

    printPresentedResult({
      context,
      value: { id: 'T-001', status: 'running' },
      warnings: ['first warning'],
      presenter: {
        renderText: value => [`Task ${value.id}`, `status: ${value.status}`],
      },
    });

    expect(context.logs).toEqual(['Task T-001', 'status: running']);
    expect(context.warnings).toEqual(['⚠ first warning']);
    expect(context.errors).toEqual([]);
  });

  it('prints JSON presenter output without warnings', () => {
    const context = createContext();

    printPresentedResult({
      context,
      json: true,
      value: { id: 'T-001', internal: 'ignored' },
      warnings: ['hidden warning'],
      presenter: {
        renderText: value => [`Task ${value.id}`],
        renderJson: value => ({ id: value.id }),
      },
    });

    expect(context.logs).toEqual(['{\n  "id": "T-001"\n}']);
    expect(context.warnings).toEqual([]);
    expect(context.errors).toEqual([]);
  });

  it('returns successful cli action results', async () => {
    const context = createContext();

    await expect(runCliAction({ context, action: () => 'ok' })).resolves.toBe('ok');
  });

  it('maps known errors to stderr and exit code', async () => {
    const context = createContext();

    await expect(runCliAction({
      context,
      knownErrors: [{ prefix: 'INVALID_REPORT:', exitCode: 2 }],
      action: () => {
        throw new Error('INVALID_REPORT: summary is required');
      },
    })).rejects.toThrow('exit:2');

    expect(context.errors).toEqual(['✗ INVALID_REPORT: summary is required']);
    expect(context.exits).toEqual([2]);
  });

  it('maps known errors through a user-visible message formatter', async () => {
    const context = createContext();

    await expect(runCliAction({
      context,
      knownErrors: [{
        prefix: 'INVALID_REPORT: task report --input ',
        exitCode: 2,
        formatMessage: message => message.slice('INVALID_REPORT: '.length),
      }],
      action: () => {
        throw new Error('INVALID_REPORT: task report --input cannot be mixed');
      },
    })).rejects.toThrow('exit:2');

    expect(context.errors).toEqual(['✗ task report --input cannot be mixed']);
    expect(context.exits).toEqual([2]);
  });

  it('rethrows unknown errors', async () => {
    const context = createContext();

    await expect(runCliAction({
      context,
      knownErrors: [{ prefix: 'INVALID_REPORT:', exitCode: 2 }],
      action: () => {
        throw new Error('UNEXPECTED_FAILURE');
      },
    })).rejects.toThrow('UNEXPECTED_FAILURE');

    expect(context.errors).toEqual([]);
    expect(context.exits).toEqual([]);
  });
});
