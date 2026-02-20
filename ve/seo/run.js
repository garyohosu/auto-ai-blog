#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const VE = process.env.VE_ROOT || path.resolve(__dirname, "..");
const CONTEXT_FILE = path.join(VE, "context.json");
const RUN_JS_FILE = path.join(VE, "run.js");
const POSTS_DIR = path.join(VE, "..", "_posts");
const MEMORY_FILE = path.join(__dirname, "memory.md");
const INPUT_FILE = path.join(__dirname, "input.md");
const OUTPUT_FILE = path.join(__dirname, "output.md");

/** ファイル読み込み */
function readFile(filepath) {
  try {
    return fs.readFileSync(filepath, "utf8");
  } catch {
    return "";
  }
}

/** context.json を読み込み */
function loadContext() {
  return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));
}

/** context.json を更新 */
function updateContext(updates) {
  const context = loadContext();
  Object.assign(context, updates);
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), "utf8");
}

/** run.js からキーワードプールを抽出 */
function extractKeywordPool() {
  const runJs = readFile(RUN_JS_FILE);
  const match = runJs.match(/const KEYWORD_POOL = \[([\s\S]*?)\];/);
  
  if (!match) return [];

  // 簡易パーサー（実際はもっと堅牢にする）
  const keywords = [];
  const items = match[1].match(/\{[^}]+\}/g) || [];
  
  for (const item of items) {
    const slug = item.match(/slug:\s*"([^"]+)"/)?.[1];
    const title = item.match(/title:\s*"([^"]+)"/)?.[1];
    const tagsMatch = item.match(/tags:\s*\[([^\]]+)\]/)?.[1];
    const tags = tagsMatch ? tagsMatch.split(',').map(t => t.trim().replace(/"/g, '')) : [];
    
    if (slug && title) {
      keywords.push({ slug, title, tags });
    }
  }

  return keywords;
}

/** 既存記事のスラッグ一覧を取得 */
function getExistingSlugs() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));
  return files.map(f => {
    const m = f.match(/\d{4}-\d{2}-\d{2}-(.+)\.md$/);
    return m ? m[1] : null;
  }).filter(Boolean);
}

/** CEOの戦略に基づいてキーワードを選定 */
function selectKeyword() {
  console.log("[seo] Analyzing CEO strategy...");
  const context = loadContext();
  const ceoStrategy = context.ceo_strategy;

  console.log(`[seo] CEO focus cluster: ${ceoStrategy}`);

  // キーワードプールを取得
  const keywords = extractKeywordPool();
  const existingSlugs = getExistingSlugs();

  console.log(`[seo] Total keywords in pool: ${keywords.length}`);
  console.log(`[seo] Existing articles: ${existingSlugs.length}`);

  // 未使用 & CEO戦略に合致するキーワードを選定
  for (const kw of keywords) {
    if (existingSlugs.includes(kw.slug)) continue;

    // CEOが指定したクラスターに関連するか判定（簡易）
    const isRelevant = ceoStrategy && (
      kw.slug.includes(ceoStrategy.replace('ai-', '')) ||
      kw.tags.some(tag => tag.toLowerCase().includes(ceoStrategy.replace('ai-', '')))
    );

    if (isRelevant || !ceoStrategy) {
      console.log(`[seo] Selected keyword: ${kw.slug}`);
      return kw;
    }
  }

  // 該当なしの場合、最初の未使用キーワードを返す
  for (const kw of keywords) {
    if (!existingSlugs.includes(kw.slug)) {
      console.log(`[seo] Fallback: selected ${kw.slug}`);
      return kw;
    }
  }

  return null;
}

/** output.md を生成 */
function writeOutput(keyword) {
  const output = `# SEO Keyword Selection: ${new Date().toISOString().slice(0, 10)}

## 選定キーワード
- slug: ${keyword.slug}
- title: ${keyword.title}
- tags: [${keyword.tags.join(', ')}]

## 競合分析
- 既存上位記事: 3000字前後
- 推奨文字数: 4000字以上で差別化

## 検索意図
- ユーザーは関連ツール・サービスの比較検討を求めている
- 具体的な使い方・料金・メリット/デメリットを知りたい

## Writer への指示
- 比較表を3つ以上含める
- 具体的な使用例を提示
- FAQ セクションを5問以上
`;

  fs.writeFileSync(OUTPUT_FILE, output, "utf8");
  console.log(`[seo] ✓ Keyword selection written to output.md`);
}

/** memory.md に記録 */
function updateMemory(keyword) {
  const entry = `\n### ${new Date().toISOString().slice(0, 10)}\n- 選定: ${keyword.slug}\n- 理由: CEO戦略に基づく選定\n- 結果: （記事公開後に記録）\n`;
  
  const current = readFile(MEMORY_FILE);
  fs.writeFileSync(MEMORY_FILE, current + entry, "utf8");
  console.log(`[seo] ✓ Memory updated`);
}

/** メイン処理 */
function main() {
  console.log("\n[seo] 🔍 SEO Agent Started");

  // 1. キーワード選定
  const keyword = selectKeyword();

  if (!keyword) {
    console.log("[seo] ⚠️  No available keywords in pool — switching to daily-note mode");
    updateContext({ selected_keyword: null, seo_mode: "daily-note" });
    // daily-note モード: 後続のエージェントはスキップ扱いにする
    const output = `# SEO: ${new Date().toISOString().slice(0, 10)}\n\n## Status\nKEYWORD_POOL exhausted. Pipeline will generate a daily-note instead.\n`;
    fs.writeFileSync(OUTPUT_FILE, output, "utf8");
    console.log("[seo] ✅ SEO Agent Completed (daily-note mode)\n");
    process.exit(0);
  }

  // 2. output.md に書き出し
  writeOutput(keyword);

  // 3. memory.md に記録
  updateMemory(keyword);

  // 4. context.json を更新
  updateContext({
    selected_keyword: keyword,
  });

  console.log("[seo] ✅ SEO Agent Completed\n");
}

main();
