#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../..');
const CONTEXT_FILE = path.join(__dirname, '../context.json');
const IMAGES_DIR = path.join(BASE_DIR, 'assets/images');

function log(message) {
  console.log(`[Designer Agent] ${message}`);
}

function ensureDir(dirpath) {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
}

function createMockImage(imagePath) {
  // Minimal 1x1 transparent PNG
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(imagePath, pngData);
  log(`✅ モック画像生成: ${imagePath}`);
}

async function main() {
  const startTime = Date.now();
  log('🎨 Designer Agent 起動（簡易版）');
  
  try {
    const context = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
    const articlePath = context.article_path;
    
    if (!articlePath) throw new Error('article_path not found');
    
    const fullArticlePath = path.join(BASE_DIR, articlePath);
    
    // Image filename
    const filename = articlePath.match(/(\d{4}-\d{2}-\d{2}-.+)\.md$/)[1] + '-hero.png';
    const imagePath = path.join(IMAGES_DIR, filename);
    const relativeImagePath = `/assets/images/${filename}`;
    
    // Create mock image
    ensureDir(IMAGES_DIR);
    createMockImage(imagePath);
    
    // Update front-matter
    let content = fs.readFileSync(fullArticlePath, 'utf8');
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontMatterRegex);
    
    if (match) {
      let frontMatter = match[1];
      if (/^image:/m.test(frontMatter)) {
        frontMatter = frontMatter.replace(/^image:.*$/m, `image: "${relativeImagePath}"`);
      } else {
        frontMatter = frontMatter.replace(/^(tags: \[.*?\])$/m, `$1\nimage: "${relativeImagePath}"`);
      }
      content = content.replace(frontMatterRegex, `---\n${frontMatter}\n---\n`);
      fs.writeFileSync(fullArticlePath, content, 'utf8');
      log('✅ Front-matter 更新完了');
    }
    
    // Update context
    context.image_path = relativeImagePath;
    context.current_phase = 'linker';
    if (!context.completed_agents) context.completed_agents = [];
    context.completed_agents.push({
      agent: 'designer',
      timestamp: new Date().toISOString(),
      duration: (Date.now() - startTime) / 1000,
      success: false,
      mock: true
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
