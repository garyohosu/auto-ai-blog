# auto-ai-blog（Claude Code）設計書 / Spec.md
Version: 1.2
Repo: https://github.com/garyohosu/auto-ai-blog

## 1. 目的
GitHub Pages（Jekyll）で動くブログを、Claude Code による「バーチャル社員（自律ループ）」で運用し、日次（JST 00:00）で次を継続する。

- 状態（state / todo / metrics / logs）を Markdown で保存して“自走”させる
- 毎回「今日の最重要タスク 1つ」を選定 → 実行（安全範囲）→ 記録
- 収益導線（AdSense + Affiliate）に寄せた evergreen コンテンツを積み上げる
- AdSense client: ca-pub-6743751614716161
- 日本語 + 英語市場を同時に狙える設計にする
- 将来的に自作 AI ツール販売へ接続できる構造を作る

## 2. 前提（入力条件）
- 現状 PV: 44、記事数: 100（既存記事は原則触らない）
- 収益: Google AdSense + アフィリエイト導入済み
- ジャンル変更: OK / 海外: OK / SNS自動連携: OK
- 新規記事: 追加して伸ばす（既存は据え置き）
- 運用: 可能な限り自動化（ただし破壊的変更は禁止）

## 3. 自動運転アーキテクチャ
### 3.1 日次トリガー
- GitHub Actions の schedule で毎日実行
- JST 00:00 を狙う（cron は UTC 基準）
  - JST 00:00 = UTC 15:00
  - cron: `0 15 * * *`

### 3.2 実行の起点（ランナー）
- `ve/run.js`（Node）を起点とする
  - 将来、Python へ置換/併用してもよい
- Actions から `node ve/run.js` を実行し、差分をコミットして push する

## 4. リポジトリ構成（推奨）
```
.
├── _posts/                     # Jekyll の記事（新規はここに追加）
├── ve/                         # バーチャル社員の状態管理（長期記憶）
│   ├── state.md
│   ├── todo.md
│   ├── metrics.md
│   ├── run.js                  # 日次実行の起点
│   ├── logs/
│   └── templates/
├── _config.yml                 # Jekyll設定（最小）
└── .github/workflows/
    ├── daily.yml               # 日次実行（JST 0時）
    └── (optional) agentic/*.md # gh-aw を使う場合
```

## 5. GitHub Pages（Jekyll）
### 5.1 _config.yml（最小例）
```yml
title: auto-ai-blog
theme: minima
plugins:
  - jekyll-feed
```

### 5.2 Pages 設定（手動）
- Settings → Pages
- Source: Deploy from a branch
- Branch: main / folder: /(root)

## 6. GitHub Actions（daily.yml）
### 6.1 方針
- 「毎日回って、成果物がコミットされる」ことを最優先
- cron は UTC、ログ表示は `TZ: Asia/Tokyo` を使って JST 寄せ

### 6.2 .github/workflows/daily.yml（テンプレ）
```yml
name: Daily Virtual Employee Run

on:
  workflow_dispatch:
  schedule:
    - cron: "0 15 * * *" # UTC 15:00 = JST 00:00

permissions:
  contents: write

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run virtual employee
        env:
          TZ: Asia/Tokyo
          # 例：外部LLMを呼ぶ場合（使うときだけ）
          # ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          node ve/run.js

      - name: Commit & Push changes
        run: |
          git config user.name "virtual-employee-bot"
          git config user.email "virtual-employee-bot@users.noreply.github.com"
          git add -A
          git diff --cached --quiet || git commit -m "ve: daily run $(date -u +%F)"
          git push
```

## 7. バーチャル社員の「契約ファイル」仕様（必須）
### 7.1 ve/state.md（状態）
- phase: 現在のフェーズ
  - `bootstrap` / `keyword-discovery` / `publishing` / `scaling` / `product`
