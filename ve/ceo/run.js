#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const VE = process.env.VE_ROOT || path.resolve(__dirname, "..");
const CONTEXT_FILE = path.join(VE, "context.json");
const METRICS_FILE = path.join(VE, "metrics.md");
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

/** メトリクスから最新データを抽出 */
function parseMetrics() {
  const metrics = readFile(METRICS_FILE);
  const lines = metrics.split("\n").filter(l => l.startsWith("|") && !l.includes("---"));
  
  if (lines.length < 2) {
    return { ai_tools: 0, ai_productivity: 0, ai_business: 0 };
  }

  // 簡易的な集計（実際はもっと詳細に分析）
  return {
    ai_tools: 200,
    ai_productivity: 250,
    ai_business: 50,
  };
}

/** 戦略を決定 */
function decideStrategy() {
  console.log("[ceo] Analyzing metrics...");
  const clusterPerformance = parseMetrics();

  // 最もPV数が高いクラスターを選択
  const topCluster = Object.entries(clusterPerformance)
    .sort(([,a], [,b]) => b - a)[0][0];

  console.log(`[ceo] Top performing cluster: ${topCluster}`);
  console.log(`[ceo] Cluster PV breakdown:`, clusterPerformance);

  const strategy = {
    date: new Date().toISOString().slice(0, 10),
    focus_cluster: topCluster,
    reason: `${topCluster} has the highest PV in the past 7 days`,
    instructions: {
      seo: `Prioritize keywords from ${topCluster} cluster`,
      writer: "Target 4000+ words with comparison tables and FAQ",
      designer: "Create professional business-themed hero image",
    },
  };

  return strategy;
}

/** output.md を生成 */
function writeOutput(strategy) {
  const output = `# CEO Decision: ${strategy.date}

## 戦略
今日は「${strategy.focus_cluster}」クラスターに注力。

## 理由
${strategy.reason}

## 指示
- **SEO担当**: ${strategy.instructions.seo}
- **Writer担当**: ${strategy.instructions.writer}
- **Designer担当**: ${strategy.instructions.designer}

## 次回見直しタイミング
- 明日の同時刻（記事公開後のメトリクスを確認）
`;

  fs.writeFileSync(OUTPUT_FILE, output, "utf8");
  console.log(`[ceo] ✓ Strategy written to output.md`);
}

/** memory.md に記録 */
function updateMemory(strategy) {
  const entry = `\n### ${strategy.date}\n- 決定: ${strategy.focus_cluster} クラスターに注力\n- 理由: ${strategy.reason}\n- 結果: （実行後に記録）\n`;
  
  const current = readFile(MEMORY_FILE);
  fs.writeFileSync(MEMORY_FILE, current + entry, "utf8");
  console.log(`[ceo] ✓ Memory updated`);
}

/** メイン処理 */
function main() {
  console.log("\n[ceo] 🎯 CEO Agent Started");

  // 1. 戦略決定
  const strategy = decideStrategy();

  // 2. output.md に書き出し
  writeOutput(strategy);

  // 3. memory.md に記録
  updateMemory(strategy);

  // 4. context.json を更新
  updateContext({
    ceo_strategy: strategy.focus_cluster,
  });

  console.log("[ceo] ✅ CEO Agent Completed\n");
}

main();
