#!/usr/bin/env node
/**
 * Editor Agent - 記事品質チェックと承認/却下判定
 * 
 * Phase 3 - Agent 1
 * 
 * 責務:
 * - 文字数チェック（≥3000字）
 * - 構成チェック（比較表≥3, FAQ≥5, CTA, 内部/アフィリエイトリンク）
 * - スパムキーワードチェック
 * - 承認/却下判定 → context.json 更新
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// 設定
// =============================================================================

const BASE_DIR = path.join(__dirname, '../..');
const CONTEXT_FILE = path.join(__dirname, '../context.json');
const ARTICLE_DIR = path.join(BASE_DIR, '_posts');
const OUTPUT_FILE = path.join(__dirname, 'output.md');
const MEMORY_FILE = path.join(__dirname, 'memory.md');
const GUIDELINES_FILE = path.join(__dirname, 'guidelines.md');

// 品質基準
const QUALITY_CRITERIA = {
  minCharacters: 3000,
  minTables: 3,
  minFAQ: 5,
  minInternalLinks: 3,
  minAffiliateLinks: 2,
  maxSpamKeywordFreq: 5,
  spamKeywords: ['無料', '今すぐ', '限定', '特別価格', '緊急', '必見'],
  minInlineImages: 3,       // 記事内画像（ヒーロー除く）
  maxTextBlockLength: 600,  // 連続テキストブロックの上限（字）
};

// =============================================================================
// ユーティリティ関数
// =============================================================================

function log(message) {
  console.log(`[Editor Agent] ${message}`);
}

function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (err) {
    log(`⚠️ JSON読み込みエラー: ${filepath} - ${err.message}`);
    return null;
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  log(`✅ JSON保存: ${filepath}`);
}

function readMarkdown(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8');
  } catch (err) {
    log(`⚠️ Markdown読み込みエラー: ${filepath} - ${err.message}`);
    return '';
  }
}

function writeMarkdown(filepath, content) {
  fs.writeFileSync(filepath, content, 'utf8');
  log(`✅ Markdown保存: ${filepath}`);
}

// =============================================================================
// 記事解析関数
// =============================================================================

/**
 * front-matterを除外した本文を抽出
 */
function extractBody(markdown) {
  const frontMatterRegex = /^---\n[\s\S]*?\n---\n/;
  return markdown.replace(frontMatterRegex, '').trim();
}

/**
 * 文字数カウント（空白・改行除外）
 */
function countCharacters(text) {
  return text.replace(/\s+/g, '').length;
}

/**
 * マークダウンテーブルの数をカウント
 */
function countTables(markdown) {
  // 行単位で走査し、テーブル行（| で始まる）の連続ブロックを1テーブルとしてカウント
  const lines = markdown.split('\n');
  let tableCount = 0;
  let inTable = false;
  for (const line of lines) {
    const isTableRow = /^\s*\|/.test(line);
    if (isTableRow && !inTable) {
      tableCount++;
      inTable = true;
    } else if (!isTableRow) {
      inTable = false;
    }
  }
  return tableCount;
}

/**
 * FAQの数をカウント
 */
function countFAQs(markdown) {
  // 重複カウントを避けるため OR パターンを1つの正規表現で処理
  const faqPatterns = [
    /^#{2,4}\s*Q\d*[:\s．.]/gim,  // ### Q1: / ## Q: / #### Q1.
    /^\*\*Q\d*[:\s．.]/gim,        // **Q1:** / **Q:**
  ];
  const seen = new Set();
  let faqCount = 0;
  for (const pattern of faqPatterns) {
    const matches = markdown.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!seen.has(m)) { seen.add(m); faqCount++; }
      }
    }
  }
  return faqCount;
}

/**
 * 内部リンクの数をカウント
 */
