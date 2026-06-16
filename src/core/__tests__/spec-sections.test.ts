import { describe, expect, it } from 'vitest';
import {
  extractAcceptanceCriteria,
  extractCriticalAcceptanceCriteria,
  validateCriticalAcceptanceCriteria,
} from '../spec-sections.js';

const content = `# Impl

## 验收标准
1. **AC-1**: Given x, When y, Then z SHALL happen.
2. AC-2 Given x, When y, Then z SHALL happen.
3. @verify: file-exists(src/core/task.ts)

## 关键验收标准
- AC-2
- AC-1
- AC-2
- AC-9
`;

describe('acceptance criteria extraction', () => {
  it('extracts AC ids and ignores @verify rules', () => {
    expect(extractAcceptanceCriteria(content)).toEqual([
      { id: 'AC-1', text: 'AC-1: Given x, When y, Then z SHALL happen.' },
      { id: 'AC-2', text: 'AC-2: Given x, When y, Then z SHALL happen.' },
    ]);
  });

  it('extracts critical AC ids in declaration order and deduplicates them', () => {
    expect(extractCriticalAcceptanceCriteria(content)).toEqual(['AC-2', 'AC-1', 'AC-9']);
  });

  it('validates critical AC references against acceptance criteria', () => {
    expect(validateCriticalAcceptanceCriteria(content)).toMatchObject({
      criticalCriteria: [
        { id: 'AC-2' },
        { id: 'AC-1' },
      ],
      unknown: ['AC-9'],
    });
  });
});
