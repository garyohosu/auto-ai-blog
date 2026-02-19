const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Twitter/X 自動投稿システム
 * 
 * 機能:
 * 1. 最新記事を検出
 * 2. 魅力的なツイート文を生成
 * 3. OGP画像とともにTwitterに投稿
 * 4. ハッシュタグ自動生成
 */

// ============================================================================
// 設定
// ============================================================================

// Twitter API v2 認証情報（環境変数から取得）
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET || '';

// サイト設定
const SITE_URL = 'https://garyohosu.github.io/auto-ai-blog';
const POSTS_DIR = path.join(__dirname, '../_posts');
const CONTEXT_FILE = path.join(__dirname, 'context.json');

// ============================================================================
// ツイート文生成
// ============================================================================

/**
 * 記事タイトルから魅力的なツイート文を生成
 */
function generateTweetText(article) {
  const { title, tags, slug } = article;
  
  // ハッシュタグ生成（最大3つ）
  const hashtags = tags
    .slice(0, 3)
    .map(tag => `#${tag.replace(/\s+/g, '')}`)
    .join(' ');
  
  // ツイート本文
  const text = `🤖 ${title}\n\n${hashtags}\n\n${SITE_URL}/posts/${slug}/`;
  
  // Twitter の文字数制限（280文字）チェック
  if (text.length > 280) {
    const shortTitle = title.substring(0, 100) + '...';
    return `🤖 ${shortTitle}\n\n${hashtags}\n\n${SITE_URL}/posts/${slug}/`;
  }
  
  return text;
}

/**
 * 時間帯に応じた定型文を追加
 */
function addGreeting(text) {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return `おはようございます☀️\n\n${text}`;
  } else if (hour >= 12 && hour < 18) {
    return `こんにちは🌤\n\n${text}`;
  } else {
    return `こんばんは🌙\n\n${text}`;
  }
}

// ============================================================================
// Twitter API 呼び出し
// ============================================================================

/**
 * Twitter API v2 でツイート投稿
 */
async function postTweet(text) {
  // 認証情報チェック
  if (!TWITTER_BEARER_TOKEN || !TWITTER_ACCESS_TOKEN) {
    console.log('⚠️  Twitter API 認証情報が設定されていません');
    console.log('   環境変数 TWITTER_BEARER_TOKEN, TWITTER_ACCESS_TOKEN を設定してください');
    return { success: false, error: 'No credentials' };
  }
  
  // OAuth 1.0a 署名生成（簡易版）
  // 本番環境では twitter-api-v2 などのライブラリ使用を推奨
  const oauth = {
    consumer_key: TWITTER_API_KEY,
    consumer_secret: TWITTER_API_SECRET,
    token: TWITTER_ACCESS_TOKEN,
    token_secret: TWITTER_ACCESS_SECRET,
  };
  
  // Twitter API v2 エンドポイント
  const options = {
    hostname: 'api.twitter.com',
    path: '/2/tweets',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  
  const postData = JSON.stringify({ text });
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          const response = JSON.parse(data);
          console.log('✅ ツイート投稿成功!');
          console.log(`   Tweet ID: ${response.data.id}`);
          resolve({ success: true, data: response.data });
        } else {
          console.log(`❌ ツイート投稿失敗: ${res.statusCode}`);
          console.log(`   Response: ${data}`);
          resolve({ success: false, error: data });
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`❌ エラー: ${e.message}`);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// メイン処理
// ============================================================================

async function main() {
  console.log('==========================================');
  console.log('🐦 Twitter/X 自動投稿システム');
  console.log('==========================================');
  console.log('');
  
  // context.json から最新記事情報を取得
  let context;
  try {
    const contextData = fs.readFileSync(CONTEXT_FILE, 'utf-8');
    context = JSON.parse(contextData);
  } catch (error) {
    console.log('⚠️  context.json が見つかりません');
    process.exit(1);
  }
  
  // 最新記事の取得
  const latestArticle = context.articles?.[0];
  if (!latestArticle) {
    console.log('⚠️  投稿する記事がありません');
    process.exit(0);
  }
  
  console.log('📝 最新記事:');
  console.log(`   タイトル: ${latestArticle.title}`);
  console.log(`   スラッグ: ${latestArticle.slug}`);
  console.log(`   タグ: ${latestArticle.tags?.join(', ')}`);
  console.log('');
  
  // ツイート文生成
  let tweetText = generateTweetText(latestArticle);
  tweetText = addGreeting(tweetText);
  
  console.log('📤 投稿内容:');
  console.log('---');
  console.log(tweetText);
  console.log('---');
  console.log(`文字数: ${tweetText.length}/280`);
  console.log('');
  
  // Twitter に投稿
  const result = await postTweet(tweetText);
  
  if (result.success) {
    console.log('');
    console.log('✅ 投稿完了！');
    console.log(`   URL: https://twitter.com/i/web/status/${result.data.id}`);
  } else {
    console.log('');
    console.log('⚠️  投稿に失敗しました');
    console.log('   手動で投稿してください:');
    console.log(`   ${SITE_URL}/posts/${latestArticle.slug}/`);
  }
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateTweetText, postTweet };
