/**
 * 项目内魔数集中地。修改前先确认是否有测试覆盖。
 */

/** Decision card what 字段最大字符数 */
export const DECISION_WHAT_MAX = 500;

/** Decision card why 字段最大字符数 */
export const DECISION_WHY_MAX = 500;

/** Spec aiSummary 字段最大字符数(R13/R21 强约束) */
export const AI_SUMMARY_MAX = 300;

/** PlanJson 步骤数上限(R11) */
export const PLAN_STEPS_MAX = 20;

/** Decision/Task/Incident ID 编号位数(如 DC-001 / T-001 / INC-...-001) */
export const ID_PAD_WIDTH = 3;

/** createSpec 写入的占位正文标记,R22 校验用 */
export const PLACEHOLDER_MARKER = '<!-- 在此粘贴正文 -->';

/** R22: 占位正文判定阈值 — 去掉 marker 后正文长度低于此值视为占位 */
export const PLACEHOLDER_CONTENT_MAX = 200;

/** Task 文件扩展名 */
export const TASK_FILE_EXT = '.json';

/** Task ID 前缀 */
export const TASK_ID_PREFIX = 'T-';

/** topic 必须是安全的单段路径名 */
export const TOPIC_RE = /^[a-z0-9][a-z0-9-]*$/;

/** spec code: <topic>-L1 / <topic>-L2.1 / <topic>-L3.1.1[-desc];desc 不能是 8 位日期 */
export const SPEC_CODE_RE = /^[a-z0-9][a-z0-9-]*-L[0-3](?:\.\d+)*(?:-(?!\d{8}$)[a-z0-9][a-z0-9-]*)?$/;

/** 当天日期 YYYYMMDD */
export function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
