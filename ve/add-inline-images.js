#!/usr/bin/env node
/**
 * 既存記事へのインライン画像一括追加スクリプト
 * - 既存の全記事をスキャン
 * - インライン画像が少ない記事に [IMAGE: ...] マーカーを挿入
 * - gpt-image-1 で画像生成してマーカーを置換
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const BASE_DIR       = path.join(__dirname, '..');
const POSTS_DIR      = path.join(BASE_DIR, '_posts');
const IMAGES_DIR     = path.join(BASE_DIR, 'assets/images');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MIN_IMAGES     = 3; // 本文内の目標画像枚数

function log(msg) { console.log(`[inline-images] ${msg}`); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ---------------------------------------------------------------------------
// OpenAI Images API
// ---------------------------------------------------------------------------
function callImagesAPI(prompt, filepath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1536x1024' });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data[0] && json.data[0].b64_json) {
            fs.writeFileSync(filepath, Buffer.from(json.data[0].b64_json, 'base64'));
            resolve(true);
          } else {
            reject(new Error(data.slice(0, 300)));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 記事の本文からインライン画像数をカウント（ヒーロー画像除く）
// ---------------------------------------------------------------------------
function countBodyImages(body) {
  return (body.match(/!\[.*?\]\(.*?\)/g) || []).length;
}

// ---------------------------------------------------------------------------
// front-matter を除いた本文を取得
// ---------------------------------------------------------------------------
function extractBody(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
}

// ---------------------------------------------------------------------------
// 記事の ## 見出し一覧を取得
// ---------------------------------------------------------------------------
function getH2Headings(body) {
  const results = [];
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) && !/^###/.test(lines[i])) {
      results.push({ index: i, text: lines[i].replace(/^##\s+/, '') });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// マーカー挿入: セクション間に IMAGE マーカーを挿入
// ---------------------------------------------------------------------------
function insertMarkers(content, slug, headings) {
  const lines = content.split('\n');
  const markers = [];

  // 挿入する見出しのインデックスを選ぶ（均等に4〜5箇所）
  const total = headings.length;
  const insertAt = new Set();

  // 1. 最初の ## の後（導入の後）
  if (total > 0) insertAt.add(headings[0].index);

  // 2. 中間の見出し群から均等選択
  const step = Math.max(1, Math.floor(total / 3));
  for (let i = step; i < total - 1; i += step) insertAt.add(headings[i].index);

  // 3. 最後から2番目（FAQやまとめの前）
  if (total > 2) insertAt.add(headings[total - 2].index);
  if (total > 1) insertAt.add(headings[total - 1].index);

  // 挿入位置をソート（後ろから挿入するとインデックスがずれないため逆順）
  const sortedPositions = [...insertAt].sort((a, b) => b - a);

  // 挿入する説明を見出しテキストから生成
  for (const pos of sortedPositions) {
    const heading = headings.find(h => h.index === pos);
    if (!heading) continue;

    const description = buildImageDescription(heading.text, slug);
    const marker = `\n[IMAGE: ${description}]\n`;
    lines.splice(pos, 0, marker);
    markers.push(description);
  }

  return { content: lines.join('\n'), markers };
}

// ---------------------------------------------------------------------------
// 見出しテキストからプロンプト説明を生成
// ---------------------------------------------------------------------------
function buildImageDescription(headingText, slug) {
  // 日本語の見出しを元に英語説明を生成するシンプルなマッピング
  const topic = slug.replace(/-/g, ' ').replace(/\d{4} \d{2} \d{2} /, '');

  const h = headingText;
  if (/比較|vs|versus/i.test(h))
    return `Comparison chart showing ${topic} tools side by side with feature matrix`;
  if (/手順|ステップ|方法|使い方|始め/i.test(h))
    return `Step-by-step workflow diagram illustrating how to use ${topic}`;
  if (/メリット|メリット|効果|理由|なぜ/i.test(h))
    return `Infographic showing key benefits and advantages of ${topic}`;
  if (/選び方|選定|おすすめ|ランキング/i.test(h))
    return `Decision tree or guide diagram for choosing the best ${topic} solution`;
  if (/料金|コスト|価格|費用/i.test(h))
    return `Pricing comparison table visualization for ${topic} services`;
  if (/FAQ|よくある|質問/i.test(h))
    return `FAQ illustration showing common questions about ${topic} with answer bubbles`;
  if (/まとめ|結論|次|アクション/i.test(h))
    return `Summary infographic of key takeaways and next steps for ${topic}`;
  if (/機能|特徴|できること/i.test(h))
    return `Feature overview illustration showing capabilities of ${topic}`;
  if (/活用|ユースケース|事例/i.test(h))
    return `Use case diagram showing real-world applications of ${topic}`;

  // デフォルト
  return `Professional illustration for blog section about ${headingText.slice(0, 40)} related to ${topic}`;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function main() {
  ensureDir(IMAGES_DIR);

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  log(`📚 ${files.length}記事を処理します`);

  let updated = 0;
  let skipped = 0;
  let totalImages = 0;

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const slug     = file.replace(/\.md$/, '');
    let   content  = fs.readFileSync(filePath, 'utf8');
    const body     = extractBody(content);

    const existingImages = countBodyImages(body);
    if (existingImages >= MIN_IMAGES) {
      log(`⏭ スキップ (既存${existingImages}枚): ${file}`);
      skipped++;
      continue;
    }

    log(`\n📝 処理中 (既存${existingImages}枚): ${file}`);

    const headings = getH2Headings(body);
    if (headings.length < 2) {
      log(`  ⚠️ 見出しが少なすぎるためスキップ`);
      skipped++;
      continue;
    }

    // マーカー挿入
    const frontMatter = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)[0];
    const bodyWithMarkers = insertMarkers(body, slug, headings);
    content = frontMatter + bodyWithMarkers.content;

    // 画像生成とマーカー置換
    const markerRegex = /^\[IMAGE:\s*([^\]]+)\]\s*$/gm;
    const allMarkers  = [...content.matchAll(markerRegex)];
    let imgCount = 1;

    for (const [fullMatch, description] of allMarkers) {
      const filename     = `${slug}-${imgCount}.png`;
      const imagePath    = path.join(IMAGES_DIR, filename);
      const relativePath = `/assets/images/${filename}`;

      if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100) {
        log(`  ⏭ 画像${imgCount} 既存: ${filename}`);
      } else if (OPENAI_API_KEY) {
        const prompt =
          `Professional blog illustration: ${description}. ` +
          `Clean modern design for Japanese tech blog, informative, visually clear, ` +
          `no text, no letters, 16:9 aspect ratio, high quality`;
        log(`  🎨 画像${imgCount} 生成中: ${description.slice(0, 60)}...`);
        try {
          await callImagesAPI(prompt, imagePath);
          log(`  ✅ 画像${imgCount}: ${filename} (${fs.statSync(imagePath).size} bytes)`);
        } catch (err) {
          log(`  ❌ 画像${imgCount} 失敗: ${err.message}`);
          imgCount++;
          continue;
        }
      } else {
        log(`  ⚠️ OPENAI_API_KEY 未設定 → スキップ`);
        imgCount++;
        continue;
      }

      content = content.replace(
        new RegExp(fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `\n![${description}](${relativePath})\n`
      );
      totalImages++;
      imgCount++;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    log(`  ✅ 更新完了: ${file} (画像${imgCount - 1}枚追加)`);
    updated++;
  }

  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`完了: ${updated}記事更新, ${skipped}記事スキップ, 合計${totalImages}枚生成`);
}

main().catch(err => {
  console.error(`[inline-images] ❌ ${err.message}`);
  process.exit(1);
});
