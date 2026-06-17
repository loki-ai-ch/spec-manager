#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerProject } from './project.js';
import { registerSpec } from './spec.js';
import { registerTaskCommands } from './task.js';
import { registerDecisionCommands } from './decision.js';
import { registerAuditCommands } from './audit.js';
import { registerChangeCommands } from './change.js';
import { registerIncidentCommands } from './incident.js';
import { registerDictCommands } from './dict.js';
import { registerUsabilityCommands } from './usability.js';
import { registerViewCommands } from './view.js';
import { registerCompletionCommands } from './completion.js';
import { registerCapabilityCommands } from './capability.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();
program
  .name('spec-manager')
  .description('spec-manager: local-first spec-driven development platform. Portable CLI + multi-agent instructions.')
  .version(version);

registerProject(program);
registerSpec(program);
registerTaskCommands(program);
registerDecisionCommands(program);
registerAuditCommands(program);
registerChangeCommands(program);
registerIncidentCommands(program);
registerDictCommands(program);
registerUsabilityCommands(program);
registerViewCommands(program);
registerCompletionCommands(program);
registerCapabilityCommands(program);

program.parseAsync(process.argv).catch((e) => {
  console.error('✗ ' + (e?.message ?? e));
  process.exit(1);
});
