#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// Orchestrator — エージェント実行を制御（OpenClaw + multi-agent-shogun 方式）
// + Editor 却下時の Writer リトライ機構
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

/** リトライ設定 */
const RETRY_CONFIG = {
  maxRetries: 3,           // 最大リトライ回数
  retryableAgents: {
    editor: ["writer", "designer", "linker"]  // Editor失敗時に再実行するエージェント
  }
};

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
    retry_count: 0,           // リトライ回数を追加
    retry_history: [],        // リトライ履歴を追加
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

/** Editor却下の理由を取得 */
function getEditorRejectionReason() {
  const editorOutputPath = path.join(VE, "editor", "output.md");
  if (!fs.existsSync(editorOutputPath)) {
    return "Unknown (output.md not found)";
  }
  
  const output = fs.readFileSync(editorOutputPath, "utf8");
  
  // "## ❌ 不合格理由" セクションを抽出
  const reasonMatch = output.match(/## ❌ 不合格理由\n\n([\s\S]*?)(?:\n\n##|$)/);
  if (reasonMatch && reasonMatch[1]) {
    return reasonMatch[1].trim().split('\n').slice(0, 3).join('\n'); // 最初の3行のみ
  }
  
  return "Unknown rejection reason";
}

/** リトライが必要かどうか判定 */
function shouldRetry(failedAgent, context) {
  // リトライ対象のエージェントか確認
  if (!RETRY_CONFIG.retryableAgents[failedAgent]) {
    return false;
  }
  
  // 最大リトライ回数を超えていないか確認
  if (context.retry_count >= RETRY_CONFIG.maxRetries) {
    console.log(`[orchestrator] ⚠️  Max retries (${RETRY_CONFIG.maxRetries}) reached`);
    return false;
  }
  
  return true;
}

/** リトライ処理を実行 */
function performRetry(failedAgent, context, agentResults) {
  const retryAgents = RETRY_CONFIG.retryableAgents[failedAgent];
  const retryCount = context.retry_count + 1;
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 RETRY #${retryCount}: ${failedAgent} rejected the article`);
  console.log(`   Re-running: ${retryAgents.join(" → ")}`);
  console.log(`${"=".repeat(60)}\n`);
  
  // 却下理由を取得
  const rejectionReason = getEditorRejectionReason();
  console.log(`📋 Rejection reason:\n${rejectionReason}\n`);
  
  // context を更新（却下理由を保存）
  updateContext({
    retry_count: retryCount,
    rejection_reason: rejectionReason,  // Writer が読み込む
    retry_history: [
      ...(context.retry_history || []),
      {
        attempt: retryCount,
        failed_at: failedAgent,
        reason: rejectionReason,
        timestamp: new Date().toISOString(),
      }
    ]
  });
  
  // 再実行するエージェントを実行
  const retryResults = [];
  for (const agentName of retryAgents) {
    updateContext({ phase: `retry-${agentName}` });
    const result = runAgent(agentName);
    retryResults.push({ agent: `${agentName} (retry #${retryCount})`, ...result });
    agentResults.push(retryResults[retryResults.length - 1]);
    
    if (!result.success) {
      console.error(`[orchestrator] ❌ Retry failed at: ${agentName}`);
      return { success: false, results: retryResults };
    }
  }
  
  // Editor を再実行
  updateContext({ phase: `retry-${failedAgent}` });
  const editorRetryResult = runAgent(failedAgent);
  retryResults.push({ agent: `${failedAgent} (retry #${retryCount})`, ...editorRetryResult });
  agentResults.push(retryResults[retryResults.length - 1]);
  
  return { success: editorRetryResult.success, results: retryResults };
}

/** 日次ログを作成 */
function createDailyLog(date, summary) {
  ensureDir(LOGS_DIR);
  const logFile = path.join(LOGS_DIR, `${date}.md`);

  let retrySection = "";
  if (summary.final_context.retry_count > 0) {
    retrySection = `
## Retry History
${summary.final_context.retry_history.map(r => 
  `### Attempt #${r.attempt} (${r.failed_at})
**Reason:** ${r.reason}
**Timestamp:** ${r.timestamp}
`).join('\n')}
`;
  }

  const content = `# Orchestrator Log: ${date}

## Summary
${summary.status === 'completed' ? '✅ All agents completed successfully' : `❌ Failed at ${summary.failed_at}`}
${summary.final_context.retry_count > 0 ? `\n**Retries:** ${summary.final_context.retry_count}` : ''}

## Agents Execution
${summary.agents.map(a => `- **${a.agent}**: ${a.success ? '✅ Success' : '❌ Failed'} (${a.duration}s)`).join('\n')}
${retrySection}
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
    // SEO がキーワード枯渇で daily-note モードに入った場合、後続をスキップ
    const currentCtx = loadContext();
    if (currentCtx.seo_mode === "daily-note" && agentName !== "ceo" && agentName !== "seo" && agentName !== "analyst") {
      console.log(`[orchestrator] ⏩ Skipping ${agentName} (daily-note mode)`);
      agentResults.push({ agent: agentName, success: true, duration: "0.00", skipped: true });
      continue;
    }

    updateContext({ phase: agentName });
    const result = runAgent(agentName);
    agentResults.push({ agent: agentName, ...result });

    if (!result.success) {
      console.error(`\n[orchestrator] ❌ Pipeline failed at: ${agentName}`);
      console.error(`Reason: ${result.reason}`);

      // リトライが必要か判定
      const currentContext = loadContext();
      if (shouldRetry(agentName, currentContext)) {
        const retryResult = performRetry(agentName, currentContext, agentResults);
        
        if (retryResult.success) {
          console.log(`\n[orchestrator] ✅ Retry succeeded! Continuing pipeline...`);
          continue;  // パイプラインを続行
        } else {
          console.error(`\n[orchestrator] ❌ Retry failed. Stopping pipeline.`);
        }
      }

      // リトライ不可または失敗 → エラー終了
      updateContext({
        status: "failed",
        failed_at: agentName,
        error: result.reason,
      });

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
  const finalContext = loadContext();
  if (finalContext.retry_count > 0) {
    console.log(`   (with ${finalContext.retry_count} retry attempt(s))`);
  }
  console.log("=".repeat(60) + "\n");

  // サマリーログを記録
  const summary = {
    status: "completed",
    total_duration: parseFloat(totalDuration),
    agents: agentResults,
    final_context: finalContext,
    next_action: "Continue daily article publishing",
  };
  createDailyLog(context.date, summary);
}

main().catch((err) => {
  console.error(`[orchestrator] Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