function countInternalLinks(markdown) {
  const internalPatterns = [
    /\[INTERNAL:[^\]]+\]/g,
    /\[.*?\]\(\/posts\/[^\)]+\)/g,
    /\[.*?\]\(\.\.\/[^\)]+\)/g
  ];
  let linkCount = 0;
  for (const pattern of internalPatterns) {
    const matches = markdown.match(pattern);
    if (matches) linkCount += matches.length;
  }
  return linkCount;
}

/**
 * アフィリエイトリンクの数をカウント
 */
function countAffiliateLinks(markdown) {
  const affiliatePatterns = [
    /\[AFF_LINK:[^\]]+\]/g,      // Writer が生成するプレースホルダー
    /\[AFFILIATE:[^\]]+\]/g,      // 別名プレースホルダー
    /https?:\/\/(amzn\.to|bit\.ly|affiliate\.|a8\.net)/g
  ];
  let linkCount = 0;
  for (const pattern of affiliatePatterns) {
    const matches = markdown.match(pattern);
    if (matches) linkCount += matches.length;
  }
  return linkCount;
}

/**
 * CTAセクションの存在確認
 */
function hasCTA(markdown) {
  const ctaPatterns = [
    /##\s*まとめ/i,
    /今すぐ.*試/i,
    /無料.*登録/i,
    /詳細.*こちら/i
  ];
  return ctaPatterns.some(pattern => pattern.test(markdown));
}

/**
 * AI要約最適化セクションの存在確認
 */
function hasAISummary(markdown) {
  const summaryPatterns = [
    /##\s*この記事で分かること/i,
    /##\s*AI要約最適化/i
  ];
  return summaryPatterns.some(pattern => pattern.test(markdown));
}

/**
 * スパムキーワード頻度チェック
 */
function checkSpamKeywords(markdown) {
  const issues = [];
  for (const keyword of QUALITY_CRITERIA.spamKeywords) {
    const regex = new RegExp(keyword, 'g');
    const matches = markdown.match(regex);
    const count = matches ? matches.length : 0;
    if (count > QUALITY_CRITERIA.maxSpamKeywordFreq) {
      issues.push(`"${keyword}" が ${count} 回出現（上限 ${QUALITY_CRITERIA.maxSpamKeywordFreq} 回）`);
    }
  }
  return issues;
}

/**
 * 記事内インライン画像の数をカウント（ヒーロー画像除く）
 */
function countInlineImages(markdown) {
  const allImages = markdown.match(/!\[.*?\]\(.*?\)/g) || [];
  // front-matter の image: フィールドは別途管理なのでここは本文の画像のみ
  return allImages.length;
}

/**
 * 画像・見出しで区切られたテキストブロックの最大長をチェック
 */
