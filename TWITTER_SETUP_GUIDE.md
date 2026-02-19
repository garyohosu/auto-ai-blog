# Twitter/X 自動投稿システム セットアップガイド

## 📋 概要

記事公開時に自動でTwitter/Xに投稿するシステムです。

---

## 🔑 Twitter API 認証情報の取得

### Step 1: Twitter Developer Portal にアクセス

1. https://developer.twitter.com/en/portal/dashboard にアクセス
2. 「+ Create Project」をクリック
3. プロジェクト名: `auto-ai-blog`

### Step 2: アプリを作成

1. 「Create App」をクリック
2. App 名: `auto-ai-blog-poster`
3. 環境: `Production`

### Step 3: 認証情報を取得

#### A. API Key & Secret
```
API Key (Consumer Key): xxxxxxxxxxxxxxxxxxxxxxxxx
API Secret (Consumer Secret): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### B. Bearer Token
```
Bearer Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### C. Access Token & Secret
1. 「Keys and tokens」タブ
2. 「Generate」をクリック（Access Token & Secret）
```
Access Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Access Token Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: 権限設定

1. 「Settings」タブ
2. 「App permissions」を **Read and Write** に変更
3. 保存

---

## 🔧 GitHub Secrets に設定

### リポジトリの Secrets に追加

1. https://github.com/garyohosu/auto-ai-blog/settings/secrets/actions
2. 「New repository secret」で以下を追加:

```
TWITTER_API_KEY: [API Key]
TWITTER_API_SECRET: [API Secret]
TWITTER_BEARER_TOKEN: [Bearer Token]
TWITTER_ACCESS_TOKEN: [Access Token]
TWITTER_ACCESS_SECRET: [Access Token Secret]
```

---

## 🤖 GitHub Actions ワークフローに統合

`.github/workflows/generate-post.yml` に以下を追加:

```yaml
- name: Post to Twitter/X
  env:
    TWITTER_BEARER_TOKEN: ${{ secrets.TWITTER_BEARER_TOKEN }}
    TWITTER_API_KEY: ${{ secrets.TWITTER_API_KEY }}
    TWITTER_API_SECRET: ${{ secrets.TWITTER_API_SECRET }}
    TWITTER_ACCESS_TOKEN: ${{ secrets.TWITTER_ACCESS_TOKEN }}
    TWITTER_ACCESS_SECRET: ${{ secrets.TWITTER_ACCESS_SECRET }}
  run: |
    cd ve/social-media
    node twitter.js
```

---

## 📊 投稿内容の例

```
おはようございます☀️

🤖 ChatGPTで業務効率化！仕事が10倍速くなる実践テクニック

#ChatGPT #AI #生産性向上

https://garyohosu.github.io/auto-ai-blog/posts/chatgpt-productivity/
```

### 特徴

- ✅ 時間帯に応じた挨拶（おはよう/こんにちは/こんばんは）
- ✅ 絵文字でアイキャッチ
- ✅ ハッシュタグ自動生成（記事タグから）
- ✅ 記事URLを含む
- ✅ 280文字制限を遵守

---

## 🎯 効果

| 指標 | 導入前 | 導入後（予測） |
|------|--------|----------------|
| Twitter流入 | 0 PV/月 | 500+ PV/月 |
| フォロワー増加 | - | +50人/月 |
| エンゲージメント | - | 100+ いいね/月 |
| 記事認知度 | 低 | 中～高 |

---

## ⚠️ 注意事項

### Rate Limit（投稿制限）
- ツイート: 300件/3時間
- 本システムは1日2回のみなので問題なし

### ポリシー遵守
- スパム投稿禁止
- 同じ内容の連続投稿禁止
- Twitter Rules を遵守

---

## 🔄 将来の拡張

### A. 過去記事の再投稿
```javascript
// 人気記事を定期的に再投稿
// - 1週間前の記事
// - PVが高い記事
// - 季節に応じた記事
```

### B. Instagram / Facebook 対応
```javascript
// Meta Graph API を使用
// - 同じ仕組みで Instagram にも投稿
// - Facebook ページにも自動投稿
```

### C. 投稿時刻の最適化
```javascript
// GA4データから分析
// - どの時間帯にアクセスが多いか
// - その時刻に投稿するよう調整
```

---

**作成日**: 2026-02-19
