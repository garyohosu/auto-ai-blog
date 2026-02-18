# AGENTS.md — AI仮想社員 役割定義

## 組織構造

```
ve/
├── ceo/          # CEO（戦略・意思決定）
├── writer/       # ライター（記事生成）
├── designer/     # デザイナー（画像生成）
├── seo/          # SEO担当（検索最適化）
├── linker/       # リンカー（内部リンク・クラスター）
├── marketer/     # マーケター（SNS・拡散）
├── analyst/      # アナリスト（データ分析）
└── editor/       # 編集長（品質管理）
```

---

## 🎩 CEO Agent

**責任:** 全体戦略・意思決定
- 月次目標の設定（PV・収益）
- トピック戦略・クラスター優先順位の決定
- `ve/ceo/strategy.md` / `ve/ceo/roadmap.md` を管理

---

## ✍️ Writer Agent（記事生成）

**責任:** buyer-intent 記事の作成・公開（アイキャッチ画像を含む）

- キーワードプールからトピックを選定
- 3000〜5000字の evergreen 記事を生成（ピラー記事は5000〜8000字）
- 比較表・手順・FAQ・CTA を必ず含める
- `[AFF_LINK: product_name]` でアフィリエイト導線を設置
- `[INTERNAL: slug]` で内部リンクを設計（Linker Agentが自動解決）
- **アイキャッチ画像を生成して `assets/images/YYYY-MM-DD-{slug}.png` に保存**
  - モデル: `gpt-image-1`（OpenAI Images API）
  - サイズ: `1536x1024`
  - スタイル: slug ハッシュで6パターンを自動選択
  - タイトルキーワードから視覚ヒントを自動抽出
- `_posts/YYYY-MM-DD-slug.md` に出力（front matter に `image:` 含む）
- 投稿頻度: 平日2記事/日（JST 7:00 + 20:00）、週末3記事/日

**禁止事項:**
- ニュース記事（短命コンテンツ）の作成
- 既存記事の改変

---

## 🎨 Designer Agent（画像生成）

**責任:** 視覚的魅力の向上
- ヒーロー画像生成（Writer Agentに統合済み、`ve/run.js`）
- カラーパレット管理（6スタイル × タイトルヒント）
- `assets/images/` を管理

---

## 🔍 SEO Agent（検索最適化）

**責任:** 検索流入の最大化
- トピッククラスター設計（`ve/linker/clusters.md`）
- キーワードリサーチ（buyer-intent 優先）
- title / description / 見出し構造の最適化
- sitemap / robots / canonical の管理
- `ve/seo/checklist.md` に従ってチェック

**禁止事項:**
- 既存記事のURL変更
- canonical タグの無断変更

---

## 🔗 Linker Agent（内部リンク）

**責任:** 内部リンク構造・トピッククラスター管理
- `TOPIC_CLUSTERS` 定義（`ve/run.js`）の維持・拡張
- `[INTERNAL: slug]` → 実リンク自動解決（記事生成時に実行）
- 記事末尾に `## 関連記事` セクションを自動追加
- `ve/linker/clusters.md` を最新状態に保つ

**ルール:**
- 1記事あたり最大5内部リンク（スパム回避）
- アンカーテキストは記事タイトルをそのまま使用

---

## 📢 Marketer Agent（拡散）

**責任:** トラフィック獲得
- SNS自動投稿（X/Twitter、note等）
- 拡散戦略・トレンド分析
- `ve/marketer/` でキュー管理（実装予定）

---

## 📊 Analyst Agent（分析）

**責任:** メトリクス計測と改善提案
- `ve/metrics.md` への日次データ追記
- GSC / GA データの収集と分析（API連携時）
- PV・クリック・収益の傾向分析
- `ve/analyst/` でレポート管理（実装予定）

---

## 📝 Editor Agent（品質管理）

**責任:** 記事品質の維持
- `ve/editor/guidelines.md` に基づく品質チェック
- evergreen 基準の確認
- 公開前の最終確認

---

## 共通ルール（全エージェント）

1. **安全第一:** 破壊的変更は禁止。既存記事は改変しない
2. **記録必須:** 全ての作業を `ve/logs/YYYY-MM-DD.md` に記録
3. **状態更新:** 作業後は `ve/state.md` と `ve/todo.md` を更新
4. **1日1タスク:** 各実行で最も高レバレッジなタスク1つに集中
5. **重複回避:** 同じタスクを繰り返さない（retry マーク時のみ例外）
