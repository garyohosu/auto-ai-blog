#!/usr/bin/env node
/**
 * Analyst Agent - メトリクス記録とログ管理
 * 
 * Phase 3 - Agent 2
 * 
 * 責務:
 * - ve/metrics.md 更新（累計記事数、クラスター別記事数、PV履歴）
 * - ve/logs/YYYY-MM-DD.md 詳細ログ保存
 * - 実行サマリー生成
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// 設定
// =============================================================================

const BASE_DIR = path.join(__dirname, '../..');
const CONTEXT_FILE = path.join(__dirname, '../context.json');
const METRICS_FILE = path.join(__dirname, '../metrics.md');
const LOGS_DIR = path.join(__dirname, '../logs');
const OUTPUT_FILE = path.join(__dirname, 'output.md');
const MEMORY_FILE = path.join(__dirname, 'memory.md');
const POSTS_DIR = path.join(BASE_DIR, '_posts');

// =============================================================================
// ユーティリティ関数
// =============================================================================

function log(message) {
  console.log(`[Analyst Agent] ${message}`);
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

function ensureDir(dirpath) {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
}

// =============================================================================
// 記事統計取得
// =============================================================================

/**
 * _posts/ ディレクトリ内の記事ファイルを解析
 */
function getArticleStats() {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  
  const stats = {
    totalArticles: files.length,
    clusterCount: {},
    recentArticles: []
  };
  
  // 最新10記事を取得
  const sorted = files.sort().reverse().slice(0, 10);
  
  for (const file of sorted) {
    const filepath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Front-matter からタグ抽出
    const match = content.match(/tags:\s*\[(.*?)\]/);
    if (match) {
      const tags = match[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
      
      // クラスター別カウント（簡易版：第一タグをクラスターとみなす）
      const cluster = tags[0] || 'その他';
      stats.clusterCount[cluster] = (stats.clusterCount[cluster] || 0) + 1;
      
      stats.recentArticles.push({
        filename: file,
        tags: tags
      });
    }
  }
  
  return stats;
}

// =============================================================================
// metrics.md 更新
// =============================================================================

function updateMetrics(context, stats) {
  const today = context.date;
  const timestamp = new Date().toISOString();
  
  let metrics = '';
  if (fs.existsSync(METRICS_FILE)) {
    metrics = readMarkdown(METRICS_FILE);
  } else {
    metrics = `# メトリクスダッシュボード\n\n`;
    metrics += `**最終更新**: ${timestamp}\n\n`;
    metrics += `---\n\n`;
  }
  
  // 累計記事数セクション更新
  const articleCountRegex = /## 📊 累計記事数[\s\S]*?(?=##|$)/;
  const newArticleCount = `## 📊 累計記事数\n\n`;
  const articleCountContent = `**合計**: ${stats.totalArticles}記事\n\n`;
  const clusterTable = `### クラスター別内訳\n\n| クラスター | 記事数 |\n|-----------|--------|\n`;
  const clusterRows = Object.entries(stats.clusterCount)
    .sort((a, b) => b[1] - a[1])
    .map(([cluster, count]) => `| ${cluster} | ${count}記事 |`)
    .join('\n');
  
  const articleSection = newArticleCount + articleCountContent + clusterTable + clusterRows + '\n\n';
  
  if (articleCountRegex.test(metrics)) {
    metrics = metrics.replace(articleCountRegex, articleSection);
  } else {
    metrics += articleSection;
  }
  
  // 最新更新日時
  metrics = metrics.replace(
    /\*\*最終更新\*\*:.*?\n/,
    `**最終更新**: ${timestamp}\n`
  );
  
  // 日次ログセクション追加
  const dailyLogRegex = /## 📅 日次ログ[\s\S]*?(?=##|$)/;
  const newDailyLog = `## 📅 日次ログ\n\n### ${today}\n\n`;
  const dailyContent = `- **記事生成**: ${context.article_path || 'なし'}\n`;
  const dailyContent2 = `- **キーワード**: ${context.selected_keyword?.slug || 'なし'}\n`;
  const dailyContent3 = `- **実行時間**: ${context.completed_agents ? context.completed_agents.reduce((sum, a) => sum + (a.duration || 0), 0).toFixed(2) : '0.00'}秒\n`;
  const dailyContent4 = `- **ステータス**: ${context.status || 'unknown'}\n\n`;
  
  const dailySection = newDailyLog + dailyContent + dailyContent2 + dailyContent3 + dailyContent4;
  
  if (dailyLogRegex.test(metrics)) {
    // 既存ログの先頭に追加
    metrics = metrics.replace(dailyLogRegex, (match) => {
      return dailySection + match.replace(/## 📅 日次ログ\n\n/, '');
    });
  } else {
    metrics += dailySection;
  }
  
  writeMarkdown(METRICS_FILE, metrics);
}

// =============================================================================
// logs/YYYY-MM-DD.md 更新
// =============================================================================

function updateDailyLog(context) {
  ensureDir(LOGS_DIR);
  
  const today = context.date;
  const logFile = path.join(LOGS_DIR, `${today}.md`);
  
  let log = '';
  if (fs.existsSync(logFile)) {
    log = readMarkdown(logFile);
  } else {
    log = `# 実行ログ - ${today}\n\n`;
  }
  
  // 最終実行サマリー追加
  log += `## 最終実行 (${new Date().toISOString()})\n\n`;
  log += `### 実行結果\n\n`;
  log += `- **ステータス**: ${context.status}\n`;
  log += `- **現在フェーズ**: ${context.current_phase}\n`;
  log += `- **記事**: ${context.article_path || 'なし'}\n`;
  log += `- **キーワード**: ${context.selected_keyword?.title || 'なし'}\n\n`;
  
  log += `### エージェント実行履歴\n\n`;
  log += `| エージェント | 開始時刻 | 所要時間 | 備考 |\n`;
  log += `|------------|---------|---------|------|\n`;
  
  if (context.completed_agents && context.completed_agents.length > 0) {
    for (const agent of context.completed_agents) {
      const duration = agent.duration ? `${agent.duration.toFixed(2)}秒` : '-';
      const note = agent.decision ? `判定: ${agent.decision}` : '-';
      log += `| ${agent.agent} | ${agent.timestamp} | ${duration} | ${note} |\n`;
    }
  }
  
  log += `\n`;
  
  // エラー情報
  if (context.status === 'failed' && context.editor_issues) {
    log += `### ⚠️ 検出された問題\n\n`;
    context.editor_issues.forEach((issue, i) => {
      log += `${i + 1}. ${issue}\n`;
    });
    log += `\n`;
  }
  
  log += `---\n\n`;
  
  writeMarkdown(logFile, log);
}

// =============================================================================
// output.md 生成
// =============================================================================

function generateOutput(context, stats) {
  const timestamp = new Date().toISOString();
  
  let output = `# Analyst Agent - 実行サマリー\n\n`;
  output += `**日時**: ${timestamp}\n`;
  output += `**ステータス**: ${context.status}\n\n`;
  output += `---\n\n`;
  
  output += `## 📊 本日の実行結果\n\n`;
  output += `### 記事生成\n\n`;
  output += `- **ファイル**: ${context.article_path || 'なし'}\n`;
  output += `- **タイトル**: ${context.selected_keyword?.title || 'なし'}\n`;
  output += `- **キーワード**: ${context.selected_keyword?.slug || 'なし'}\n`;
  output += `- **クラスター**: ${context.ceo_strategy || 'なし'}\n\n`;
  
  output += `### エージェント実行時間\n\n`;
  if (context.completed_agents && context.completed_agents.length > 0) {
    output += `| エージェント | 所要時間 |\n`;
    output += `|------------|----------|\n`;
    for (const agent of context.completed_agents) {
      const duration = agent.duration ? `${agent.duration.toFixed(2)}秒` : '-';
      output += `| ${agent.agent} | ${duration} |\n`;
    }
    
    const totalDuration = context.completed_agents.reduce((sum, a) => sum + (a.duration || 0), 0);
    output += `| **合計** | **${totalDuration.toFixed(2)}秒** |\n\n`;
  }
  
  if (context.status === 'failed' && context.editor_issues) {
    output += `### ⚠️ 品質チェック問題\n\n`;
    context.editor_issues.forEach((issue, i) => {
      output += `${i + 1}. ${issue}\n`;
    });
    output += `\n`;
  }
  
  output += `---\n\n`;
  output += `## 📈 累計統計\n\n`;
  output += `- **総記事数**: ${stats.totalArticles}記事\n`;
  output += `- **クラスター数**: ${Object.keys(stats.clusterCount).length}個\n\n`;
  
  output += `### トップクラスター\n\n`;
  const topClusters = Object.entries(stats.clusterCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  output += `| クラスター | 記事数 |\n`;
  output += `|-----------|--------|\n`;
  for (const [cluster, count] of topClusters) {
    output += `| ${cluster} | ${count}記事 |\n`;
  }
  output += `\n`;
  
  output += `---\n\n`;
  output += `## ✅ 完了\n\n`;
  output += `メトリクスとログを更新しました。\n`;
  output += `- \`ve/metrics.md\`\n`;
  output += `- \`ve/logs/${context.date}.md\`\n`;
  
  return output;
}

// =============================================================================
// memory.md 更新
// =============================================================================

function updateMemory(context, stats) {
  let memory = '';
  if (fs.existsSync(MEMORY_FILE)) {
    memory = readMarkdown(MEMORY_FILE);
  } else {
    memory = `# Analyst Agent - 分析履歴\n\n`;
  }
  
  const timestamp = new Date().toISOString();
  
  memory += `## ${timestamp}\n\n`;
  memory += `**日付**: ${context.date}\n`;
  memory += `**記事**: ${context.article_path || 'なし'}\n`;
  memory += `**総記事数**: ${stats.totalArticles}記事\n`;
  memory += `**ステータス**: ${context.status}\n\n`;
  
  if (context.completed_agents) {
    const totalDuration = context.completed_agents.reduce((sum, a) => sum + (a.duration || 0), 0);
    memory += `**実行時間**: ${totalDuration.toFixed(2)}秒\n`;
  }
  
  memory += `\n---\n\n`;
  
  writeMarkdown(MEMORY_FILE, memory);
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const startTime = Date.now();
  log('📊 Analyst Agent 起動');
  
  try {
    // 1. context.json 読み込み
    const context = readJSON(CONTEXT_FILE);
    if (!context) {
      throw new Error('context.json が読み込めません');
    }
    
    // 2. 記事統計取得
    log('📈 記事統計取得中...');
    const stats = getArticleStats();
    
    // 3. metrics.md 更新
    log('📝 メトリクス更新中...');
    updateMetrics(context, stats);
    
    // 4. 日次ログ更新
    log('📅 日次ログ更新中...');
    updateDailyLog(context);
    
    // 5. output.md 生成
    const timestamp = new Date().toISOString();
    const output = generateOutput(context, stats);
    writeMarkdown(OUTPUT_FILE, output);
    
    // 6. memory.md 更新
    updateMemory(context, stats);
    
    // 7. context.json 更新（Analyst は最終エージェント）
    context.current_phase = 'completed';
    
    if (!context.completed_agents) {
      context.completed_agents = [];
    }
    context.completed_agents.push({
      agent: 'analyst',
      timestamp: timestamp,
      duration: (Date.now() - startTime) / 1000
    });
    
    writeJSON(CONTEXT_FILE, context);
    
    // 8. 結果サマリー
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`✅ Analyst Agent 完了 (${duration}秒)`);
    log(`総記事数: ${stats.totalArticles}記事`);
    log(`今日の記事: ${context.article_path || 'なし'}`);
    log(`ステータス: ${context.status}`);
    log(`メトリクス更新: ve/metrics.md`);
    log(`ログ更新: ve/logs/${context.date}.md`);
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

module.exports = { getArticleStats, updateMetrics };
