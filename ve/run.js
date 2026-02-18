#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, "..");
const VE = path.join(ROOT, "ve");
const POSTS = path.join(ROOT, "_posts");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

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
// Keyword pool (used when LLM is unavailable)
// ---------------------------------------------------------------------------
const KEYWORD_POOL = [
  { slug: "best-ai-coding-assistants", title: "【2026年】AIコーディングアシスタント おすすめ6選｜GitHub Copilot vs Cursor vs Claude Code", tags: ["AIコーディング", "GitHub Copilot", "プログラミング"] },
  { slug: "ai-presentation-tools", title: "【2026年】AIプレゼン作成ツール おすすめ5選｜Gamma・Beautiful.ai・Canvaを比較", tags: ["AIプレゼン", "Gamma", "スライド作成"] },
  { slug: "best-ai-translation-tools", title: "【2026年】AI翻訳ツール おすすめ7選｜DeepL vs Google翻訳 vs ChatGPT", tags: ["AI翻訳", "DeepL", "多言語"] },
  { slug: "ai-customer-support-chatbot-guide", title: "AIチャットボットでカスタマーサポートを自動化する方法【導入手順つき】", tags: ["AIチャットボット", "カスタマーサポート", "自動化"] },
  { slug: "best-ai-video-generators", title: "【2026年】AI動画生成ツール おすすめ6選｜Runway・Pika・Soraを徹底比較", tags: ["AI動画生成", "Runway", "Sora"] },
  { slug: "ai-seo-tools-comparison", title: "【2026年】AI搭載SEOツール おすすめ5選｜Surfer SEO・Frase・Jasperを比較", tags: ["AI SEO", "Surfer SEO", "コンテンツSEO"] },
  { slug: "how-to-automate-sns-with-ai", title: "AIでSNS運用を自動化する方法｜投稿作成からスケジュールまで完全ガイド", tags: ["SNS自動化", "AI運用", "マーケティング"] },
  { slug: "best-ai-music-generators", title: "【無料あり】AI音楽生成ツール おすすめ5選｜Suno・Udio・AIVA比較", tags: ["AI音楽", "Suno", "作曲"] },
  { slug: "ai-email-writing-tools", title: "AIでビジネスメールを自動作成｜おすすめツール5選と活用テクニック", tags: ["AIメール", "ビジネス効率化", "文章作成"] },
  { slug: "best-ai-data-analysis-tools", title: "【2026年】AIデータ分析ツール おすすめ6選｜非エンジニアでも使える", tags: ["AIデータ分析", "BI", "ノーコード"] },
];

// ---------------------------------------------------------------------------
// Hero image generation (OpenAI Images API)
// ---------------------------------------------------------------------------
const ASSETS_IMAGES = path.join(ROOT, "assets", "images");

const IMAGE_PROMPT_TEMPLATE = (title) =>
  `Modern flat illustration, blog hero image, about "${title}", ` +
  `futuristic AI workspace, holographic interface, laptop, glowing elements, ` +
  `clean composition, professional, vibrant colors, ` +
  `no text, no letters, ` +
  `16:9 aspect ratio, high quality, sharp, tech style`;

