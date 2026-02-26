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
// ピラー記事（各クラスターの中心となる包括ガイド）を先頭に追加
const KEYWORD_POOL = [
  { slug: "ultimate-ai-tools-guide-2026",      title: "【2026年版】AIツール完全ガイド｜用途別おすすめ30選まとめ",          tags: ["AIツール", "まとめ", "完全ガイド"] },
  { slug: "ai-productivity-complete-guide",    title: "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】",            tags: ["AI効率化", "生産性", "ビジネス"] },
  { slug: "ai-business-monetization-guide",    title: "AIビジネス完全ガイド｜2026年版収益化・副業から起業まで",             tags: ["AIビジネス", "収益化", "副業"] },
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
  // 第2弾キーワード
  { slug: "chatgpt-api-getting-started",    title: "ChatGPT APIの使い方完全ガイド｜初心者向け入門から実践まで",            tags: ["ChatGPT API", "OpenAI", "プログラミング"] },
  { slug: "claude-api-usage-guide",         title: "Claude APIの使い方と料金｜Anthropic APIで何ができるか解説",              tags: ["Claude API", "Anthropic", "LLM"] },
  { slug: "ai-image-generator-comparison",  title: "【2026年】AI画像生成ツール比較｜Midjourney・DALL-E・Stable Diffusion", tags: ["AI画像生成", "Midjourney", "DALL-E"] },
  { slug: "best-ai-writing-assistants-2026",title: "【2026年】AI文章作成ツール おすすめ7選｜ブログ・SNS・広告コピーに",    tags: ["AI文章作成", "ライティング", "コピーライティング"] },
  { slug: "ai-chatbot-comparison-2026",     title: "【2026年版】AIチャットボット比較｜ChatGPT・Gemini・Claude・Copilot",   tags: ["AIチャットボット", "ChatGPT", "Gemini"] },
  { slug: "ai-document-summarizer-tools",   title: "AI要約ツール おすすめ5選｜PDFや長文をワンクリックで要約する方法",         tags: ["AI要約", "PDF要約", "文書処理"] },
  { slug: "how-to-use-ai-for-job-hunting",  title: "就活・転職活動にAIを活用する方法｜履歴書・面接対策まで完全ガイド",        tags: ["AI転職", "就活", "履歴書"] },
  { slug: "ai-voice-generation-tools",      title: "【2026年】AI音声合成ツール おすすめ6選｜テキスト読み上げ・ナレーション", tags: ["AI音声", "テキスト読み上げ", "ナレーション"] },
  { slug: "ai-no-code-app-builder",         title: "AIノーコードアプリ作成ツール おすすめ5選｜プログラミング不要で開発",      tags: ["ノーコード", "AIアプリ開発", "ローコード"] },
  { slug: "ai-marketing-automation-guide",  title: "AIマーケティング自動化ガイド｜メール・広告・SNSを一元管理する方法",        tags: ["AIマーケティング", "マーケティング自動化", "デジタルマーケティング"] },
  { slug: "best-ai-meeting-transcription",  title: "AI議事録作成ツール おすすめ5選｜会議の自動文字起こしと要約",              tags: ["AI議事録", "文字起こし", "会議効率化"] },
  { slug: "ai-logo-design-tools",           title: "AIロゴ作成ツール おすすめ5選｜無料で本格的なロゴをデザインする方法",       tags: ["AIロゴ", "ロゴ作成", "デザイン"] },
  // 第3弾キーワード
  { slug: "best-ai-pdf-tools-2026",         title: "【2026年】AI PDFツール おすすめ7選｜要約・翻訳・OCRまで一気に効率化",        tags: ["AI PDF", "OCR", "業務効率化"] },
  { slug: "ai-research-automation-guide",   title: "AIリサーチ自動化ガイド｜調査・要約・比較を最短で終わらせる方法",             tags: ["AIリサーチ", "自動化", "情報収集"] },
  { slug: "best-ai-note-taking-apps",       title: "AIノートアプリ比較｜議事録・メモ整理に強いおすすめ6選【2026年版】",          tags: ["AIノート", "メモ", "議事録"] },
  { slug: "ai-resume-coverletter-tools",    title: "履歴書・職務経歴書をAIで作る方法｜転職で使える実践ツール6選",               tags: ["履歴書", "職務経歴書", "AI転職"] },
  { slug: "best-ai-landing-page-builders",  title: "AIランディングページ作成ツール比較｜CVR改善に効くおすすめ5選",             tags: ["LP作成", "CVR", "AIマーケ"] },
  { slug: "ai-youtube-script-tools",        title: "YouTube台本をAIで作る方法｜企画・構成・原稿作成の完全ガイド",               tags: ["YouTube", "台本作成", "動画マーケ"] },
  { slug: "ai-ecommerce-copywriting",       title: "EC商品説明文をAIで量産する方法｜売れるコピー作成テンプレ付き",               tags: ["EC", "商品説明", "コピーライティング"] },
  { slug: "best-ai-prompt-management-tools",title: "プロンプト管理ツールおすすめ5選｜AI活用を再現可能にする運用術",               tags: ["プロンプト", "ナレッジ管理", "AI活用"] },
  { slug: "ai-workflow-automation-no-code", title: "ノーコードで作るAI業務フロー自動化｜Zapier・Make活用ガイド",                tags: ["ノーコード", "Zapier", "業務自動化"] },
  { slug: "ai-customer-review-analysis",    title: "口コミ分析をAIで自動化する方法｜感情分析で改善点を見える化",                 tags: ["口コミ分析", "感情分析", "CX改善"] },
  { slug: "best-ai-calendar-scheduling",    title: "AI日程調整ツール比較｜会議設定を自動化して調整ストレスを減らす",               tags: ["日程調整", "会議", "生産性"] },
  { slug: "ai-podcast-production-tools",    title: "AIポッドキャスト制作ツールおすすめ6選｜台本・編集・配信を効率化",             tags: ["ポッドキャスト", "音声編集", "AI音声"] },
];