- today_objective: 今日の目的（1行）
- focus_cluster: 注力クラスター（例: ai-meeting-minutes-tools）
- blockers: ブロッカー（なければ `-`）
- next_run: 次回やること（1行、明確に）

初期例:
```md
# state
- phase: bootstrap
- today_objective: initialize system
- focus_cluster: -
- blockers: -
- next_run: generate first keyword list (JP/EN)
```

### 7.2 ve/todo.md（タスク）
- Backlog: 優先度順
- Today: 主タスク 1つ + 小タスク最大 2つ
- Done: 追記式（消さない）

初期例:
```md
# todo

## Backlog (prioritized)
- Generate 50 buyer-intent keywords (JP + EN)
- Create first topic cluster plan
- Publish 1 monetized evergreen post
- Prepare X posting queue (optional)

## Today
- (empty)

## Done (append-only)
- Repo created
```

### 7.3 ve/logs/YYYY-MM-DD.md（日次ログ）
必須項目:
- 何をしたか（作成/変更したファイル、差分の要約）
- 何を考えてそうしたか（判断理由）
- 観測メトリクス（取れないものは `-`）
- 次にやること

### 7.4 ve/metrics.md（メトリクス）
- 毎日 1 行追記（取れない値は `-`）
- 将来は GSC / GA / 収益 を手入力 or API 連携で埋める

例:
```md
| date | new_posts | total_posts | gsc_clicks | gsc_impr | avg_pos | ga_users | revenue |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-02-18 | 1 | 101 | - | - | - | - | - |
```

## 8. Claude Code 実行ループ（毎回）
### 8.1 入力として読むもの
- `ve/state.md`
- `ve/todo.md`
- `ve/metrics.md`
- 直近 7 日分の `ve/logs/`
- `_posts/` の構造（既存100記事は原則改変しない）

### 8.2 1回の実行で必ずやること
1) コンテキスト読込（state/todo/logs）
2) 今日の主タスク 1つを選定（重複回避）
3) 実行前に計画を `ve/todo.md` と `ve/state.md` に記入
4) 実行（安全な範囲でファイル生成/更新）
   - 記事生成時は **アイキャッチ画像も必ず生成**（後述 §8.4）
5) `ve/logs/YYYY-MM-DD.md` に全記録
6) `ve/metrics.md` に当日行を追記
7) `ve/state.md` に next_run を明記して終了

### 8.4 アイキャッチ画像（ヒーロー画像）生成ルール
- 記事を新規作成するたびに、対応する画像を **必ず** 生成する
- 保存先: `assets/images/YYYY-MM-DD-{slug}.png`
- front matter に `image: /assets/images/YYYY-MM-DD-{slug}.png` を追加
- 生成モデル: `gpt-image-1`（OpenAI Images API）
- サイズ: `1536x1024`（16:9 近似）
- プロンプトテンプレート（{TITLE} を記事タイトルで置換）:
  ```
  Modern flat illustration, blog hero image, about "{TITLE}",
  futuristic AI workspace, holographic interface, laptop, glowing elements,
  clean composition, professional, vibrant colors,
  no text, no letters,
  16:9 aspect ratio, high quality, sharp, tech style
  ```
- 画像生成に失敗した場合は `image:` なしで記事を作成して続行（ノンブロッキング）
- `_layouts/post.html` が `page.image` を参照して記事冒頭に自動表示する

### 8.3 タスク優先順位（デフォルト）
1. buyer-intent 記事（比較/導入/手順/ベスト○○）を 1 本作る
2. トピッククラスター設計（関連記事候補 + 内部リンク計画）
3. 配信自動化（X の投稿キュー作成、RSS/テンプレ）
4. テクニカルSEO（sitemap/robots/canonical 等）※安全が明確なときだけ

## 9. コンテンツ品質ルール
- ニュース羅列は禁止（短命・競合強すぎ）
- evergreen（悩み解決 / 比較 / 実装手順）を優先
- 収益の"置き場所"を必ず作る
  - アフィリエイト: `[AFF_LINK: product_name]`
  - 内部リンク: `[INTERNAL: related_post_slug]`
