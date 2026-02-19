const fs = require('fs');
const path = require('path');
const runJs = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const match = runJs.match(/const KEYWORD_POOL = \[([\s\S]*?)\];/);
const items = match[1].match(/\{[^}]+\}/g) || [];
const keywords = items.map(item => item.match(/slug:\s*"([^"]+)"/)?.[1]).filter(Boolean);
const posts = fs.readdirSync(path.join(__dirname, '../_posts'))
  .filter(f => f.endsWith('.md'))
  .map(f => { const m = f.match(/\d{4}-\d{2}-\d{2}-(.+)\.md$/); return m ? m[1] : null; })
  .filter(Boolean);
const unused = keywords.filter(k => !posts.includes(k));
console.log('Total keywords in pool:', keywords.length);
console.log('Existing posts:', posts.length);
console.log('Unused keywords:', unused.length);
if (unused.length > 0) console.log('Unused:', unused);
else console.log('⚠️  All keywords used up!');
