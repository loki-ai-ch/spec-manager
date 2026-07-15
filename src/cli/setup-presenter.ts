import { getPaths } from '../core/paths.js';
import { buildSetupSurface, type SetupSurfaceProjection } from '../core/setup-surface.js';

export interface SetupCliOptions {
  topic?: string;
  json: boolean;
}

export function runSetupCommand(requestParts: string[], opts: SetupCliOptions): void {
  const request = requestParts.join(' ').trim();
  const projection = buildSetupSurface(getPaths(), {
    request,
    topic: opts.topic,
  });
  if (opts.json) {
    console.log(JSON.stringify(projection, null, 2));
    return;
  }
  for (const line of renderSetupProjection(projection)) console.log(line);
}

export function renderSetupProjection(projection: SetupSurfaceProjection): string[] {
  const installed = projection.providers.filter(provider => provider.status === 'installed');
  const available = projection.providers.filter(provider => provider.status === 'available');
  const firstInstallCommand = available.find(provider => provider.suggestedCommand)?.suggestedCommand
    ?? 'spec-manager project agents --provider all';

  const lines: string[] = [];
  lines.push(`Setup: spec-manager`);
  lines.push(`Project Root: ${projection.projectRoot}`);
  lines.push(`Execution Root: ${projection.executionRoot}`);
  lines.push(`Write Root: ${projection.writeRoot}`);
  lines.push(`Initialized: ${projection.initialized}`);
  lines.push('');
  lines.push('Profiles:');
  lines.push(`  UX: ${projection.uxProfile} (presentation only; does not change task gates)`);
  lines.push(`  Workflow: ${projection.workflowProfile.defaultProfile} (adaptive workflow ${projection.workflowProfile.enabled ? 'enabled' : 'disabled'})`);
  lines.push('');
  lines.push('Agents:');
  lines.push(`  installed: ${installed.length > 0 ? installed.map(provider => provider.provider).join(', ') : '(none)'}`);
  lines.push(`  available: ${available.length > 0 ? available.map(provider => provider.provider).join(', ') : '(none)'}`);
  if (available.length > 0) lines.push(`  Next: ${firstInstallCommand}`);
  if (projection.diagnostics.length > 0) {
    lines.push('');
    lines.push('Diagnostics:');
    for (const diagnostic of projection.diagnostics) {
      lines.push(`  - [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
      if (diagnostic.fix) lines.push(`    fix: ${diagnostic.fix}`);
    }
  }
  if (projection.blockingReason) {
    lines.push('');
    lines.push(`Blocking: ${projection.blockingReason}`);
  }
  lines.push('');
  lines.push('Next:');
  lines.push(`  ${projection.nextAction.replace(/\n/g, '\n  ')}`);
  lines.push('');
  lines.push('Suggested Commands:');
  for (const command of projection.suggestedCommands) lines.push(`  - ${command}`);
  return lines;
}
