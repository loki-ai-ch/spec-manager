import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeText,
  isChineseText,
  tokenizeChinese,
  tokenizeEnglish,
  filterStopWords,
  tokenize,
  addCustomStopWords,
  clearCustomStopWords,
  getStopWords,
  extractConstraintSignal,
} from '../../retrieval/normalization';

describe('normalization', () => {
  beforeEach(() => {
    clearCustomStopWords();
  });

  describe('normalizeText', () => {
    it('should normalize Unicode text', () => {
      const input = 'Hello\u0301 world'; // 带组合字符的文本
      const result = normalizeText(input);
      // NFC 归一化会将组合字符转换为预组合形式
      // 'Hello\u0301' -> 'Helló' (预组合形式)
      expect(result).toContain('Helló');
      expect(result).toContain('world');
    });

    it('should normalize whitespace', () => {
      const input = '  hello   world  \n\t  ';
      const result = normalizeText(input);
      expect(result).toBe('hello world');
    });

    it('should normalize quotes', () => {
      const input = '"hello" \'world\'';
      const result = normalizeText(input);
      expect(result).toBe('"hello" \'world\'');
    });

    it('should normalize brackets', () => {
      const input = '（hello）【world】';
      const result = normalizeText(input);
      expect(result).toBe('(hello)[world]');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null as any)).toBe('');
      expect(normalizeText(undefined as any)).toBe('');
    });
  });

  describe('isChineseText', () => {
    it('should detect Chinese text', () => {
      expect(isChineseText('你好世界')).toBe(true);
      // '你好 world' 中文字符占比约 28.6%，低于 30% 阈值
      expect(isChineseText('你好 world')).toBe(false);
    });

    it('should detect non-Chinese text', () => {
      expect(isChineseText('Hello world')).toBe(false);
      expect(isChineseText('123456')).toBe(false);
      expect(isChineseText('')).toBe(false);
    });

    it('should handle mixed text with high Chinese ratio', () => {
      // 当中文字符占比高于 30% 时，应该返回 true
      expect(isChineseText('你好世界 hello')).toBe(true);
    });
  });

  describe('tokenizeChinese', () => {
    it('should tokenize Chinese text', () => {
      const result = tokenizeChinese('你好世界');
      expect(result).toContain('你好');
      expect(result).toContain('世界');
    });

    it('should handle punctuation', () => {
      const result = tokenizeChinese('你好，世界！');
      expect(result).toContain('你好');
      expect(result).toContain('世界');
    });

    it('should handle empty string', () => {
      expect(tokenizeChinese('')).toEqual([]);
    });
  });

  describe('tokenizeEnglish', () => {
    it('should tokenize English text', () => {
      const result = tokenizeEnglish('Hello world');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle punctuation', () => {
      const result = tokenizeEnglish('Hello, world!');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle mixed case', () => {
      const result = tokenizeEnglish('Hello WORLD');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle empty string', () => {
      expect(tokenizeEnglish('')).toEqual([]);
    });
  });

  describe('filterStopWords', () => {
    it('should filter Chinese stop words', () => {
      const tokens = ['的', '了', '在', '是', '你好', '世界'];
      const result = filterStopWords(tokens, 'zh');
      expect(result).toEqual(['你好', '世界']);
    });

    it('should filter English stop words', () => {
      const tokens = ['the', 'a', 'an', 'hello', 'world'];
      const result = filterStopWords(tokens, 'en');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should filter custom stop words', () => {
      addCustomStopWords(['custom', 'stop']);
      const tokens = ['custom', 'stop', 'hello', 'world'];
      const result = filterStopWords(tokens, 'en');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should filter short tokens', () => {
      const tokens = ['a', 'b', 'hello', 'world'];
      const result = filterStopWords(tokens, 'en');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should keep numbers', () => {
      const tokens = ['123', '456', 'hello'];
      const result = filterStopWords(tokens, 'en');
      expect(result).toEqual(['123', '456', 'hello']);
    });

    it('should handle empty array', () => {
      expect(filterStopWords([], 'en')).toEqual([]);
    });
  });

  describe('tokenize', () => {
    it('should tokenize Chinese text', () => {
      const result = tokenize('你好世界');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should tokenize English text', () => {
      const result = tokenize('Hello world');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle mixed text', () => {
      const result = tokenize('Hello 你好');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      expect(tokenize('')).toEqual([]);
    });
  });

  describe('extractConstraintSignal', () => {
    it('extracts deterministic CJK object signals and polarity', () => {
      expect(extractConstraintSignal('禁止自动批准知识')).toMatchObject({
        polarity: 'negative',
        objectTerms: expect.arrayContaining(['自动', '批准', '知识']),
      });
      expect(extractConstraintSignal('系统自动批准知识记录')).toMatchObject({
        polarity: 'positive',
        objectTerms: expect.arrayContaining(['自动', '批准', '知识']),
      });
    });

    it('preserves legacy English terms and polarity', () => {
      expect(extractConstraintSignal('System SHALL retain module access')).toMatchObject({
        polarity: 'positive',
        objectTerms: expect.arrayContaining(['system', 'retain', 'module', 'access']),
      });
      expect(extractConstraintSignal('remove module access')).toMatchObject({
        polarity: 'negative',
        objectTerms: expect.arrayContaining(['remove', 'module', 'access']),
      });
    });
  });

  describe('custom stop words', () => {
    it('should add custom stop words', () => {
      addCustomStopWords(['custom1', 'custom2']);
      const stopWords = getStopWords();
      expect(stopWords.custom.has('custom1')).toBe(true);
      expect(stopWords.custom.has('custom2')).toBe(true);
    });

    it('should clear custom stop words', () => {
      addCustomStopWords(['custom1']);
      clearCustomStopWords();
      const stopWords = getStopWords();
      expect(stopWords.custom.size).toBe(0);
    });
  });
});
