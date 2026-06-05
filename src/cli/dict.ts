/**
 * dict 子命令（外部系统数据字典）：
 *   register <table>.<field> --meaning M [--project 1]
 *   query <table>.<field>
 *   list [<table>]
 *   tables
 */

import { Command } from 'commander';
import { getPaths } from '../core/paths.js';
import { registerField, queryField, listFieldsByTable, listAllTables } from '../core/dict.js';

export function registerDictCommands(program: Command): void {
  const dict = program
    .command('dict')
    .description('数据字典（外部系统 table.field 业务含义，本地 YAML 存储）');

  dict
    .command('register <table.field>')
    .description('注册 table.field 的业务含义')
    .requiredOption('--meaning <meaning>', '业务含义说明')
    .action((tableField: string, opts: { meaning: string }) => {
      const [table, field] = tableField.split('.');
      if (!table || !field) {
        console.error('✗ 必须用 <table>.<field> 格式');
        process.exit(2);
      }
      const paths = getPaths();
      registerField(paths, table, field, opts.meaning);
      console.log(`✓ ${table}.${field} registered`);
    });

  dict
    .command('query <table.field>')
    .description('查询 table.field 的业务含义')
    .action((tableField: string) => {
      const [table, field] = tableField.split('.');
      if (!table || !field) {
        console.error('✗ 必须用 <table>.<field> 格式');
        process.exit(2);
      }
      const paths = getPaths();
      const e = queryField(paths, table, field);
      if (!e) {
        console.log(`(no entry for ${table}.${field})`);
        return;
      }
      console.log(`${e.table}.${e.field}`);
      console.log(`  meaning: ${e.meaning}`);
      console.log(`  updated: ${e.updated}`);
    });

  dict
    .command('list [table]')
    .description('列出某 table 下的所有 field')
    .action((table: string | undefined) => {
      const paths = getPaths();
      if (!table) {
        // 不传 table → 列所有 table
        const tables = listAllTables(paths);
        if (tables.length === 0) {
          console.log('(no tables)');
          return;
        }
        for (const t of tables) console.log(`  ${t}`);
        return;
      }
      const fields = listFieldsByTable(paths, table);
      if (fields.length === 0) {
        console.log(`(no fields in ${table})`);
        return;
      }
      for (const f of fields) {
        console.log(`  ${f.table}.${f.field}  ${f.meaning.slice(0, 60)}${f.meaning.length > 60 ? '...' : ''}`);
      }
    });
}
