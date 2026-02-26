#!/usr/bin/env node
/**
 * Linker Agent - 内部リンク解決と関連記事追加
 *
 * Phase 3 - Agent 4
 *
 * 責務:
 * - [INTERNAL: slug] プレースホルダーを実リンクに変換
 * - 記事末尾に関連記事セクションを追加
 * - 記事末尾にAmazonアフィリエイトセクションを追加
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// 設定
// =============================================================================

const BASE_DIR = path.join(__dirname, '../..');
const CONTEXT_FILE = path.join(__dirname, '../context.json');
const POSTS_DIR = path.join(BASE_DIR, '_posts');
const OUTPUT_FILE = path.join(__dirname, 'output.md');
const MEMORY_FILE = path.join(__dirname, 'memory.md');
const CLUSTERS_FILE = path.join(__dirname, 'clusters.md');

// Amazon アソシエイト設定
const AMAZON_STORE_ID = 'junknewsgar02-22';
const AMAZON_BASE_URL = 'https://www.amazon.co.jp/s';

// =============================================================================
// ユーティリティ関数
// =============================================================================

function log(message) {
  console.log(`[Linker Agent] ${message}`);
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
    return '';
  }
}

function writeMarkdown(filepath, content) {
  fs.writeFileSync(filepath, content, 'utf8');
  log(`✅ Markdown保存: ${filepath}`);
}

// =============================================================================
// 記事メタデータ取得
// =============================================================================

/**
 * すべての記事のメタデータを取得
 */
function getAllArticles() {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const filepath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');

    // Front-matter 解析
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) continue;

    const frontMatter = match[1];
    const titleMatch = frontMatter.match(/^title:\s*["']?(.+?)["']?$/m);
    const tagsMatch = frontMatter.match(/^tags:\s*\[(.*?)\]/m);
    const dateMatch = frontMatter.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);

    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');

    articles.push({
      filename: file,
      slug: slug,
      title: titleMatch ? titleMatch[1].trim() : slug,
      tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')) : [],
      date: dateMatch ? dateMatch[1] : ''
    });
  }

  return articles;
}

/**
 * スラッグから記事情報を取得
 */
function findArticleBySlug(articles, slug) {
  return articles.find(a => a.slug === slug);
}

/**
 * 同じタグを持つ関連記事を取得
 */
function findRelatedArticles(articles, currentSlug, currentTags, limit = 3) {
  const related = articles
    .filter(a => a.slug !== currentSlug)
    .map(a => {
      const commonTags = a.tags.filter(tag => currentTags.includes(tag));
      return { ...a, score: commonTags.length };
    })
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, limit);

  return related;
}

// =============================================================================
// 内部リンク解決
// =============================================================================

/**
 * [INTERNAL: slug] を実リンクに変換
 */
function resolveInternalLinks(content, articles) {
  const internalLinkRegex = /\[INTERNAL:\s*([^\]]+)\]/g;
  let resolvedCount = 0;
  let unresolvedCount = 0;

  const newContent = content.replace(internalLinkRegex, (match, slug) => {
    const article = findArticleBySlug(articles, slug.trim());
    if (article) {
      resolvedCount++;
      return `[${article.title}](/posts/${article.slug})`;
    } else {
      unresolvedCount++;
      log(`⚠️ 未解決リンク: ${slug}`);
      return match; // そのまま残す
    }
  });

  return { newContent, resolvedCount, unresolvedCount };
}

// =============================================================================
// 関連記事セクション追加
// =============================================================================

/**
 * 記事末尾に関連記事セクションを追加
 */
function addRelatedArticlesSection(content, relatedArticles) {
  // すでに関連記事セクションが存在する場合は追加しない
  if (/^##\s*関連記事/m.test(content)) {
    log('ℹ️ 関連記事セクションは既に存在します');
    return { newContent: content, added: false };
  }

  if (relatedArticles.length === 0) {
    log('ℹ️ 関連記事が見つかりません');
    return { newContent: content, added: false };
  }

  let relatedSection = `\n\n---\n\n## 関連記事\n\n`;
  for (const article of relatedArticles) {
    relatedSection += `- [${article.title}](/posts/${article.slug})\n`;
  }

  const newContent = content + relatedSection;
  return { newContent, added: true };
}

