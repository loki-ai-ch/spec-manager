/**
 * 统一归一化和分词模块
 * 实现文本归一化、中英文分词和停用词过滤
 */

// 中文停用词表
const CHINESE_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
  '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
  '它', '们', '那', '里', '为', '什么', '怎么', '如何', '为什么',
  '可以', '可能', '应该', '需要', '必须', '能够', '可以', '允许',
  '不', '没', '无', '非', '未', '否', '别', '莫', '勿', '毋',
]);

// 英文停用词表
const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are',
  'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'shall',
  'can', 'need', 'dare', 'ought', 'used', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
  'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
  'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't',
  'just', 'don', 'should', 'now',
  'l0', 'l1', 'l2', 'l3',
]);

// 自定义停用词（可扩展）
const CUSTOM_STOP_WORDS = new Set<string>();

export type ConstraintPolarity = 'positive' | 'negative' | 'unknown';

export interface ConstraintSignal {
  objectTerms: string[];
  polarity: ConstraintPolarity;
}

/**
 * 文本归一化
 * - Unicode NFC 归一化
 * - 空白字符标准化
 * - 标点符号处理
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Unicode NFKC 归一化
  let normalized = text.normalize('NFKC');
  
  // 空白字符标准化：将多个空白字符合并为一个空格
  normalized = normalized.replace(/\s+/g, ' ');
  
  // 标点符号处理：保留中英文标点，但标准化引号
  normalized = normalized
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[【]/g, '[')
    .replace(/[】]/g, ']')
    .replace(/[《]/g, '<')
    .replace(/[》]/g, '>');
  
  // 去除首尾空格
  return normalized.trim();
}

/**
 * 检测文本是否主要为中文
 */
export function isChineseText(text: string): boolean {
  if (!text) return false;
  
  // 统计中文字符数量
  const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
  const totalChars = text.replace(/\s/g, '').length;
  
  // 如果中文字符占比超过 30%，认为是中文文本
  return chineseChars.length / totalChars > 0.3;
}

/**
 * 中文分词
 * 基于简单的规则分词，支持常见词汇
 */
export function tokenizeChinese(text: string): string[] {
  if (!text) return [];
  
  const normalized = normalizeText(text);
  const tokens: string[] = [];
  
  // 简单的中文分词策略：
  // 1. 按标点符号分割
  // 2. 对每个片段进行字符级分割
  // 3. 识别常见词汇（2-4字）
  
  const segments = normalized.split(/[，。！？；：、""''（）【】《》\s]+/);
  
  for (const segment of segments) {
    if (!segment) continue;
    
    // 尝试识别常见词汇
    const commonWords = extractCommonWords(segment);
    if (commonWords.length > 0) {
      tokens.push(...commonWords);
    } else {
      // 如果没有识别到常见词汇，按字符分割
      for (const char of segment) {
        if (/[\u4e00-\u9fff]/.test(char)) {
          tokens.push(char);
        }
      }
    }
  }
  
  return tokens;
}

/**
 * 提取常见中文词汇（2-4字）
 */
function extractCommonWords(text: string): string[] {
  const words: string[] = [];
  const commonPatterns = [
    // 2字词汇
    /[\u4e00-\u9fff]{2}/g,
    // 3字词汇
    /[\u4e00-\u9fff]{3}/g,
    // 4字词汇
    /[\u4e00-\u9fff]{4}/g,
  ];
  
  for (const pattern of commonPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      words.push(...matches);
    }
  }
  
  return words;
}

/**
 * 英文分词
 * 按空格和标点符号分割
 */
export function tokenizeEnglish(text: string): string[] {
  if (!text) return [];
  
  const normalized = normalizeText(text);
  
  // 按空格和标点符号分割
  const tokens = normalized.split(/[\s，。！？；：、""''（）【】《》\-_.,!?;:'"()\[\]{}]+/);
  
  // 过滤空字符串和转换为小写
  return tokens
    .filter(token => token.length > 0)
    .map(token => token.toLowerCase());
}

/**
 * 停用词过滤
 */
export function filterStopWords(tokens: string[], language: 'zh' | 'en' | 'auto' = 'auto'): string[] {
  if (!tokens || tokens.length === 0) return [];
  
  return tokens.filter(token => {
    // 检查是否是停用词
    if (language === 'zh' || language === 'auto') {
      if (CHINESE_STOP_WORDS.has(token)) return false;
    }
    
    if (language === 'en' || language === 'auto') {
      if (ENGLISH_STOP_WORDS.has(token)) return false;
    }
    
    // 检查自定义停用词
    if (CUSTOM_STOP_WORDS.has(token)) return false;
    
    // 过滤长度小于 2 的 token（除非是数字）
    if (token.length < 2 && !/^\d+$/.test(token)) return false;
    
    return true;
  });
}

/**
 * 统一分词接口
 * 自动检测语言并进行分词
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  const normalized = normalizeText(text);
  const chineseTokens = filterStopWords(tokenizeChinese(normalized), 'zh');
  const englishTokens = filterStopWords(
    tokenizeEnglish(normalized).filter(token => /[a-z0-9]/i.test(token)),
    'en',
  );
  return [...new Set([...chineseTokens, ...englishTokens])];
}

export function extractConstraintSignal(text: string): ConstraintSignal {
  const normalized = normalizeText(text).toLowerCase();
  const objectTerms = new Set<string>();
  for (const token of tokenize(normalized)) objectTerms.add(token);
  for (const term of extractCjkObjectTerms(normalized)) objectTerms.add(term);
  return {
    objectTerms: [...objectTerms].sort((a, b) => a.localeCompare(b)),
    polarity: detectConstraintPolarity(normalized),
  };
}

function extractCjkObjectTerms(text: string): string[] {
  const cjkText = text
    .replace(/(?:不得|不能|不再|不允许|禁止|拒绝|移除|删除|允许|启用|保留|使用|创建|支持|必须|应该|需要|系统|记录)/g, '')
    .replace(/[^\u4e00-\u9fff]/g, '');
  const terms = new Set<string>();
  for (let size = 2; size <= 4; size++) {
    for (let index = 0; index <= cjkText.length - size; index++) {
      const term = cjkText.slice(index, index + size);
      if (!CHINESE_STOP_WORDS.has(term)) terms.add(term);
    }
  }
  return [...terms];
}

function detectConstraintPolarity(text: string): ConstraintPolarity {
  if (/\b(?:not|never|disable|remove|reject|without|forbid|prohibit|deny)\b|不(?:得|能|再|允许|使用)|禁止|移除|删除|拒绝/i.test(text)) {
    return 'negative';
  }
  if (/\b(?:allow|enable|retain|use|keep|support|create|add|accept|approve)\b|允许|启用|保留|使用|创建|支持|批准/i.test(text)) {
    return 'positive';
  }
  return 'unknown';
}

/**
 * 添加自定义停用词
 */
export function addCustomStopWords(words: string[]): void {
  for (const word of words) {
    CUSTOM_STOP_WORDS.add(word.toLowerCase());
  }
}

/**
 * 清空自定义停用词
 */
export function clearCustomStopWords(): void {
  CUSTOM_STOP_WORDS.clear();
}

/**
 * 获取停用词表（用于测试）
 */
export function getStopWords(): { chinese: Set<string>; english: Set<string>; custom: Set<string> } {
  return {
    chinese: CHINESE_STOP_WORDS,
    english: ENGLISH_STOP_WORDS,
    custom: CUSTOM_STOP_WORDS,
  };
}
