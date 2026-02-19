# Marketer Agent - Implementation Guide

## 概要
Moltbook (AI-only SNS) でブログを宣伝するMarketer Agentの実装ガイド。

## エージェント情報
- **名前**: Alex Chen
- **役割**: Digital Marketing Specialist
- **社員ID**: VE-008
- **プラットフォーム**: [Moltbook](https://moltbook.com)

## フェーズ1: 環境準備 (Week 1)

### 1.1 アカウント作成
```bash
# OpenClawアカウント作成
1. https://openclaw.com にアクセス
2. Sign up for OpenClaw
3. API keyを取得

# Moltbookアカウント作成
1. OpenClawダッシュボードからMoltbookを選択
2. Agent profileを作成:
   - Name: Alex Chen
   - Bio: Digital Marketer at Virtual AI Company
   - Avatar: プロフェッショナルな画像
3. Agent IDを控える
```

### 1.2 GitHub Secrets設定
```bash
# Repository > Settings > Secrets and variables > Actions
# 以下を追加:
OPENCLAW_API_KEY=your_openclaw_api_key
MOLTBOOK_AGENT_ID=your_agent_id
```

### 1.3 投稿スケジュール設定
```yaml
# .github/workflows/marketer.yml に追加
name: Marketer Agent
on:
  schedule:
    - cron: '0 23 * * *'  # 08:00 JST (前日23:00 UTC)
    - cron: '0 4 * * *'   # 13:00 JST (04:00 UTC)
    - cron: '0 11 * * *'  # 20:00 JST (11:00 UTC)
  workflow_dispatch:

jobs:
  run-marketer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run Marketer Agent
        env:
          OPENCLAW_API_KEY: ${{ secrets.OPENCLAW_API_KEY }}
          MOLTBOOK_AGENT_ID: ${{ secrets.MOLTBOOK_AGENT_ID }}
        run: node ve/marketer/run.js
```

## フェーズ2: コンテンツ戦略 (Week 2)

### 2.1 投稿タイプ分類
| タイプ | 割合 | 目的 | 例 |
|--------|------|------|-----|
| 記事シェア | 40% | トラフィック獲得 | 「AI副業完全ガイド公開」 |
| ディスカッション | 30% | エンゲージメント | 「AI自動化で最も難しいのは?」 |
| コミュニティ参加 | 20% | 関係構築 | 他エージェントの投稿にコメント |
| トレンド分析 | 10% | 専門性アピール | 「2026年AI SNSトレンド」 |

### 2.2 投稿頻度
- **毎日3回**: 08:00, 13:00, 20:00 JST
- **週21投稿**: 記事シェア8, ディスカッション6, 参加4, 分析3
- **月間90投稿**: 目標Karma 100+ (1投稿あたり平均1.1+)

### 2.3 初週の投稿プラン
```markdown
Day 1 (自己紹介)
08:00 - 自己紹介投稿
13:00 - コミュニティ参加
20:00 - 記事シェア

Day 2 (関係構築)
08:00 - トレンド分析
13:00 - ディスカッション開始
20:00 - コミュニティ貢献

Day 3 (実験報告)
08:00 - 実験レポート
13:00 - Q&A
20:00 - 週次まとめ

Day 4-7 (通常運用)
- 記事シェア (毎日1本)
- ディスカッション (2日に1本)
- コミュニティ参加 (毎日)
```

## フェーズ3: 効果測定 (Week 3-)

### 3.1 KPI設定
```javascript
// 短期目標 (1ヶ月)
const shortTermKPI = {
  karma: 100,           // Moltbook Karma
  posts: 30,            // 投稿数
  traffic: 1000,        // 流入PV
  replyRate: 0.20       // 返信率20%
};

// 中期目標 (3ヶ月)
const mediumTermKPI = {
  karma: 500,
  traffic: 8000,
  followers: 50
};

// 長期目標 (6ヶ月)
const longTermKPI = {
  traffic: 25000,
  brandMentions: 100
};
```

### 3.2 GA4トラッキング
```javascript
// Moltbook経由のトラフィック計測
// UTMパラメータ付きURL使用
const trackingUrl = `https://garyohosu.github.io/auto-ai-blog/posts/ai-side-hustle-complete-guide/?utm_source=moltbook&utm_medium=agent_post&utm_campaign=alex_chen`;
```

### 3.3 Analystエージェント連携
```bash
# 週次レポート生成
node ve/analyst/run.js --report=marketer --period=weekly

# 出力内容:
# - Moltbook投稿数
# - Karma推移
# - 流入PV
# - エンゲージメント率
# - 人気投稿TOP5
```

## リスク管理

### スパム判定回避
- **価値提供比率**: 宣伝20% : 有益情報80%
- **返信率重視**: 他エージェントとの対話
- **バラエティ**: 同じリンクを連続投稿しない

### 倫理的配慮
- **透明性**: プロフィールに「Virtual Company Marketer」明記
- **コミュニティ貢献**: 宣伝だけでなく議論参加
- **スパム回避**: 自然な投稿ペース維持

### セキュリティ
- **API Key管理**: GitHub Secretsで厳密管理
- **アクセス制限**: 最小権限の原則
- **監視**: Moltbookのポリシー変更を追跡

## Next Steps

### Week 1
- [ ] OpenClawアカウント作成
- [ ] Moltbookエージェント設定
- [ ] GitHub Secrets追加
- [ ] 初週の投稿下書き作成

### Week 2
- [ ] 初投稿 (自己紹介)
- [ ] コミュニティ参加開始
- [ ] 最初の記事シェア
- [ ] 反応を分析

### Week 3
- [ ] 通常運用開始 (3投稿/日)
- [ ] GA4データ確認
- [ ] Analystレポート生成
- [ ] PDCA実施

### Week 4
- [ ] コンテンツ最適化
- [ ] エンゲージメント向上施策
- [ ] noteに活動報告記事執筆
- [ ] 次月の戦略策定

## 関連ドキュメント
- [SOUL.md](./soul.md) - Marketer Agentの人格定義
- [TRAFFIC_STRATEGY_2026.md](../../TRAFFIC_STRATEGY_2026.md) - 全体トラフィック戦略
- [PROFIT_OPTIMIZATION_STRATEGY.md](../../PROFIT_OPTIMIZATION_STRATEGY.md) - 収益最適化

## 参考リンク
- [Moltbook公式](https://moltbook.com)
- [OpenClaw](https://openclaw.com)
- [Moltbook紹介記事](https://www.therobotreport.com/moltbook-is-a-reddit-like-social-network-for-ai-agents/)

---
最終更新: 2026-02-19
作成者: hantani (garyohosu)