function checkTextBlockLength(markdown) {
  // 画像・見出し・テーブル・コードブロックで分割
  const blocks = markdown.split(/!\[.*?\]\(.*?\)|^#{1,4}\s.+$|^\|.+\|.+\|$/m);
  let maxLen = 0;
  for (const block of blocks) {
    const len = block.replace(/\s+/g, '').length;
    if (len > maxLen) maxLen = len;
  }
  return maxLen;
}

/**
 * 同一文の繰り返しチェック
 */
function checkDuplicateSentences(markdown) {
  const sentences = markdown.split(/[。\n]/).filter(s => {
    const t = s.trim();
    if (t.length <= 10) return false;
    // Markdown テーブルセパレーター行（|---|---| など）は除外
    if (/^\|[\s\-:|]+\|/.test(t)) return false;
    return true;
  });
  const seen = new Set();
  const duplicates = [];

  for (const sentence of sentences) {
    const normalized = sentence.trim();
    if (seen.has(normalized)) {
      duplicates.push(normalized.substring(0, 50) + '...');
    } else {
      seen.add(normalized);
    }
  }

  return duplicates.slice(0, 3); // 最大3件まで表示
}

// =============================================================================
// 品質チェック実行
// =============================================================================

function performQualityCheck(articlePath) {
  log(`📄 記事ファイル読み込み: ${articlePath}`);
  const markdown = readMarkdown(articlePath);
  
  if (!markdown) {
    return {
      approved: false,
      issues: ['記事ファイルが読み込めませんでした'],
      details: {}
    };
  }
  
  const body = extractBody(markdown);
  const issues = [];
  const details = {};
  
  // 1. 文字数チェック
  const charCount = countCharacters(body);
  details.characters = charCount;
  if (charCount < QUALITY_CRITERIA.minCharacters) {
    issues.push(`文字数不足: ${charCount}字（基準 ${QUALITY_CRITERIA.minCharacters}字以上）`);
  }
  
  // 2. 構成チェック - テーブル
  const tableCount = countTables(body);
  details.tables = tableCount;
  if (tableCount < QUALITY_CRITERIA.minTables) {
    issues.push(`比較表不足: ${tableCount}個（基準 ${QUALITY_CRITERIA.minTables}個以上）`);
  }
  
  // 3. 構成チェック - FAQ
  const faqCount = countFAQs(body);
  details.faq = faqCount;
  if (faqCount < QUALITY_CRITERIA.minFAQ) {
    issues.push(`FAQ不足: ${faqCount}個（基準 ${QUALITY_CRITERIA.minFAQ}個以上）`);
  }
  
  // 4. 構成チェック - 内部リンク
  const internalLinkCount = countInternalLinks(body);
  details.internalLinks = internalLinkCount;
  if (internalLinkCount < QUALITY_CRITERIA.minInternalLinks) {
    issues.push(`内部リンク不足: ${internalLinkCount}個（基準 ${QUALITY_CRITERIA.minInternalLinks}個以上）`);
  }
  
  // 5. 構成チェック - アフィリエイトリンク
  const affiliateLinkCount = countAffiliateLinks(body);
  details.affiliateLinks = affiliateLinkCount;
  if (affiliateLinkCount < QUALITY_CRITERIA.minAffiliateLinks) {
    issues.push(`アフィリエイトリンク不足: ${affiliateLinkCount}個（基準 ${QUALITY_CRITERIA.minAffiliateLinks}個以上）`);
  }
  
  // 6. 構成チェック - CTA
  const ctaExists = hasCTA(body);
  details.hasCTA = ctaExists;
  if (!ctaExists) {
    issues.push('CTAセクションが見つかりません');
  }
  
  // 7. 構成チェック - AI要約最適化セクション
  const aiSummaryExists = hasAISummary(body);
  details.hasAISummary = aiSummaryExists;
  if (!aiSummaryExists) {
    issues.push('AI要約最適化セクションが見つかりません');
  }
  
  // 8. 記事内画像チェック
  const inlineImageCount = countInlineImages(body);
  details.inlineImages = inlineImageCount;
  if (inlineImageCount < QUALITY_CRITERIA.minInlineImages) {
    issues.push(`記事内画像不足: ${inlineImageCount}枚（基準 ${QUALITY_CRITERIA.minInlineImages}枚以上）`);
  }

  // 9. テキストブロック長チェック
  const maxBlock = checkTextBlockLength(body);
  details.maxTextBlock = maxBlock;
  if (maxBlock > QUALITY_CRITERIA.maxTextBlockLength) {
    issues.push(`連続テキストが長すぎます: ${maxBlock}字（上限 ${QUALITY_CRITERIA.maxTextBlockLength}字）`);
  }

  // 10. スパムキーワードチェック
  const spamIssues = checkSpamKeywords(body);
  details.spamIssues = spamIssues;
  issues.push(...spamIssues);
  
  // 11. 重複文チェック（警告のみ、却下基準から除外）
  const duplicates = checkDuplicateSentences(body);
  details.duplicateSentences = duplicates;
  // AI生成記事では重複が出やすいため警告のみとし却下しない
  
  // 承認判定
  const approved = issues.length === 0;
  
  return {
    approved,
    issues,
    details
  };
}

// =============================================================================
// output.md 生成
// =============================================================================

function generateOutput(checkResult, articlePath, timestamp) {
  const { approved, issues, details } = checkResult;
  const status = approved ? '✅ **承認（Approved）**' : '❌ **却下（Rejected）**';
  
  let output = `# Editor Agent - 品質チェック結果\n\n`;
  output += `**日時**: ${timestamp}\n`;
  output += `**記事**: ${articlePath}\n`;
  output += `**判定**: ${status}\n\n`;
  
  output += `---\n\n`;
  output += `## 📊 チェック詳細\n\n`;
  output += `| 項目 | 実測値 | 基準値 | 合否 |\n`;
  output += `|------|--------|--------|------|\n`;
  output += `| 文字数 | ${details.characters}字 | ${QUALITY_CRITERIA.minCharacters}字以上 | ${details.characters >= QUALITY_CRITERIA.minCharacters ? '✅' : '❌'} |\n`;
  output += `| 比較表 | ${details.tables}個 | ${QUALITY_CRITERIA.minTables}個以上 | ${details.tables >= QUALITY_CRITERIA.minTables ? '✅' : '❌'} |\n`;
  output += `| FAQ | ${details.faq}個 | ${QUALITY_CRITERIA.minFAQ}個以上 | ${details.faq >= QUALITY_CRITERIA.minFAQ ? '✅' : '❌'} |\n`;
  output += `| 内部リンク | ${details.internalLinks}個 | ${QUALITY_CRITERIA.minInternalLinks}個以上 | ${details.internalLinks >= QUALITY_CRITERIA.minInternalLinks ? '✅' : '❌'} |\n`;
  output += `| アフィリエイトリンク | ${details.affiliateLinks}個 | ${QUALITY_CRITERIA.minAffiliateLinks}個以上 | ${details.affiliateLinks >= QUALITY_CRITERIA.minAffiliateLinks ? '✅' : '❌'} |\n`;
  output += `| CTA | ${details.hasCTA ? 'あり' : 'なし'} | 必須 | ${details.hasCTA ? '✅' : '❌'} |\n`;
  output += `| AI要約セクション | ${details.hasAISummary ? 'あり' : 'なし'} | 必須 | ${details.hasAISummary ? '✅' : '❌'} |\n`;
  output += `| 記事内画像 | ${details.inlineImages ?? '-'}枚 | ${QUALITY_CRITERIA.minInlineImages}枚以上 | ${(details.inlineImages ?? 0) >= QUALITY_CRITERIA.minInlineImages ? '✅' : '❌'} |\n`;
  output += `| 最長テキストブロック | ${details.maxTextBlock ?? '-'}字 | ${QUALITY_CRITERIA.maxTextBlockLength}字以下 | ${(details.maxTextBlock ?? 0) <= QUALITY_CRITERIA.maxTextBlockLength ? '✅' : '❌'} |\n\n`;
  
  if (issues.length > 0) {
    output += `## ⚠️ 検出された問題点\n\n`;
    issues.forEach((issue, i) => {
      output += `${i + 1}. ${issue}\n`;
    });
    output += `\n`;
  }
  
  if (details.spamIssues && details.spamIssues.length > 0) {
    output += `### スパムキーワード\n\n`;
    details.spamIssues.forEach(issue => {
      output += `- ${issue}\n`;
    });
    output += `\n`;
  }
  
  if (details.duplicateSentences && details.duplicateSentences.length > 0) {
    output += `### 重複文\n\n`;
    details.duplicateSentences.forEach(dup => {
      output += `- "${dup}"\n`;
    });
    output += `\n`;
  }
  
  output += `---\n\n`;
  
  if (approved) {
    output += `## ✅ 次のステップ\n\n`;
    output += `記事は品質基準を満たしています。\n`;
    output += `次のエージェント（Analyst）へ引き継ぎます。\n`;
  } else {
    output += `## ❌ 改善が必要\n\n`;
    output += `上記の問題点を修正してから再度チェックしてください。\n`;
    output += `パイプラインを一時停止します。\n`;
  }
  
  return output;
}

// =============================================================================
// memory.md 更新
// =============================================================================

function updateMemory(checkResult, articlePath, timestamp) {
  let memory = '';
  if (fs.existsSync(MEMORY_FILE)) {
    memory = fs.readFileSync(MEMORY_FILE, 'utf8');
  } else {
    memory = `# Editor Agent - チェック履歴\n\n`;
  }
  
  const { approved, issues, details } = checkResult;
  const status = approved ? '✅ 承認' : '❌ 却下';
  
  memory += `## ${timestamp}\n\n`;
  memory += `**記事**: ${articlePath}\n`;
  memory += `**判定**: ${status}\n`;
  memory += `**文字数**: ${details.characters}字\n`;
  memory += `**比較表**: ${details.tables}個 | **FAQ**: ${details.faq}個\n`;
  memory += `**内部リンク**: ${details.internalLinks}個 | **アフィリエイトリンク**: ${details.affiliateLinks}個\n\n`;
  
  if (issues.length > 0) {
    memory += `**問題点**: ${issues.length}件\n`;
    issues.slice(0, 3).forEach(issue => {
      memory += `- ${issue}\n`;
    });
    memory += `\n`;
  }
  
  memory += `---\n\n`;
  
  writeMarkdown(MEMORY_FILE, memory);
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const startTime = Date.now();
  log('📝 Editor Agent 起動');
  
  try {
    // 1. context.json 読み込み
    const context = readJSON(CONTEXT_FILE);
    if (!context) {
      throw new Error('context.json が読み込めません');
    }
    
    const articlePath = context.article_path;
    if (!articlePath) {
      throw new Error('article_path が context.json に設定されていません');
    }
    
    const fullArticlePath = path.join(BASE_DIR, articlePath);
    if (!fs.existsSync(fullArticlePath)) {
      throw new Error(`記事ファイルが見つかりません: ${fullArticlePath}`);
    }
    
    // 2. 品質チェック実行
    log('🔍 品質チェック実行中...');
    const checkResult = performQualityCheck(fullArticlePath);
    
    // 3. 結果出力
    const timestamp = new Date().toISOString();
    const output = generateOutput(checkResult, articlePath, timestamp);
    writeMarkdown(OUTPUT_FILE, output);
    
    // 4. メモリ更新
    updateMemory(checkResult, articlePath, timestamp);
    
    // 5. context.json 更新
    const { approved, issues } = checkResult;
    context.editor_decision = approved ? 'approved' : 'rejected';
    context.editor_issues = issues;
    context.current_phase = approved ? 'analyst' : 'failed';
    context.status = approved ? 'in_progress' : 'failed';
    
    // 完了エージェント記録
    if (!context.completed_agents) {
      context.completed_agents = [];
    }
    context.completed_agents.push({
      agent: 'editor',
      timestamp: timestamp,
      duration: (Date.now() - startTime) / 1000,
      decision: context.editor_decision
    });
    
    writeJSON(CONTEXT_FILE, context);
    
    // 6. 結果サマリー
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`✅ Editor Agent 完了 (${duration}秒)`);
    log(`記事: ${articlePath}`);
    log(`判定: ${approved ? '✅ 承認' : '❌ 却下'}`);
    if (!approved) {
      log(`問題点: ${issues.length}件`);
      issues.slice(0, 3).forEach(issue => {
        log(`  - ${issue}`);
      });
    }
    log(`次フェーズ: ${context.current_phase}`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    process.exit(approved ? 0 : 1);
    
  } catch (err) {
    log(`❌ エラー: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main();
}

module.exports = { performQualityCheck };