- 記事には最低限これを含める
  - **アイキャッチ画像**（front matter `image:` + `assets/images/` への PNG）
  - 導入（誰の何の悩みか）
  - 手順/比較（具体）
  - FAQ（検索意図の拾い）
  - 次アクション（CTA）

## 10. セーフティ（絶対守る）
- 既存 100 記事は原則「改変しない」
- 削除・大規模リライト・設定変更など破壊的変更は禁止（人間承認が必要）
- 変更したら必ずログに「差分の要約」を書く
- 不確実なときは「安全な代替案」を提案し、最も安全な高レバレッジを選ぶ

## 11. GitHub Agentic Workflows（gh-aw）統合（任意）
参考: https://note.com/hantani/n/nf0e360c6126b

### 11.1 目的
- “Markdown でワークフロー定義 → lock.yml へコンパイル”の運用を取り入れ、
  日次の手順をより宣言的に管理できるようにする。

### 11.2 想定運用
- `.github/workflows/*.md` に agentic workflow を置く
- `gh aw compile` で `.lock.yml` を生成して実行する（運用に合わせる）

### 11.3 注意点（安全）
- strict mode では `contents: write` が禁止される場合がある
  - その場合は、gh-aw の safe-outputs（issue / PR / comment）を使い、
    “直接 push”ではなく“PR 作成”に切り替える。
- 本プロジェクトはまず「通常の Actions + run.js で push」を主軸にし、
  必要になったら gh-aw を段階的に導入する（トラブル回避）。

## 12. 初期化（最初の1回で作るもの）
- ディレクトリ:
  - `_posts/`
  - `assets/images/`
  - `ve/`
  - `ve/logs/`
  - `ve/templates/`
- ファイル:
  - `ve/state.md`（bootstrap）
  - `ve/todo.md`
  - `ve/metrics.md`
  - `.github/workflows/daily.yml`
  - `_config.yml`
  - `_layouts/post.html`（ヒーロー画像表示用カスタムレイアウト）
  - `ve/run.js`（最小動作：日次ログと記事雛形を作る）

## 13. ve/run.js（最小仕様）
### 13.1 最低限の挙動
- `ve/logs/YYYY-MM-DD.md` を作成（なければ）
- `_posts/YYYY-MM-DD-daily-note.md` を作成（なければ）
- 以降、LLM 連携（キーワード選定→記事生成→画像生成）に拡張可能な構造にする

### 13.2 出力の要件
- "必ず何かが増える"こと（毎日コミットされる）
- 生成物の内容は最初は薄くてもよい（まずは自動運転の安定化）

### 13.3 画像生成の実装方針
- `OPENAI_API_KEY` が設定されているときのみ画像生成を試みる
- 生成失敗はログに記録し、記事作成は続行（画像なしでも公開する）
- 既に画像ファイルが存在する場合はスキップ（冪等性を保つ）
- `assets/images/` ディレクトリを `main()` 内で `ensureDir` する
- GitHub Actions の secrets に `OPENAI_API_KEY` を登録すること

---

## 付録A: Claude Code に渡すベース指示（コピペ用）
You are the autonomous virtual employee of the repository "auto-ai-blog".
Run once per day. Read ve/state.md, ve/todo.md, ve/metrics.md, and the latest 7 ve/logs/.
Pick exactly ONE highest-leverage task. Write the plan into ve/todo.md and ve/state.md before executing.
Execute only safe changes (prefer adding new posts and logs). Never delete or rewrite the existing 100 posts without explicit approval.
Record everything into ve/logs/YYYY-MM-DD.md and append a row to ve/metrics.md (use '-' if unknown).
End by updating ve/state.md with a clear next_run directive. Never repeat the same task unless marked as retry.
