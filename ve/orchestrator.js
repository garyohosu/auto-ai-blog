#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// Orchestrator — エージェント実行を制御（OpenClaw + multi-agent-shogun 方式）
// ---------------------------------------------------------------------------

const VE = path.resolve(__dirname);
const CONTEXT_FILE = path.join(VE, "context.json");
const AGENTS_DIR = path.join(VE);
const LOGS_DIR = path.join(VE, "logs");

/** 実行順序定義 */
const AGENT_PIPELINE = [
  "ceo",      // 1. 戦略策定
  "seo",      // 2. キーワード選定
  "writer",   // 3. 記事生成
  "designer", // 4. 画像生成
  "linker",   // 5. 内部リンク解決
  "editor",   // 6. 品質チェック
  "analyst",  // 7. メトリクス記録
  // "marketer" は将来実装
];

/** JST today as YYYY-MM-DD */
function jstToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** Ensure directory exists */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** context.json を初期化 */
function initContext() {
  const date = jstToday();

  const context = {
    date,
    timestamp: new Date().toISOString(),
    phase: "init",
    ceo_strategy: null,
    selected_keyword: null,
    article_path: null,
    image_path: null,
    status: "running",
    agents_completed: [],
  };

  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), "utf8");
  console.log(`[orchestrator] ✓ Initialized context: ${date}`);
  return context;
}

/** context.json を読み込み */
function loadContext() {
  if (!fs.existsSync(CONTEXT_FILE)) {
    return initContext();
  }
  return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));
}

/** context.json を更新 */
function updateContext(updates) {
  const context = loadContext();
  Object.assign(context, updates);
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), "utf8");
}

/** エージェントを実行 */
function runAgent(agentName) {
  const agentDir = path.join(AGENTS_DIR, agentName);
  const agentScript = path.join(agentDir, "run.js");

  if (!fs.existsSync(agentScript)) {
    console.log(`[orchestrator] ⚠️  ${agentName}/run.js not found, skipping`);
    return { success: false, reason: "script not found" };
  }

  console.log(`\n[orchestrator] ━━━ Running: ${agentName} ━━━`);
  const startTime = Date.now();

  try {
    // エージェントを子プロセスとして実行
    execSync(`node ${agentScript}`, {
      cwd: agentDir,
      stdio: "inherit",
      env: { ...process.env, VE_ROOT: VE },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[orchestrator] ✅ ${agentName} completed in ${duration}s`);

    // context.json に完了を記録
    const context = loadContext();
    context.agents_completed.push({
      agent: agentName,
      timestamp: new Date().toISOString(),
      duration: parseFloat(duration),
    });
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), "utf8");

    return { success: true, duration };
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[orchestrator] ❌ ${agentName} failed after ${duration}s`);
    console.error(`Error: ${err.message}`);
    return { success: false, reason: err.message, duration };
  }
}

/** 日次ログを作成 */
function createDailyLog(date, summary) {
  ensureDir(LOGS_DIR);
  const logFile = path.join(LOGS_DIR, `${date}.md`);

  const content = `# Orchestrator Log: ${date}

## Summary
${summary.status === 'completed' ? '✅ All agents completed successfully' : `❌ Failed at ${summary.failed_at}`}

## Agents Execution
${summary.agents.map(a => `- **${a.agent}**: ${a.success ? '✅ Success' : '❌ Failed'} (${a.duration}s)`).join('\n')}

## Context
\`\`\`json
${JSON.stringify(summary.final_context, null, 2)}
\`\`\`

## Next Action
${summary.next_action}
`;

  fs.writeFileSync(logFile, content, "utf8");
  console.log(`[orchestrator] ✓ Log saved: ${logFile}`);
}

/** メイン処理 */
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🤖 AI Virtual Employees Orchestrator Started");
  console.log("=".repeat(60) + "\n");

  const startTime = Date.now();

  // 1. context.json を初期化
  const context = initContext();
  const agentResults = [];

  // 2. エージェントを順次実行
  for (const agentName of AGENT_PIPELINE) {
    updateContext({ phase: agentName });
    const result = runAgent(agentName);
    agentResults.push({ agent: agentName, ...result });

    if (!result.success) {
      console.error(`\n[orchestrator] ❌ Pipeline failed at: ${agentName}`);
      console.error(`Reason: ${result.reason}`);

      // context.json にエラーを記録
      updateContext({
        status: "failed",
        failed_at: agentName,
        error: result.reason,
      });

      // エラーログを記録
      const summary = {
        status: "failed",
        failed_at: agentName,
        agents: agentResults,
        final_context: loadContext(),
        next_action: `Fix ${agentName} agent and retry`,
      };
      createDailyLog(context.date, summary);

      process.exit(1);
    }
  }

  // 3. 完了
  updateContext({ status: "completed", phase: "done" });

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n" + "=".repeat(60));
  console.log(`✅ All agents completed in ${totalDuration}s`);
  console.log("=".repeat(60) + "\n");

  // サマリーログを記録
  const summary = {
    status: "completed",
    total_duration: parseFloat(totalDuration),
    agents: agentResults,
    final_context: loadContext(),
    next_action: "Continue daily article publishing",
  };
  createDailyLog(context.date, summary);
}

main().catch((err) => {
  console.error(`[orchestrator] Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
