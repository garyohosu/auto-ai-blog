#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, "..");
const VE = path.join(ROOT, "ve");
const POSTS = path.join(ROOT, "_posts");

/** JST today as YYYY-MM-DD */
function jstToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** Read a file (UTF-8) or return null */
function readFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** Ensure directory exists */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Create daily log  (ve/logs/YYYY-MM-DD.md)
// ---------------------------------------------------------------------------
function createDailyLog(date) {
  const logsDir = path.join(VE, "logs");
  ensureDir(logsDir);
  const logFile = path.join(logsDir, `${date}.md`);
  if (fs.existsSync(logFile)) {
    console.log(`[skip] log already exists: ${logFile}`);
    return false;
  }

  const content = `# Daily Log: ${date}

## What was done
- System daily run executed (automated)

## Reasoning
- Automated daily run to keep the blog pipeline active

## Metrics observed
- new_posts: 1
- gsc_clicks: -
- gsc_impr: -
- avg_pos: -
- ga_users: -
- revenue: -

## Next action
- Continue with next priority task from backlog
`;
  fs.writeFileSync(logFile, content, "utf8");
  console.log(`[created] ${logFile}`);
  return true;
}

// ---------------------------------------------------------------------------
// 2. Create daily post  (_posts/YYYY-MM-DD-daily-note.md)
// ---------------------------------------------------------------------------
function createDailyPost(date) {
  ensureDir(POSTS);
  const postFile = path.join(POSTS, `${date}-daily-note.md`);
  if (fs.existsSync(postFile)) {
    console.log(`[skip] post already exists: ${postFile}`);
    return false;
  }

  const content = `---
layout: post
title: "Daily Note – ${date}"
date: ${date}
categories: daily
---

This is an automated daily note generated on ${date}.

Stay tuned for more AI-powered content coming soon.
`;
  fs.writeFileSync(postFile, content, "utf8");
  console.log(`[created] ${postFile}`);
  return true;
}

// ---------------------------------------------------------------------------
// 3. Append row to ve/metrics.md
// ---------------------------------------------------------------------------
function appendMetrics(date, newPosts) {
  const metricsFile = path.join(VE, "metrics.md");
  const current = readFile(metricsFile) || "";

  // Skip if today's row already exists
  if (current.includes(`| ${date} `)) {
    console.log(`[skip] metrics row for ${date} already exists`);
    return;
  }

  // Count total posts
  let totalPosts = 100; // existing posts per spec
  try {
    const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
    totalPosts = 100 + files.length;
  } catch {
    // _posts may not exist yet
  }

  const row = `| ${date} | ${newPosts} | ${totalPosts} | - | - | - | - | - |\n`;
  fs.writeFileSync(metricsFile, current + row, "utf8");
  console.log(`[updated] metrics.md += ${date}`);
}

// ---------------------------------------------------------------------------
// 4. Update ve/state.md
// ---------------------------------------------------------------------------
function updateState(date) {
  const stateFile = path.join(VE, "state.md");
  const content = `# state
- phase: bootstrap
- today_objective: daily run ${date}
- focus_cluster: -
- blockers: -
- next_run: generate first keyword list (JP/EN)
`;
  fs.writeFileSync(stateFile, content, "utf8");
  console.log(`[updated] state.md`);
}

// ---------------------------------------------------------------------------
// 5. Update ve/todo.md – move first backlog item to Today (if Today is empty)
// ---------------------------------------------------------------------------
function updateTodo(date) {
  const todoFile = path.join(VE, "todo.md");
  let content = readFile(todoFile);
  if (!content) return;

  // Only move a task if Today section is empty or has "(empty)"
  const todayMatch = content.match(/## Today\n([\s\S]*?)(?=\n## )/);
  if (todayMatch && !todayMatch[1].includes("(empty)")) {
    console.log(`[skip] todo.md: Today already has tasks`);
    return;
  }

  // Extract first backlog item
  const backlogMatch = content.match(/## Backlog \(prioritized\)\n(- .+)/);
  if (!backlogMatch) {
    console.log(`[skip] todo.md: no backlog items`);
    return;
  }

  const task = backlogMatch[1];

  // Remove from backlog
  content = content.replace(task + "\n", "");

  // Set as Today
  content = content.replace(
    /## Today\n[\s\S]*?(?=\n## Done)/,
    `## Today\n${task}\n\n`
  );

  // Append to Done
  content = content.replace(
    /## Done \(append-only\)\n/,
    `## Done (append-only)\n- [${date}] daily run completed\n`
  );

  fs.writeFileSync(todoFile, content, "utf8");
  console.log(`[updated] todo.md`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const date = jstToday();
  console.log(`\n=== Virtual Employee Run: ${date} (JST) ===\n`);

  // Ensure directories
  ensureDir(path.join(VE, "logs"));
  ensureDir(path.join(VE, "templates"));
  ensureDir(POSTS);

  // Execute steps
  const logCreated = createDailyLog(date);
  const postCreated = createDailyPost(date);
  const newPosts = postCreated ? 1 : 0;

  appendMetrics(date, newPosts);
  updateState(date);
  updateTodo(date);

  console.log(`\n=== Run complete ===\n`);
}

main();