// =============================================================================
// Amazon アフィリエイトセクション追加
// =============================================================================

/**
 * タグとタイトルから Amazon 検索キーワードを生成し、セクションを返す
 */
function generateAmazonSection(title, tags) {
  const keywords = [];

  // タグから最大2件追加
  if (tags && tags.length > 0) {
    keywords.push(...tags.slice(0, 2));
  }

  // タイトルの先頭語を追加（重複除外）
  if (title) {
    const cleaned = title.replace(/[｜|【】「」『』（）()]/g, ' ').trim();
    const first = cleaned.split(/[\s　]/)[0];
    if (first && !keywords.includes(first)) {
      keywords.push(first);
    }
  }

  if (keywords.length === 0) return '';

  let section = `\n\n---\n\n## おすすめ関連商品\n\n`;
  section += `この記事のテーマに関連した書籍・ツールをAmazonで探せます。\n\n`;

  for (const kw of keywords.slice(0, 3)) {
    const encoded = encodeURIComponent(kw);
    const url = `${AMAZON_BASE_URL}?k=${encoded}&tag=${AMAZON_STORE_ID}`;
    section += `- [「${kw}」関連商品を探す](${url})\n`;
  }

  section += `\n> ※本ページはAmazonアソシエイト・プログラムの参加者です。適格販売により収入を得ています。\n`;

  return section;
}

/**
 * 記事末尾に Amazon アフィリエイトセクションを追加
 */
function addAmazonSection(content, title, tags) {
  if (/^##\s*おすすめ関連商品/m.test(content)) {
    log('ℹ️ Amazon セクションは既に存在します');
    return { newContent: content, added: false };
  }

  const section = generateAmazonSection(title, tags);
  if (!section) {
    log('ℹ️ Amazon セクション生成スキップ（キーワードなし）');
    return { newContent: content, added: false };
  }

  return { newContent: content + section, added: true };
}

// =============================================================================
// output.md 生成
// =============================================================================

function generateOutput(articlePath, resolvedCount, unresolvedCount, relatedAdded, relatedCount, amazonAdded, timestamp) {
  let output = `# Linker Agent - リンク処理結果\n\n`;
  output += `**日時**: ${timestamp}\n`;
  output += `**記事**: ${articlePath}\n\n`;
  output += `---\n\n`;

  output += `## 🔗 内部リンク解決\n\n`;
  output += `- **解決済み**: ${resolvedCount}件\n`;
  output += `- **未解決**: ${unresolvedCount}件\n\n`;

  if (unresolvedCount > 0) {
    output += `⚠️ 未解決リンクは \`[INTERNAL: slug]\` 形式のまま残っています。\n\n`;
  }

  output += `## 📚 関連記事\n\n`;
  if (relatedAdded) {
    output += `✅ 関連記事セクションを追加しました（${relatedCount}件）\n\n`;
  } else {
    output += `ℹ️ 関連記事セクションの追加は不要でした\n\n`;
  }

  output += `## 🛒 Amazon アフィリエイト\n\n`;
  if (amazonAdded) {
    output += `✅ Amazon アフィリエイトセクションを追加しました（Store ID: ${AMAZON_STORE_ID}）\n\n`;
  } else {
    output += `ℹ️ Amazon セクションの追加は不要でした\n\n`;
  }

  output += `---\n\n`;
  output += `## ✅ 完了\n\n`;
  output += `次のエージェント（Editor）へ引き継ぎます。\n`;

  return output;
}

// =============================================================================
// memory.md 更新
// =============================================================================

