#!/usr/bin/env node
/**
 * 記事内の画像パスを relative_url フィルタ形式に変換
 * /assets/images/xxx.png → {{ "/assets/images/xxx.png" | relative_url }}
 */
const fs   = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', '_posts');
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

let totalFixed = 0;
for (const file of files) {
  const fp = path.join(POSTS_DIR, file);
  let content = fs.readFileSync(fp, 'utf8');

  // Replace ![alt](/assets/images/xxx) with ![alt]({{ "/assets/images/xxx" | relative_url }})
  // but skip ones already using relative_url
  const updated = content.replace(
    /!\[([^\]]*)\]\((\/assets\/images\/[^)]+)\)/g,
    (match, alt, src) => {
      if (src.includes('relative_url')) return match;
      return `![${alt}]({{ "${src}" | relative_url }})`;
    }
  );

  if (updated !== content) {
    fs.writeFileSync(fp, updated, 'utf8');
    const count = (updated.match(/\| relative_url/g) || []).length;
    console.log(`Fixed ${file}: ${count} images`);
    totalFixed++;
  }
}
console.log(`\nDone: ${totalFixed} files updated`);
