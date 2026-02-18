#!/usr/bin/env node
/**
 * Designer Agent - Hero Image Generation
 * OpenAI Images API (gpt-image-1, 1536x1024) で Hero 画像を生成する。
 * API キーがない場合はモック画像(1x1 PNG)にフォールバック。
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR    = path.join(__dirname, '../..');
const CONTEXT_FILE = path.join(__dirname, '../context.json');
const IMAGES_DIR  = path.join(BASE_DIR, 'assets/images');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function log(msg) { console.log(`[Designer Agent] ${msg}`); }

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ---------------------------------------------------------------------------
// Image prompt diversity (6 styles × title visual hints) — from ve/run.js
// ---------------------------------------------------------------------------
const IMAGE_STYLE_TEMPLATES = [
  (topic, el) =>
    `Modern flat illustration, blog hero image, ${el ? 'featuring ' + el + ', about ' + topic : 'about ' + topic}, ` +
    `clean geometric shapes, blue and purple color palette, professional tech blog, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Isometric 3D illustration, blog thumbnail, ${el ? topic + ' with ' + el : topic}, ` +
    `vibrant emerald and teal colors, soft shadows, detailed icons, modern tech style, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Abstract gradient mesh background in warm orange and red tones, blog hero image, ` +
    `${el ? 'floating ' + el + ' icons, ' : ''}representing ${topic}, ` +
    `dynamic composition, modern design, professional, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Futuristic neon tech illustration, blog header, ${el ? topic + ' featuring ' + el : topic}, ` +
    `cyan and indigo neon accents, dark background, circuit board patterns, glowing details, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Clean vector illustration on white background, blog header image, ` +
    `${el ? topic + ' concept with ' + el : topic}, ` +
    `sky blue and amber accent colors, minimal friendly icons, editorial style, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Bold colorful editorial illustration, blog thumbnail, ${el ? topic + ' theme with ' + el : topic}, ` +
    `vibrant pink and yellow color blocking, modern graphic design, eye-catching composition, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,
];

const TITLE_VISUAL_HINTS = [
  [/ChatGPT/i,              'chat interface and conversation bubbles'],
  [/Claude/i,               'AI assistant interface with clean UI'],
  [/Copilot|Cursor/i,       'code editor with AI autocomplete suggestions'],
  [/プレゼン/,               'presentation slides and bar charts'],
  [/翻訳/,                  'translation arrows between language speech bubbles'],
  [/コーディング|プログラミング/, 'code blocks and terminal window'],
  [/議事録|会議/,            'meeting room setup and speech bubbles'],
  [/画像生成/,               'colorful art canvases and digital paintbrush'],
  [/文章|ライティング/,       'document pages and writing pen'],
  [/動画/,                  'video player timeline and film frames'],
  [/音楽/,                  'music notes and sound waveforms'],
  [/メール/,                 'email envelope and inbox UI'],
  [/データ分析/,              'charts, graphs, and data visualizations'],
  [/SEO/,                   'search bar, magnifier, and ranking arrows'],
  [/SNS/,                   'social media feed icons and share buttons'],
  [/稼ぐ|副業|収益/,          'rising profit chart and coin stack'],
  [/チャットボット|chatbot/i, 'chatbot dialog window and robot icon'],
  [/カスタマー|サポート/,      'headset and customer service desk'],
];

function pickBySlug(slug, arr) {
  const hash = slug.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return arr[hash % arr.length];
}

function buildImagePrompt(keyword) {
  const template = pickBySlug(keyword.slug, IMAGE_STYLE_TEMPLATES);
  let visualElement = null;
  for (const [pattern, hint] of TITLE_VISUAL_HINTS) {
    if (pattern.test(keyword.title)) { visualElement = hint; break; }
  }
  return template(keyword.title, visualElement);
}

// ---------------------------------------------------------------------------
// OpenAI Images API 呼び出し
// ---------------------------------------------------------------------------
function callImagesAPI(prompt, filepath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1536x1024',
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data[0] && json.data[0].b64_json) {
              const buffer = Buffer.from(json.data[0].b64_json, 'base64');
              fs.writeFileSync(filepath, buffer);
              resolve(true);
            } else {
              reject(new Error(`Images API error: ${data.slice(0, 300)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// フォールバック: 1x1 透明 PNG（モック）
// ---------------------------------------------------------------------------
function createMockImage(imagePath) {
  const pngData = Buffer.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
    0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
    0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,
    0x89,0x00,0x00,0x00,0x0a,0x49,0x44,0x41,
    0x54,0x78,0x9c,0x63,0x00,0x01,0x00,0x00,
    0x05,0x00,0x01,0x0d,0x0a,0x2d,0xb4,0x00,
    0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,
    0x42,0x60,0x82,
  ]);
  fs.writeFileSync(imagePath, pngData);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  log('🎨 Designer Agent 起動');

  try {
    const context = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
    const articlePath = context.article_path;
    if (!articlePath) throw new Error('article_path not found in context.json');

    const keyword = context.selected_keyword;
    const fullArticlePath = path.join(BASE_DIR, articlePath);

    // 画像ファイル名: YYYY-MM-DD-slug-hero.png
    const filename = articlePath.match(/(\d{4}-\d{2}-\d{2}-.+)\.md$/)[1] + '-hero.png';
    const imagePath = path.join(IMAGES_DIR, filename);
    const relativeImagePath = `/assets/images/${filename}`;

    ensureDir(IMAGES_DIR);

    // 既存画像はスキップ
    if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100) {
      log(`⏭ 既存画像を使用: ${filename}`);
    } else if (OPENAI_API_KEY) {
      const prompt = buildImagePrompt(keyword);
      log(`🖼 画像プロンプト: ${prompt.slice(0, 80)}...`);
      log('📡 OpenAI Images API 呼び出し中 (gpt-image-1, 1536x1024)...');
      try {
        await callImagesAPI(prompt, imagePath);
        log(`✅ 実画像生成完了: ${filename} (${fs.statSync(imagePath).size} bytes)`);
      } catch (err) {
        log(`⚠️ Images API エラー: ${err.message}`);
        log('📌 モック画像にフォールバック');
        createMockImage(imagePath);
      }
    } else {
      log('⚠️ OPENAI_API_KEY 未設定 → モック画像を使用');
      createMockImage(imagePath);
    }

    // ---------------------------------------------------------------------------
    // 記事内 [IMAGE: ...] マーカーを検出して画像生成・置換
    // ---------------------------------------------------------------------------
    let content = fs.readFileSync(fullArticlePath, 'utf8');
    const imageMarkerRegex = /^\[IMAGE:\s*([^\]]+)\]\s*$/gm;
    const markers = [...content.matchAll(imageMarkerRegex)];

    if (markers.length > 0) {
      log(`🖼 インライン画像マーカー ${markers.length} 件検出`);
      const slugBase = articlePath.match(/(\d{4}-\d{2}-\d{2}-.+)\.md$/)[1];

      for (let i = 0; i < markers.length; i++) {
        const [fullMatch, description] = markers[i];
        const idx = i + 1;
        const inlineFilename = `${slugBase}-${idx}.png`;
        const inlineImagePath = path.join(IMAGES_DIR, inlineFilename);
        const relativeInlinePath = `/assets/images/${inlineFilename}`;

        if (fs.existsSync(inlineImagePath) && fs.statSync(inlineImagePath).size > 100) {
          log(`⏭ インライン画像${idx} 既存スキップ: ${inlineFilename}`);
        } else if (OPENAI_API_KEY) {
          const inlinePrompt =
            `Professional blog illustration for a tech article: ${description}. ` +
            `Clean modern design, suitable for Japanese tech blog, informative and visually clear, ` +
            `no text, no letters, 16:9 aspect ratio, high quality`;
          log(`📡 インライン画像${idx} 生成中: ${description.slice(0, 60)}...`);
          try {
            await callImagesAPI(inlinePrompt, inlineImagePath);
            log(`✅ インライン画像${idx} 完了: ${inlineFilename} (${fs.statSync(inlineImagePath).size} bytes)`);
          } catch (err) {
            log(`⚠️ インライン画像${idx} 生成失敗: ${err.message} → スキップ`);
            continue;
          }
        } else {
          log(`⚠️ OPENAI_API_KEY 未設定 → インライン画像${idx} スキップ`);
          continue;
        }

        // マーカーを Markdown 画像記法に置換
        content = content.replace(
          fullMatch.trim(),
          `\n![${description}]({{ "${relativeInlinePath}" | relative_url }})\n`
        );
        log(`✅ マーカー → ![...]({{ "${relativeInlinePath}" | relative_url }}) に置換`);
      }

      fs.writeFileSync(fullArticlePath, content, 'utf8');
      log('✅ 記事内画像の置換完了');
    } else {
      log('ℹ️ インライン画像マーカーなし');
    }

    // front-matter に image: を追加・更新
    content = fs.readFileSync(fullArticlePath, 'utf8');
    const fmRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(fmRegex);
    if (match) {
      let fm = match[1];
      if (/^image:/m.test(fm)) {
        fm = fm.replace(/^image:.*$/m, `image: "${relativeImagePath}"`);
      } else {
        fm = fm.replace(/^(tags:.*)/m, `$1\nimage: "${relativeImagePath}"`);
      }
      content = content.replace(fmRegex, `---\n${fm}\n---\n`);
      fs.writeFileSync(fullArticlePath, content, 'utf8');
      log('✅ front-matter image: 更新完了');
    }

    // context.json 更新
    context.image_path = relativeImagePath;
    context.phase = 'linker';
    if (!context.agents_completed) context.agents_completed = [];
    context.agents_completed.push({
      agent: 'designer',
      timestamp: new Date().toISOString(),
      duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(2)),
      real_image: OPENAI_API_KEY ? true : false,
    });
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), 'utf8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ Designer Agent 完了 (${duration}秒)`);
    log(`画像: ${relativeImagePath}`);
    process.exit(0);

  } catch (err) {
    log(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

main();
