import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getPaths, type ProjectPaths } from './paths.js';

export type SpecStoreMode = 'write' | 'read';
export type SpecStoreDiagnosticSeverity = 'warning' | 'error';

export interface SpecStoreConfigEntry {
  id: string;
  path: string;
  mode: SpecStoreMode;
}

export interface SpecStoreResolvedEntry {
  id: string;
  path: string;
  mode: SpecStoreMode;
  exists: boolean;
  initialized: boolean;
}

export interface SpecStoreDiagnostic {
  severity: SpecStoreDiagnosticSeverity;
  code: string;
  message: string;
  fix?: string;
}

export interface SpecStoreResolution {
  executionRoot: string;
  writeRoot: string;
  writeStore: SpecStoreResolvedEntry;
  contextSources: SpecStoreResolvedEntry[];
  diagnostics: SpecStoreDiagnostic[];
}

interface ParsedSpecStoreConfig {
  writeStore: SpecStoreConfigEntry | null;
  contextSources: SpecStoreConfigEntry[];
  diagnostics: SpecStoreDiagnostic[];
}

export function resolveSpecStore(paths: ProjectPaths): SpecStoreResolution {
  const parsed = readSpecStoreConfig(paths);
  const fallbackWriteStore = resolveEntry(paths.root, {
    id: 'local',
    path: paths.root,
    mode: 'write',
  });
  const writeStore = parsed.writeStore ? resolveEntry(paths.root, parsed.writeStore) : fallbackWriteStore;
  const contextSources = parsed.contextSources.map((entry) => resolveEntry(paths.root, entry));
  const diagnostics = [
    ...parsed.diagnostics,
    ...entryDiagnostics(writeStore, 'specStore'),
    ...contextSources.flatMap((entry) => entryDiagnostics(entry, `contextSources.${entry.id}`)),
    ...duplicateIdDiagnostics([writeStore, ...contextSources]),
  ];

  return {
    executionRoot: paths.root,
    writeRoot: writeStore.path,
    writeStore,
    contextSources,
    diagnostics,
  };
}

function readSpecStoreConfig(paths: ProjectPaths): ParsedSpecStoreConfig {
  if (!existsSync(paths.configFile)) {
    return { writeStore: null, contextSources: [], diagnostics: [] };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(paths.configFile, 'utf8'));
  } catch (err) {
    return {
      writeStore: null,
      contextSources: [],
      diagnostics: [{
        severity: 'error',
        code: 'config_yaml_invalid',
        message: `Unable to parse .spec-manager/config.yaml: ${err instanceof Error ? err.message : String(err)}`,
        fix: 'Fix .spec-manager/config.yaml syntax, then rerun the command.',
      }],
    };
  }

  if (parsed === null || parsed === undefined) {
    return { writeStore: null, contextSources: [], diagnostics: [] };
  }
  if (!isRecord(parsed)) {
    return {
      writeStore: null,
      contextSources: [],
      diagnostics: [{
        severity: 'error',
        code: 'config_not_object',
        message: '.spec-manager/config.yaml must be a YAML object to define specStore/contextSources.',
        fix: 'Convert .spec-manager/config.yaml to a YAML mapping.',
      }],
    };
  }

  const diagnostics: SpecStoreDiagnostic[] = [];
  const writeStore = parseConfigEntry(parsed.specStore, 'specStore', 'write', diagnostics);
  const contextSources = parseContextSources(parsed.contextSources, diagnostics);
  return { writeStore, contextSources, diagnostics };
}

function parseContextSources(value: unknown, diagnostics: SpecStoreDiagnostic[]): SpecStoreConfigEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    diagnostics.push({
      severity: 'error',
      code: 'context_sources_invalid',
      message: 'contextSources must be a list.',
      fix: 'Use contextSources: [{ id, path, mode: read }].',
    });
    return [];
  }
  return value
    .map((entry, index) => parseConfigEntry(entry, `contextSources[${index}]`, 'read', diagnostics))
    .filter((entry): entry is SpecStoreConfigEntry => entry !== null);
}

function parseConfigEntry(
  value: unknown,
  label: string,
  defaultMode: SpecStoreMode,
  diagnostics: SpecStoreDiagnostic[],
): SpecStoreConfigEntry | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    diagnostics.push({
      severity: 'error',
      code: 'store_entry_invalid',
      message: `${label} must be an object with id and path.`,
      fix: `Use ${label}: { id: "...", path: "...", mode: "${defaultMode}" }.`,
    });
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null;
  const path = typeof value.path === 'string' && value.path.trim() ? value.path.trim() : null;
  const modeRaw = value.mode === undefined || value.mode === null ? defaultMode : value.mode;
  const mode = parseMode(modeRaw);
  if (!id) {
    diagnostics.push({
      severity: 'error',
      code: 'store_id_required',
      message: `${label}.id is required.`,
      fix: `Add ${label}.id, such as product-planning.`,
    });
  }
  if (!path) {
    diagnostics.push({
      severity: 'error',
      code: 'store_path_required',
      message: `${label}.path is required.`,
      fix: `Add ${label}.path, such as ../product-specs.`,
    });
  }
  if (!mode) {
    diagnostics.push({
      severity: 'error',
      code: 'store_mode_invalid',
      message: `${label}.mode must be write or read.`,
      fix: `Use ${label}.mode: ${defaultMode}.`,
    });
  }
  if (!id || !path || !mode) return null;
  if (isAbsolute(path)) {
    diagnostics.push({
      severity: 'warning',
      code: 'store_path_absolute',
      message: `${label}.path is absolute: ${path}`,
      fix: 'Prefer a relative path when the store should move with the repository.',
    });
  }
  return { id, path, mode };
}

function parseMode(value: unknown): SpecStoreMode | null {
  return value === 'write' || value === 'read' ? value : null;
}

function resolveEntry(executionRoot: string, entry: SpecStoreConfigEntry): SpecStoreResolvedEntry {
  const fullPath = isAbsolute(entry.path) ? resolve(entry.path) : resolve(executionRoot, entry.path);
  const paths = getPaths(fullPath);
  return {
    id: entry.id,
    path: fullPath,
    mode: entry.mode,
    exists: existsSync(fullPath),
    initialized: paths.isInitialized,
  };
}

function entryDiagnostics(entry: SpecStoreResolvedEntry, label: string): SpecStoreDiagnostic[] {
  const diagnostics: SpecStoreDiagnostic[] = [];
  if (!entry.exists) {
    diagnostics.push({
      severity: 'error',
      code: 'store_path_missing',
      message: `${label} path does not exist: ${entry.path}`,
      fix: `Create the directory or fix ${label}.path in .spec-manager/config.yaml.`,
    });
  } else if (!entry.initialized) {
    diagnostics.push({
      severity: 'error',
      code: 'store_not_initialized',
      message: `${label} path is not initialized as a spec-manager project: ${entry.path}`,
      fix: `Run spec-manager project init in ${entry.path}, or fix ${label}.path.`,
    });
  }
  return diagnostics;
}

function duplicateIdDiagnostics(entries: SpecStoreResolvedEntry[]): SpecStoreDiagnostic[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => ({
      severity: 'error' as const,
      code: 'store_id_duplicate',
      message: `Duplicate spec store id: ${id}`,
      fix: 'Use unique ids for specStore and contextSources.',
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
