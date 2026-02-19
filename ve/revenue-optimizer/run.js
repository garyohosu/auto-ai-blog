/**
 * Revenue Optimizer Agent
 * 
 * 役割: データ分析に基づく収益最適化戦略の立案
 * 
 * 機能:
 * 1. ページビューデータ × アフィリエイトクリック × AdSense収益を分析
 * 2. 「稼げるキーワード」「稼げる記事構造」を特定
 * 3. CEO Agentに「次に書くべき記事テーマ」を提案
 * 4. 既存記事の「リライト優先度」を算出
 * 5. コスト（API利用料）とROIを追跡
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================================
// 設定
// ============================================================================

const CONTEXT_FILE = path.join(__dirname, '../context.json');
const METRICS_FILE = path.join(__dirname, '../metrics.md');
const OUTPUT_FILE = path.join(__dirname, 'revenue_report.json');
const SOUL_FILE = path.join(__dirname, 'soul.md');

// さくらサーバーのDB API
const DB_API_URL = 'https://www.garyo.sakura.ne.jp/cgi/api/db.cgi';
const DB_NAME = 'auto_ai_blog';

// ============================================================================
// データ取得
// ============================================================================

/**
 * ページビューデータを取得
 */
async function getPageviewData() {
  const postData = JSON.stringify({
    action: 'query',
    database: DB_NAME,
    operation: 'select',
    table: 'pageviews',
    order: 'created_at DESC',
    limit: 1000,
  });
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.garyo.sakura.ne.jp',
      path: '/cgi/api/db.cgi',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      // SSL証明書エラーを無視（さくらサーバーの証明書問題）
      rejectUnauthorized: false,
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            resolve(response.data.rows || []);
          } else {
            console.log('⚠️  ページビューデータ取得失敗:', response);
            resolve([]);
          }
        } catch (error) {
          console.error('❌ JSON Parse Error:', error);
          resolve([]);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ Request Error:', e.message);
      resolve([]);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Google Analytics 4 データを取得（将来実装）
 */
async function getGA4Data() {
  // TODO: Google Analytics Data API v1 を使用
  // - 記事別のPV、UU、平均滞在時間、直帰率
  // - 流入元（検索、SNS、直接）
  // - デバイス別データ
  
  console.log('⚠️  GA4 API連携は未実装（手動でダッシュボード確認）');
  return {
    totalPageviews: 0,
    totalUsers: 0,
    topPages: [],
    trafficSources: [],
  };
}

/**
 * アフィリエイトクリックデータを取得（将来実装）
 */
async function getAffiliateData() {
  // TODO: アフィリエイトクリック追跡テーブルから取得
  // CREATE TABLE affiliate_clicks (
  //   id INTEGER PRIMARY KEY,
  //   article_path TEXT,
  //   affiliate_link TEXT,
  //   clicked_at TIMESTAMP
  // );
  
  console.log('⚠️  アフィリエイトクリック追跡は未実装');
  return [];
}

// ============================================================================
// データ分析
// ============================================================================

/**
 * 記事別のパフォーマンスを分析
 */
function analyzeArticlePerformance(pageviews) {
  const articleStats = {};
  
  pageviews.forEach((view) => {
    const path = view.page_path;
    if (!path || !path.includes('/posts/')) return;
    
    if (!articleStats[path]) {
      articleStats[path] = {
        path,
        title: view.page_title || '',
        pageviews: 0,
        uniqueVisitors: new Set(),
        referrers: {},
      };
    }
    
    articleStats[path].pageviews++;
    articleStats[path].uniqueVisitors.add(view.visitor_id);
    
    const referrer = view.referrer || 'direct';
    articleStats[path].referrers[referrer] = 
      (articleStats[path].referrers[referrer] || 0) + 1;
  });
  
  // 配列に変換してPV順にソート
  const articles = Object.values(articleStats).map((stats) => ({
    ...stats,
    uniqueVisitors: stats.uniqueVisitors.size,
  }));
  
  articles.sort((a, b) => b.pageviews - a.pageviews);
  
  return articles;
}

/**
 * 稼げるテーマ・キーワードを特定
 */
function identifyProfitableThemes(articles) {
  // 記事パスからキーワードを抽出
  const themeStats = {};
  
  articles.forEach((article) => {
    // パスから記事スラッグを抽出（例: /posts/ai-video-tools/ → ai-video-tools）
    const match = article.path.match(/\/posts\/([^/]+)\//);
    if (!match) return;
    
    const slug = match[1];
    const keywords = slug.split('-');
    
    keywords.forEach((keyword) => {
      if (keyword.length < 3) return; // 短すぎるキーワードは除外
      
      if (!themeStats[keyword]) {
        themeStats[keyword] = {
          keyword,
          totalPageviews: 0,
          articleCount: 0,
          avgPageviews: 0,
        };
      }
      
      themeStats[keyword].totalPageviews += article.pageviews;
      themeStats[keyword].articleCount++;
    });
  });
  
  // 平均PVを計算
  Object.values(themeStats).forEach((theme) => {
    theme.avgPageviews = Math.round(theme.totalPageviews / theme.articleCount);
  });
  
  // 平均PV順にソート
  const themes = Object.values(themeStats);
  themes.sort((a, b) => b.avgPageviews - a.avgPageviews);
  
  return themes.slice(0, 10); // TOP 10
}

/**
 * リライト優先度を算出
 */
function calculateRewritePriority(articles) {
  // 基準:
  // 1. PVが一定以上ある（50+ PV）
  // 2. 直帰率が高い（将来実装）
  // 3. 平均滞在時間が短い（将来実装）
  // 4. アフィリエイトクリックが少ない（将来実装）
  
  const rewriteCandidates = articles
    .filter((a) => a.pageviews >= 20 && a.pageviews < 100) // 微妙なPV
    .slice(0, 10);
  
  return rewriteCandidates.map((article, index) => ({
    rank: index + 1,
    path: article.path,
    title: article.title,
    currentPV: article.pageviews,
    potentialPV: Math.round(article.pageviews * 2), // リライトで2倍想定
    reason: 'PV数は悪くないが、さらに伸ばせる可能性がある',
  }));
}

/**
 * CEO Agent への戦略提案を生成
 */
function generateStrategyProposal(profitableThemes, rewritePriority) {
  return {
    nextArticleThemes: profitableThemes.slice(0, 5).map((theme) => ({
      keyword: theme.keyword,
      reason: `平均 ${theme.avgPageviews} PV/記事と高パフォーマンス`,
      suggestedTitle: `【2026年最新】${theme.keyword}の完全ガイド`,
    })),
    rewriteTargets: rewritePriority.slice(0, 3),
    keyInsights: [
      `トップキーワード「${profitableThemes[0]?.keyword}」は平均 ${profitableThemes[0]?.avgPageviews} PV`,
      `リライト候補 ${rewritePriority.length} 記事を特定`,
      'GA4連携後、より精密な分析が可能',
    ],
  };
}

// ============================================================================
// レポート生成
// ============================================================================

/**
 * 収益最適化レポートを生成
 */
async function generateReport() {
  console.log('==========================================');
  console.log('💰 Revenue Optimizer Agent');
  console.log('==========================================');
  console.log('');
  
  // データ収集
  console.log('📊 データ収集中...');
  const pageviews = await getPageviewData();
  const ga4Data = await getGA4Data();
  const affiliateData = await getAffiliateData();
  
  console.log(`   ページビュー: ${pageviews.length}件`);
  console.log('');
  
  // データ分析
  console.log('🔍 データ分析中...');
  const articles = analyzeArticlePerformance(pageviews);
  const profitableThemes = identifyProfitableThemes(articles);
  const rewritePriority = calculateRewritePriority(articles);
  
  console.log(`   分析記事数: ${articles.length}件`);
  console.log(`   稼げるテーマ: ${profitableThemes.length}件`);
  console.log(`   リライト候補: ${rewritePriority.length}件`);
  console.log('');
  
  // 戦略提案
  const strategy = generateStrategyProposal(profitableThemes, rewritePriority);
  
  // レポート生成
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPageviews: pageviews.length,
      totalArticles: articles.length,
      profitableThemes: profitableThemes.length,
      rewriteCandidates: rewritePriority.length,
    },
    topArticles: articles.slice(0, 10),
    profitableThemes,
    rewritePriority,
    strategyProposal: strategy,
  };
  
  // ファイル保存
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  
  console.log('📝 レポート生成完了:');
  console.log(`   ${OUTPUT_FILE}`);
  console.log('');
  
  // 結果表示
  console.log('🎯 戦略提案:');
  console.log('');
  console.log('【次に書くべき記事テーマ】');
  strategy.nextArticleThemes.forEach((theme, i) => {
    console.log(`  ${i + 1}. ${theme.keyword} (${theme.reason})`);
    console.log(`     提案タイトル: ${theme.suggestedTitle}`);
  });
  console.log('');
  
  console.log('【リライト優先度 TOP 3】');
  strategy.rewriteTargets.forEach((target) => {
    console.log(`  ${target.rank}. ${target.title}`);
    console.log(`     現在PV: ${target.currentPV} → 目標PV: ${target.potentialPV}`);
    console.log(`     理由: ${target.reason}`);
  });
  console.log('');
  
  console.log('✅ 完了！');
  
  return report;
}

// ============================================================================
// メイン処理
// ============================================================================

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { generateReport, analyzeArticlePerformance };
