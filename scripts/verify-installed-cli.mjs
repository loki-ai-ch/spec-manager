#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installedRootOverride = process.env.SPEC_MANAGER_INSTALLED_ROOT;
const installedBin = installedRootOverride ? null : findInstalledBin();
const installedRoot = installedRootOverride ? resolve(installedRootOverride) : findPackageRoot(realpathSync(installedBin));
const localDist = join(repoRoot, 'dist');
const installedDist = join(installedRoot, 'dist');
const localFiles = listFiles(localDist);
const installedFiles = existsSync(installedDist) ? listFiles(installedDist) : [];
const allFiles = [...new Set([...localFiles, ...installedFiles])].sort();
const mismatches = allFiles.filter((file) => {
  const local = join(localDist, file);
  const installed = join(installedDist, file);
  return !existsSync(local) || !existsSync(installed) || digest(local) !== digest(installed);
});

if (mismatches.length > 0) {
  console.error(`INSTALLED_CLI_DRIFT: ${installedBin ?? installedRoot} differs from the current build`);
  for (const file of mismatches) console.error(`  - ${file}`);
  process.exit(1);
}

console.log(`Installed CLI matches current build: ${installedBin ?? installedRoot}`);

function findInstalledBin() {
  try {
    return execFileSync('sh', ['-c', 'command -v spec-manager'], { encoding: 'utf8' }).trim();
  } catch {
    console.error('INSTALLED_CLI_MISSING: spec-manager is not available on PATH');
    process.exit(1);
  }
}

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function listFiles(root, base = root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, base));
    else if (entry.isFile() && statSync(path).isFile()) files.push(relative(base, path));
  }
  return files.sort();
}

function findPackageRoot(start) {
  let current = dirname(start);
  while (dirname(current) !== current) {
    if (existsSync(join(current, 'package.json'))) return current;
    current = dirname(current);
  }
  console.error(`INSTALLED_CLI_PACKAGE_MISSING: cannot locate package root for ${start}`);
  process.exit(1);
}