function updateMemory(articlePath, resolvedCount, relatedAdded, amazonAdded, timestamp) {
  let memory = '';
  if (fs.existsSync(MEMORY_FILE)) {
    memory = readMarkdown(MEMORY_FILE);
  } else {
    memory = `# Linker Agent - リンク処理履歴\n\n`;
  }

  memory += `## ${timestamp}\n\n`;
  memory += `**記事**: ${articlePath}\n`;
  memory += `**解決リンク**: ${resolvedCount}件\n`;
  memory += `**関連記事追加**: ${relatedAdded ? 'はい' : 'いいえ'}\n`;
  memory += `**Amazon追加**: ${amazonAdded ? 'はい' : 'いいえ'}\n\n`;
  memory += `---\n\n`;

  writeMarkdown(MEMORY_FILE, memory);
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const startTime = Date.now();
  log('🔗 Linker Agent 起動');

  try {
    // 1. context.json 読み込み
    const context = readJSON(CONTEXT_FILE);
    if (!context) {
      throw new Error('context.json が読み込めません');
    }

    const articlePath = context.article_path;
    const selectedKeyword = context.selected_keyword;

    if (!articlePath) {
      throw new Error('article_path が context.json に設定されていません');
    }

    const fullArticlePath = path.join(BASE_DIR, articlePath);
    if (!fs.existsSync(fullArticlePath)) {
      throw new Error(`記事ファイルが見つかりません: ${fullArticlePath}`);
    }

    // 2. すべての記事メタデータ取得
    log('📚 記事データベース読み込み中...');
    const articles = getAllArticles();
    log(`  → ${articles.length}記事を検出`);

    // 3. 記事ファイル読み込み
    let content = fs.readFileSync(fullArticlePath, 'utf8');

    // 4. 内部リンク解決
    log('🔍 内部リンク解決中...');
    const { newContent: contentAfterLinks, resolvedCount, unresolvedCount } = resolveInternalLinks(content, articles);

    // 5. 関連記事取得
    const currentTags = selectedKeyword?.tags || [];
    const currentTitle = selectedKeyword?.title || '';
    const currentSlug = articlePath.match(/\d{4}-\d{2}-\d{2}-(.+)\.md$/)[1];
    const relatedArticles = findRelatedArticles(articles, currentSlug, currentTags, 3);

    log(`📚 関連記事: ${relatedArticles.length}件`);

    // 6. 関連記事セクション追加
    const { newContent: contentAfterRelated, added: relatedAdded } = addRelatedArticlesSection(contentAfterLinks, relatedArticles);

    // 7. Amazon アフィリエイトセクション追加
    log('🛒 Amazon アフィリエイトセクション追加中...');
    const { newContent: finalContent, added: amazonAdded } = addAmazonSection(contentAfterRelated, currentTitle, currentTags);

    // 8. 記事ファイル更新
    if (finalContent !== content) {
      fs.writeFileSync(fullArticlePath, finalContent, 'utf8');
      log('✅ 記事ファイル更新完了');
    } else {
      log('ℹ️ 変更なし（リンク解決・関連記事追加の必要なし）');
    }

    // 9. output.md 生成
    const timestamp = new Date().toISOString();
    const output = generateOutput(articlePath, resolvedCount, unresolvedCount, relatedAdded, relatedArticles.length, amazonAdded, timestamp);
    writeMarkdown(OUTPUT_FILE, output);

    // 10. memory.md 更新
    updateMemory(articlePath, resolvedCount, relatedAdded, amazonAdded, timestamp);

    // 11. context.json 更新
    context.current_phase = 'editor';

    if (!context.completed_agents) {
      context.completed_agents = [];
    }
    context.completed_agents.push({
      agent: 'linker',
      timestamp: timestamp,
      duration: (Date.now() - startTime) / 1000,
      resolvedLinks: resolvedCount,
      relatedArticlesAdded: relatedAdded,
      amazonSectionAdded: amazonAdded
    });

    writeJSON(CONTEXT_FILE, context);

    // 12. 結果サマリー
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`✅ Linker Agent 完了 (${duration}秒)`);
    log(`記事: ${articlePath}`);
    log(`解決リンク: ${resolvedCount}件`);
    log(`未解決リンク: ${unresolvedCount}件`);
    log(`関連記事追加: ${relatedAdded ? `はい（${relatedArticles.length}件）` : 'いいえ'}`);
    log(`Amazon追加: ${amazonAdded ? `はい（Store ID: ${AMAZON_STORE_ID}）` : 'いいえ'}`);
    log(`次フェーズ: ${context.current_phase}`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);

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

module.exports = { getAllArticles, resolveInternalLinks, addRelatedArticlesSection, addAmazonSection };