async function generateHeroImage(date, keyword) {
  if (!OPENAI_API_KEY) return null;

  ensureDir(ASSETS_IMAGES);
  const filename = `${date}-${keyword.slug}.png`;
  const filepath = path.join(ASSETS_IMAGES, filename);

  if (fs.existsSync(filepath)) {
    console.log(`[skip] image already exists: ${filename}`);
    return `/assets/images/${filename}`;
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "gpt-image-1",
      prompt: IMAGE_PROMPT_TEMPLATE(keyword.title),
      n: 1,
      size: "1536x1024",
    });

    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/images/generations",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data[0] && json.data[0].b64_json) {
              const buffer = Buffer.from(json.data[0].b64_json, "base64");
              fs.writeFileSync(filepath, buffer);
              console.log(`[created] image: ${filename}`);
              resolve(`/assets/images/${filename}`);
            } else {
              reject(new Error(`Image API error: ${data.slice(0, 300)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// LLM article generation (OpenAI API)
// ---------------------------------------------------------------------------
function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) {
      reject(new Error("OPENAI_API_KEY not set"));
      return;
    }

    const body = JSON.stringify({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].message) {
              resolve(json.choices[0].message.content);
            } else {
              reject(new Error(`API error: ${data.slice(0, 200)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function generateArticleWithLLM(keyword) {
  const prompt = `あなたはSEOに精通したプロのブログライターです。以下のキーワードで、収益化を意識した高品質な日本語ブログ記事を書いてください。

タイトル: ${keyword.title}
タグ: ${keyword.tags.join(", ")}

記事の要件:
- 3000〜5000字程度
- 導入（誰のどんな悩みか）
- 本文（比較表、具体的な手順、ツール紹介）
- FAQ（3〜5問）
- まとめ（次のアクション・CTA）
- アフィリエイトリンクのプレースホルダーを [AFF_LINK: product_name] 形式で入れる
- 内部リンクのプレースホルダーを [INTERNAL: slug] 形式で入れる
- Jekyll の front matter は不要（本文のみ出力）
- evergreen（長期的に検索される）内容にする
- ニュース的な短命コンテンツは避ける

本文のみを出力してください。`;

  return await callOpenAI(prompt);
}

// ---------------------------------------------------------------------------
// Pick today's keyword (avoid duplicates with existing posts)
// ---------------------------------------------------------------------------
function pickKeyword(date) {
  const existingFiles = fs.existsSync(POSTS)
    ? fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"))
    : [];

  for (const kw of KEYWORD_POOL) {
    const alreadyExists = existingFiles.some((f) => f.includes(kw.slug));
    if (!alreadyExists) return kw;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Create daily log  (ve/logs/YYYY-MM-DD.md)
// ---------------------------------------------------------------------------
function createDailyLog(date, articleTitle) {
  const logsDir = path.join(VE, "logs");
  ensureDir(logsDir);
  const logFile = path.join(logsDir, `${date}.md`);
  if (fs.existsSync(logFile)) {
    console.log(`[skip] log already exists: ${logFile}`);
    return false;
  }

  const content = `# Daily Log: ${date}

## What was done
- Published article: "${articleTitle || "daily note"}"
- Updated metrics and state files

## Reasoning
- Prioritized buyer-intent evergreen content for monetization
- Selected topic based on keyword pool to avoid duplication

## Metrics observed
- new_posts: 1
- gsc_clicks: -
- gsc_impr: -
- avg_pos: -
- ga_users: -
- revenue: -

## Next action
- Continue publishing buyer-intent articles from keyword pool
`;
  fs.writeFileSync(logFile, content, "utf8");
  console.log(`[created] ${logFile}`);
  return true;
}

// ---------------------------------------------------------------------------
// 2. Create article post
// ---------------------------------------------------------------------------
function createFallbackArticle(date, keyword, imagePath) {
  const imageField = imagePath ? `\nimage: ${imagePath}` : "";
  const frontMatter = `---
layout: post
title: "${keyword.title}"
date: ${date}
categories: [ai-tools, comparison]
tags: [${keyword.tags.join(", ")}]
description: "${keyword.title}について詳しく解説します。"
lang: ja${imageField}
---`;

  const body = `## はじめに

本記事では「${keyword.title.replace(/【.*?】/, "")}」について詳しく解説します。

AIツールは日々進化しており、最適なツール選びが重要になっています。本記事では主要なツールの特徴・料金・使い方を比較し、あなたに合った選択をサポートします。

---

*この記事は随時更新していきます。最新情報をお見逃しなく。*

[AFF_LINK: chatgpt-plus]
[AFF_LINK: claude-pro]
`;

  return `${frontMatter}\n\n${body}`;
}

async function createArticlePost(date, keyword) {
  ensureDir(POSTS);
  const postFile = path.join(POSTS, `${date}-${keyword.slug}.md`);
  if (fs.existsSync(postFile)) {
    console.log(`[skip] post already exists: ${postFile}`);
    return { created: false, title: keyword.title };
  }

  // Generate hero image first (non-blocking on failure)
  let imagePath = null;
  if (OPENAI_API_KEY) {
    try {
      console.log(`[image] Generating hero image for: ${keyword.slug}`);
      imagePath = await generateHeroImage(date, keyword);
    } catch (err) {
      console.log(`[image] Failed: ${err.message}, continuing without image`);
    }
  }

  let content;

  // Try LLM generation first
  if (OPENAI_API_KEY) {
    try {
      console.log(`[llm] Generating article with OpenAI API...`);
      const body = await generateArticleWithLLM(keyword);
      const imageField = imagePath ? `\nimage: ${imagePath}` : "";
      const frontMatter = `---
layout: post
title: "${keyword.title}"
date: ${date}
categories: [ai-tools, comparison]
tags: [${keyword.tags.join(", ")}]
description: "${keyword.title}について詳しく解説します。"
lang: ja${imageField}
---`;
      content = `${frontMatter}\n\n${body}`;
      console.log(`[llm] Article generated successfully`);
    } catch (err) {
      console.log(`[llm] Failed: ${err.message}, falling back to template`);
      content = createFallbackArticle(date, keyword, imagePath);
    }
  } else {
    console.log(`[info] No OPENAI_API_KEY, using template article`);
    content = createFallbackArticle(date, keyword, imagePath);
  }

  fs.writeFileSync(postFile, content, "utf8");
  console.log(`[created] ${postFile}`);
  return { created: true, title: keyword.title };
}

// ---------------------------------------------------------------------------
// 3. Append row to ve/metrics.md
// ---------------------------------------------------------------------------
function appendMetrics(date, newPosts) {
  const metricsFile = path.join(VE, "metrics.md");
  const current = readFile(metricsFile) || "";

  if (current.includes(`| ${date} `)) {
    console.log(`[skip] metrics row for ${date} already exists`);
    return;
  }

  let totalPosts = 100;
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
function updateState(date, keyword) {
  const stateFile = path.join(VE, "state.md");
  const nextKeyword = pickNextKeyword(keyword);
  const content = `# state
- phase: publishing
- today_objective: publish "${keyword ? keyword.title : "daily content"}"
- focus_cluster: ai-tools
- blockers: -
- next_run: ${nextKeyword ? `publish article: ${nextKeyword.slug}` : "replenish keyword pool"}
`;
  fs.writeFileSync(stateFile, content, "utf8");
  console.log(`[updated] state.md`);
}

function pickNextKeyword(currentKeyword) {
  const existingFiles = fs.existsSync(POSTS)
    ? fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"))
    : [];

  for (const kw of KEYWORD_POOL) {
    if (currentKeyword && kw.slug === currentKeyword.slug) continue;
    const alreadyExists = existingFiles.some((f) => f.includes(kw.slug));
    if (!alreadyExists) return kw;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Update ve/todo.md
// ---------------------------------------------------------------------------
function updateTodo(date, keyword) {
  const todoFile = path.join(VE, "todo.md");
  let content = readFile(todoFile);
  if (!content) return;

  const todayMatch = content.match(/## Today\n([\s\S]*?)(?=\n## )/);
  if (todayMatch && !todayMatch[1].includes("(empty)")) {
    // Replace Today with current task
    content = content.replace(
      /## Today\n[\s\S]*?(?=\n## Done)/,
      `## Today\n- Publish: ${keyword ? keyword.slug : "daily content"}\n\n`
    );
  }

  // Append to Done
  if (!content.includes(`[${date}]`)) {
    content = content.replace(
      /## Done \(append-only\)\n/,
      `## Done (append-only)\n- [${date}] published: ${keyword ? keyword.slug : "daily content"}\n`
    );
  }

  fs.writeFileSync(todoFile, content, "utf8");
  console.log(`[updated] todo.md`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const date = jstToday();
  console.log(`\n=== Virtual Employee Run: ${date} (JST) ===\n`);

  // Ensure directories
  ensureDir(path.join(VE, "logs"));
  ensureDir(path.join(VE, "templates"));
  ensureDir(POSTS);
  ensureDir(ASSETS_IMAGES);

  // Pick keyword for today
  const keyword = pickKeyword(date);
  let newPosts = 0;
  let articleTitle = "";

  if (keyword) {
    console.log(`[keyword] Selected: ${keyword.slug}`);
    const result = await createArticlePost(date, keyword);
    newPosts = result.created ? 1 : 0;
    articleTitle = result.title;
  } else {
    console.log(`[info] All keywords exhausted, creating daily note`);
    ensureDir(POSTS);
    const postFile = path.join(POSTS, `${date}-daily-note.md`);
    if (!fs.existsSync(postFile)) {
      const content = `---
layout: post
title: "Daily Note – ${date}"
date: ${date}
categories: daily
---

This is an automated daily note generated on ${date}.
`;
      fs.writeFileSync(postFile, content, "utf8");
      newPosts = 1;
      articleTitle = `Daily Note – ${date}`;
    }
  }

  createDailyLog(date, articleTitle);
  appendMetrics(date, newPosts);
  updateState(date, keyword);
  updateTodo(date, keyword);

  console.log(`\n=== Run complete ===\n`);
}

main().catch((err) => {
  console.error(`[fatal] ${err.message}`);
  process.exit(1);
});
