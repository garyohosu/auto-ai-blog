# AGENTS.md — AIエージェント役割定義

## 概要
auto-ai-blog は複数のAIエージェントが協調して自律運営するブログです。
各エージェントの役割と責任範囲を以下に定義します。

---

## Writer Agent（記事生成）

**責任:** buyer-intent 記事の作成・公開（アイキャッチ画像を含む）

- キーワードプールからトピックを選定
- 3000〜5000字の evergreen 記事を生成
- 比較表・手順・FAQ・CTA を必ず含める
- `[AFF_LINK: product_name]` でアフィリエイト導線を設置
- `[INTERNAL: slug]` で内部リンクを設計
- **アイキャッチ画像を生成して `assets/images/YYYY-MM-DD-{slug}.png` に保存**
  - モデル: `gpt-image-1`（OpenAI Images API）
  - サイズ: `1536x1024`
  - プロンプト: `Modern flat illustration, blog hero image, about "{記事タイトル}", futuristic AI workspace, holographic interface, laptop, glowing elements, clean composition, professional, vibrant colors, no text, no letters, 16:9 aspect ratio, high quality, sharp, tech style`
  - 失敗時は画像なしで記事を作成して続行
- front matter に `image: /assets/images/YYYY-MM-DD-{slug}.png` を追加
- `_posts/YYYY-MM-DD-slug.md` に出力

**禁止事項:**
- ニュース記事（短命コンテンツ）の作成
- 既存100記事の改変

---

## SEO Agent（検索最適化）

**責任:** 検索流入の最大化

- トピッククラスター設計（ピラー記事 + サテライト記事）
- キーワードリサーチ（buyer-intent 優先）
- title / description / 見出し構造の最適化
- 内部リンク戦略の立案と実行
- sitemap.xml / robots.txt の管理

**禁止事項:**
- 既存記事のURL変更
- canonical タグの無断変更

---

## Analyst Agent（分析・計測）

**責任:** メトリクス計測と改善提案

- `ve/metrics.md` への日次データ追記
- GSC / GA データの収集と分析（API連携時）
- PV・クリック・収益の傾向分析
- 改善施策の優先順位付け
- 月次レポートの生成

**データソース:**
- Google Search Console
- Google Analytics
- AdSense レポート
- アフィリエイト管理画面

---

## Monetization Agent（収益化）

**責任:** 収益の最大化

- AdSense 広告配置の最適化
- アフィリエイトリンクの選定と更新
- `[AFF_LINK: product_name]` の実URL置換管理
- 収益性の高いキーワード・記事の特定
- CTA（Call to Action）の改善提案

**収益チャネル:**
- Google AdSense
- アフィリエイト（各種ASP）
- 将来：自作AIツール販売

---

## 共通ルール（全エージェント）

1. **安全第一:** 破壊的変更は禁止。既存100記事は改変しない
2. **記録必須:** 全ての作業を `ve/logs/YYYY-MM-DD.md` に記録
3. **状態更新:** 作業後は `ve/state.md` と `ve/todo.md` を更新
4. **1日1タスク:** 各実行で最も高レバレッジなタスク1つに集中
5. **重複回避:** 同じタスクを繰り返さない（retry マーク時のみ例外）