// ---------------------------------------------------------------------------
// Hero image generation (OpenAI Images API)
// ---------------------------------------------------------------------------
const ASSETS_IMAGES = path.join(ROOT, "assets", "images");

// ---------------------------------------------------------------------------
// Image prompt diversity: 6 visual styles × title-based visual hints
// ---------------------------------------------------------------------------
const IMAGE_STYLE_TEMPLATES = [
  (topic, el) =>
    `Modern flat illustration, blog hero image, ${el ? "featuring " + el + ", about " + topic : "about " + topic}, ` +
    `clean geometric shapes, blue and purple color palette, professional tech blog, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Isometric 3D illustration, blog thumbnail, ${el ? topic + " with " + el : topic}, ` +
    `vibrant emerald and teal colors, soft shadows, detailed icons, modern tech style, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Abstract gradient mesh background in warm orange and red tones, blog hero image, ` +
    `${el ? "floating " + el + " icons, " : ""}representing ${topic}, ` +
    `dynamic composition, modern design, professional, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Futuristic neon tech illustration, blog header, ${el ? topic + " featuring " + el : topic}, ` +
    `cyan and indigo neon accents, dark background, circuit board patterns, glowing details, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Clean vector illustration on white background, blog header image, ` +
    `${el ? topic + " concept with " + el : topic}, ` +
    `sky blue and amber accent colors, minimal friendly icons, editorial style, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Bold colorful editorial illustration, blog thumbnail, ${el ? topic + " theme with " + el : topic}, ` +
    `vibrant pink and yellow color blocking, modern graphic design, eye-catching composition, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,
];

// Map title keywords to specific visual element hints
const TITLE_VISUAL_HINTS = [
  [/ChatGPT/i,                    "chat interface and conversation bubbles"],
  [/Claude/i,                     "AI assistant interface with clean UI"],
  [/Copilot|Cursor/i,             "code editor with AI autocomplete suggestions"],
  [/プレゼン/,                      "presentation slides and bar charts"],
  [/翻訳/,                         "translation arrows between language speech bubbles"],
  [/コーディング|プログラミング/,        "code blocks and terminal window"],
  [/議事録|会議/,                    "meeting room setup and speech bubbles"],
  [/画像生成/,                      "colorful art canvases and digital paintbrush"],
  [/文章|ライティング/,               "document pages and writing pen"],
  [/動画/,                         "video player timeline and film frames"],
  [/音楽/,                         "music notes and sound waveforms"],
  [/メール/,                        "email envelope and inbox UI"],
  [/データ分析/,                     "charts, graphs, and data visualizations"],
  [/SEO/,                         "search bar, magnifier, and ranking arrows"],
  [/SNS/,                         "social media feed icons and share buttons"],
  [/稼ぐ|副業|収益/,                  "rising profit chart and coin stack"],
];

/** Pick array item deterministically by slug (reproducible per article) */
function pickBySlug(slug, arr) {
  const hash = slug.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return arr[hash % arr.length];
}

/** Build a diverse image prompt for the given keyword */
function buildImagePrompt(keyword) {
  const template = pickBySlug(keyword.slug, IMAGE_STYLE_TEMPLATES);
  let visualElement = null;
  for (const [pattern, hint] of TITLE_VISUAL_HINTS) {
    if (pattern.test(keyword.title)) {
      visualElement = hint;
      break;
    }
  }
  return template(keyword.title, visualElement);
}

async function generateHeroImage(date, keyword) {
  if (!OPENAI_API_KEY) return null;

  ensureDir(ASSETS_IMAGES);
  const filename = `${date}-${keyword.slug}.png`;
  const filepath = path.join(ASSETS_IMAGES, filename);

  if (fs.existsSync(filepath)) {
    console.log(`[skip] image already exists: ${filename}`);
    return `/assets/images/${filename}`;
  }

  const prompt = buildImagePrompt(keyword);
  console.log(`[image] style: template-${pickBySlug(keyword.slug, IMAGE_STYLE_TEMPLATES).name || "?"}`);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "gpt-image-1",
      prompt,
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
// Topic clusters (#5) — ピラー記事とサテライト記事の関係を定義
// ---------------------------------------------------------------------------
const TOPIC_CLUSTERS = {
  "ai-tools": {
    pillar: "ultimate-ai-tools-guide-2026",
    satellites: [
      "chatgpt-vs-claude-comparison", "best-ai-coding-assistants",
      "best-ai-writing-tools", "best-free-ai-image-generators",
      "ai-presentation-tools", "best-ai-translation-tools",
      "best-ai-video-generators",
    ],
  },
  "ai-productivity": {
    pillar: "ai-productivity-complete-guide",
    satellites: [
      "best-ai-meeting-tools-comparison", "ai-email-writing-tools",
      "how-to-automate-sns-with-ai", "best-ai-data-analysis-tools",
    ],
  },
  "ai-business": {
    pillar: "ai-business-monetization-guide",
    satellites: [
      "how-to-make-money-with-ai", "ai-seo-tools-comparison",
      "best-ai-music-generators",
    ],
  },
};

// ---------------------------------------------------------------------------
// Internal link resolution (#6) — [INTERNAL: slug] を実リンクに変換
// ---------------------------------------------------------------------------

/** _posts/ をスキャンして slug → {title, url} のインデックスを構築 */
function buildPostIndex() {
  if (!fs.existsSync(POSTS)) return {};
  const index = {};
  const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const m = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
    if (!m) continue;
    const [, year, month, day, slug] = m;
    const raw = readFile(path.join(POSTS, file)) || "";
    const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    const title = titleMatch ? titleMatch[1] : slug;
    index[slug] = { title, url: `/${year}/${month}/${day}/${slug}/` };
  }
  return index;
}

/** [INTERNAL: slug] を [title](url) に置換 */
function resolveInternalLinks(content, postIndex) {
  return content.replace(/\[INTERNAL:\s*([^\]]+)\]/g, (match, slug) => {
    const post = postIndex[slug.trim()];
    return post ? `[${post.title}](${post.url})` : match;
  });
}

/** クラスター内の関連記事セクションを末尾に追加 */
function buildRelatedSection(keyword, postIndex) {
  const relatedSlugs = [];
  for (const cluster of Object.values(TOPIC_CLUSTERS)) {
    const all = [cluster.pillar, ...cluster.satellites];
    if (all.includes(keyword.slug)) {
      all.filter((s) => s !== keyword.slug && postIndex[s])
        .slice(0, 4)
        .forEach((s) => relatedSlugs.push(s));
      break;
    }
  }
  if (relatedSlugs.length === 0) return "";
  const links = relatedSlugs
    .map((s) => `- [${postIndex[s].title}](${postIndex[s].url})`)
    .join("\n");
  return `\n\n## 関連記事\n\n${links}\n`;
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

  // Resolve [INTERNAL: slug] → actual links, append related posts section
  const postIndex = buildPostIndex();
  content = resolveInternalLinks(content, postIndex);
  content += buildRelatedSection(keyword, postIndex);

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
