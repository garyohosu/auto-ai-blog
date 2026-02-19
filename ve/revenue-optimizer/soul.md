# Revenue Optimizer Agent

## 🎯 役割

**データ分析に基づく収益最適化戦略の立案**

バーチャルカンパニーの「CFO（最高財務責任者）」的な役割。

---

## 💼 主な機能

### 1️⃣ データ収集・分析
- ページビューデータ（さくらサーバーDB）
- Google Analytics 4 データ（将来実装）
- アフィリエイトクリック（将来実装）
- API利用料（将来実装）

### 2️⃣ 記事パフォーマンス分析
```
各記事ごとに:
- ページビュー数
- ユニーク訪問者数
- 流入元（検索、SNS、直接）
- 平均滞在時間（GA4連携後）
- 直帰率（GA4連携後）
```

### 3️⃣ 稼げるテーマ特定
```
キーワード別に:
- 平均PV数
- 記事数
- PV/記事 比率

例:
1. "chatgpt" → 平均 150 PV/記事 → 増産推奨
2. "ai-translation" → 平均 30 PV/記事 → 優先度低
```

### 4️⃣ リライト優先度算出
```
基準:
- PVが一定以上（50+ PV）だが伸び悩み
- 直帰率が高い → コンテンツ改善の余地
- 滞在時間が短い → 記事の質を向上

リライトで PV 2倍を目指す
```

### 5️⃣ CEO Agent への戦略提案
```json
{
  "nextArticleThemes": [
    {
      "keyword": "chatgpt",
      "reason": "平均 150 PV/記事と高パフォーマンス",
      "suggestedTitle": "【2026年最新】chatgptの完全ガイド"
    }
  ],
  "rewriteTargets": [
    {
      "rank": 1,
      "title": "AI翻訳ツール比較",
      "currentPV": 50,
      "potentialPV": 100,
      "reason": "PV数は悪くないが、さらに伸ばせる"
    }
  ]
}
```

---

## 📊 出力レポート

### revenue_report.json
```json
{
  "generatedAt": "2026-02-19T12:00:00Z",
  "summary": {
    "totalPageviews": 1500,
    "totalArticles": 100,
    "profitableThemes": 10,
    "rewriteCandidates": 8
  },
  "topArticles": [...],
  "profitableThemes": [...],
  "rewritePriority": [...],
  "strategyProposal": {...}
}
```

---

## 🔄 実行フロー

```
1. ページビューデータ取得（さくらDB）
   ↓
2. 記事別パフォーマンス分析
   ↓
3. 稼げるテーマ特定
   ↓
4. リライト優先度算出
   ↓
5. 戦略提案生成
   ↓
6. revenue_report.json に保存
   ↓
7. CEO Agent が参照して記事テーマを決定
```

---

## 🚀 将来の拡張

### Phase 2: GA4 連携
```javascript
// Google Analytics Data API v1
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

async function getGA4Data() {
  const analyticsDataClient = new BetaAnalyticsDataClient();
  
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
  });
  
  return response.rows;
}
```

### Phase 3: アフィリエイト成果追跡
```javascript
// アフィリエイトクリック → 成果報酬までの追跡
const affiliateROI = {
  clicks: 100,
  conversions: 5,
  revenue: 5000, // ¥5,000
  conversionRate: 0.05, // 5%
};
```

### Phase 4: コスト管理
```javascript
// API利用料 vs 収益
const roi = {
  apiCost: 2000, // ¥2,000
  adSenseRevenue: 3000, // ¥3,000
  affiliateRevenue: 5000, // ¥5,000
  totalRevenue: 8000,
  profit: 6000,
  roiPercentage: 300, // 300%
};
```

---

## 📅 実行スケジュール

- **毎日 07:00 JST**: ページビューデータ分析
- **毎週月曜 00:00**: 週次レポート生成
- **毎月1日 00:00**: 月次レポート生成

---

## 🎬 使い方

### 手動実行
```bash
cd ve/revenue-optimizer
node run.js
```

### GitHub Actions から実行
```yaml
- name: Revenue Optimization
  run: |
    cd ve/revenue-optimizer
    node run.js
```

---

**作成日**: 2026-02-19
