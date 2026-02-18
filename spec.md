# auto-ai-blog（Claude Code）設計書 / Spec.md
Version: 2.0
Repo: https://github.com/garyohosu/auto-ai-blog

## 1. 目的
GitHub Pages（Jekyll）で動くブログを、**マルチエージェントシステム（OpenClaw + multi-agent-shogun 方式）**で運用し、日次で自律的に記事を生成・公開する。

- 状態（state / context / memory）を Markdown/JSON で保存して"自走"させる
- **8つの専門エージェント**が協調してタスクを実行
- 収益導線（AdSense + Affiliate）に寄せた evergreen コンテンツを積み上げる
- AdSense client: ca-pub-6743751614716161
- 日本語 + 英語市場を同時に狙える設計
- 将来的に自作 AI ツール販売へ接続できる構造

## 2. 前提（入力条件）
- 現状 PV: 44、記事数: 110（既存記事は原則触らない）
- 収益: Google AdSense Auto Ads + アフィリエイト導入済み
- ジャンル変更: OK / 海外: OK / SNS自動連携: 将来対応
- 新規記事: 追加して伸ばす（既存は据え置き）
- 運用: 可能な限り自動化（ただし破壊的変更は禁止）

## 3. マルチエージェントアーキテクチャ（新設計）

### 3.1 実行フロー
```
GitHub Actions (cron) 
  ↓
ve/orchestrator.js (制御)
  ↓
┌──────────────────────────────────────┐
│ 1. CEO Agent (戦略策定)              │
│    → ve/context.json 更新            │
├──────────────────────────────────────┤
│ 2. SEO Agent (キーワード選定)         │
│    → context.json に選定KW記録       │
├──────────────────────────────────────┤
│ 3. Writer Agent (記事生成)           │
│    → _posts/*.md 作成                │
├──────────────────────────────────────┤
│ 4. Designer Agent (画像生成)         │
│    → assets/images/*.png 作成        │
├──────────────────────────────────────┤
│ 5. Linker Agent (内部リンク)         │
│    → 記事に関連リンク追加             │
├──────────────────────────────────────┤
│ 6. Editor Agent (品質チェック)        │
│    → 承認/却下判定                   │
├──────────────────────────────────────┤
│ 7. Analyst Agent (メトリクス記録)     │
│    → ve/metrics.md 更新              │
└──────────────────────────────────────┘
  ↓
Git Commit & Push
```

### 3.2 エージェント間通信
各エージェントは以下のファイルを介して情報をやり取りする：

#### 共有コンテキスト
- **`ve/context.json`**: 実行コンテキスト（日付、戦略、選定KW、記事パスなど）
- **`ve/user.md`**: ユーザー情報（共通参照）

#### エージェント固有ファイル（各 `ve/{agent}/` 配下）
- **`soul.md`**: エージェントの性格・判断基準（固定）
- **`memory.md`**: 長期記憶（自動更新）
- **`input.md`**: 前段エージェントからの入力
- **`output.md`**: 次段エージェントへの出力
- **`run.js`**: 実行ロジック

### 3.3 日次トリガー
- GitHub Actions の schedule で毎日実行
- **平日**: 07:00 JST & 20:00 JST (2回/日)
- **週末**: 10:00, 15:00, 21:00 JST (3回/日)
- **合計**: 週16回 ≈ 月65記事

cron設定:
```yaml
schedule:
  # 平日 07:00 JST (22:00 UTC 前日)
  - cron: '0 22 * * 0-4'
  # 平日 20:00 JST (11:00 UTC)
  - cron: '0 11 * * 1-5'
  # 週末 10:00 JST (01:00 UTC)
  - cron: '0 1 * * 0,6'
  # 週末 15:00 JST (06:00 UTC)
  - cron: '0 6 * * 0,6'
  # 週末 21:00 JST (12:00 UTC)
  - cron: '0 12 * * 0,6'
```

## 4. リポジトリ構成（v2.0）
```
.
├── _posts/                     # Jekyll の記事
├── assets/images/              # ヒーロー画像
├── ve/
│   ├── orchestrator.js         # エージェント実行制御（新）
│   ├── context.json            # 実行コンテキスト（新）
│   ├── user.md                 # ユーザー情報（新）
│   ├── run.js                  # 旧スクリプト（後方互換）
│   ├── state.md                # 旧状態管理
│   ├── todo.md
│   ├── metrics.md
│   ├── logs/
│   └── agents/                 # エージェントディレクトリ（新）
│       ├── ceo/
│       │   ├── soul.md
│       │   ├── memory.md
│       │   ├── input.md
│       │   ├── output.md
│       │   └── run.js
│       ├── seo/
│       ├── writer/
│       ├── designer/
│       ├── linker/
│       ├── editor/
│       ├── analyst/
│       └── marketer/
├── _config.yml
└── .github/workflows/
    └── daily.yml
```

## 5. 各エージェントの役割詳細

### 5.1 CEO Agent（戦略策定）
**役割**: ブログ全体の戦略決定
**入力**: 
- `ve/metrics.md` (過去のPV・収益データ)
- `ceo/memory.md` (過去の戦略履歴)
**処理**:
1. 各トピッククラスター（ai-tools, ai-productivity, ai-business）のPV分析
2. 最もパフォーマンスの高いクラスターを選定
3. 今日注力すべきクラスターを決定
**出力**:
- `ceo/output.md`: 戦略指示
- `context.json`: `ceo_strategy` フィールド更新

### 5.2 SEO Agent（キーワード選定）
**役割**: CEO戦略に基づくキーワード選定
**入力**:
- `context.json` (CEO戦略)
- `ve/run.js` (KEYWORD_POOL)
- `_posts/` (既存記事リスト)
**処理**:
1. CEO指定クラスターに属する未使用キーワードを抽出
2. 競合分析（文字数・検索意図）
3. 推奨文字数・構成を決定
**出力**:
- `seo/output.md`: 選定キーワード詳細
- `context.json`: `selected_keyword` フィールド更新

### 5.3 Writer Agent（記事生成）
**役割**: SEO選定キーワードで記事作成
**入力**:
- `context.json` (選定キーワード)
- `writer/soul.md` (執筆ルール)
**処理**:
1. OpenAI API (gpt-5.2) で記事本文生成
2. 4000字以上の Evergreen コンテンツ
3. 比較表・FAQ・CTAを含める
**出力**:
- `_posts/YYYY-MM-DD-{slug}.md`: 記事ファイル
- `context.json`: `article_path` フィールド更新

### 5.4 Designer Agent（画像生成）
**役割**: ヒーロー画像生成
**入力**:
- `context.json` (記事タイトル)
**処理**:
1. OpenAI Images API (gpt-image-1) で画像生成
2. 6つのスタイルテンプレートからランダム選択
3. サイズ: 1536x1024 (16:9)
**出力**:
- `assets/images/YYYY-MM-DD-{slug}.png`
- 記事の front matter に `image:` 追加
- `context.json`: `image_path` フィールド更新

### 5.5 Linker Agent（内部リンク解決）
**役割**: 内部リンク自動生成
**入力**:
- `context.json` (記事パス)
- `_posts/` (全記事インデックス)
- `ve/run.js` (TOPIC_CLUSTERS)
**処理**:
1. `[INTERNAL: slug]` を実リンクに変換
2. クラスター内の関連記事セクションを追加
**出力**:
- 記事ファイル更新（内部リンク挿入）

### 5.6 Editor Agent（品質チェック）
**役割**: 記事の最終承認
**入力**:
- `context.json` (記事パス)
- `editor/soul.md` (品質基準)
**処理**:
1. 文字数チェック (>3000字)
2. 比較表・FAQ の有無確認
3. スパム的なキーワード詰め込みがないか
**出力**:
- `editor/output.md`: 承認/却下判定
- 却下の場合は処理を中断

### 5.7 Analyst Agent（メトリクス記録）
**役割**: 実行結果の記録
**入力**:
- `context.json` (実行結果)
**処理**:
1. `ve/metrics.md` に新規行追加
2. `ve/logs/YYYY-MM-DD.md` に実行サマリー記録
**出力**:
- `ve/metrics.md` 更新
- `ve/logs/YYYY-MM-DD.md` 作成

### 5.8 Marketer Agent（将来実装）
**役割**: SNS投稿準備
**入力**:
- `context.json` (記事情報)
**処理**:
1. X (Twitter) / note.com 投稿文案作成
2. RSS/IFTTTトリガー準備
**出力**:
- `marketer/output.md`: 投稿文案
- ※自動投稿は未実装（手動承認必須）

## 6. GitHub Actions（daily.yml v2.0）
```yaml
name: Daily Virtual Employee Run

on:
  schedule:
    # 平日 07:00 JST (22:00 UTC 前日)
    - cron: '0 22 * * 0-4'
    # 平日 20:00 JST (11:00 UTC)
    - cron: '0 11 * * 1-5'
    # 週末 10:00 JST (01:00 UTC)
    - cron: '0 1 * * 0,6'
    # 週末 15:00 JST (06:00 UTC)
    - cron: '0 6 * * 0,6'
    # 週末 21:00 JST (12:00 UTC)
    - cron: '0 12 * * 0,6'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  daily-run:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Orchestrator (AI Virtual Employees)
        env:
          TZ: 'Asia/Tokyo'
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: node ve/orchestrator.js

      - name: Commit and push changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "ve: daily run $(date +'%Y-%m-%d %H:%M:%S JST')"
            git push
          fi
```

## 7. context.json スキーマ
```json
{
  "date": "YYYY-MM-DD",
  "timestamp": "ISO8601",
  "phase": "ceo | seo | writer | designer | linker | editor | analyst | done",
  "ceo_strategy": "ai-productivity",
  "selected_keyword": {
    "slug": "ai-email-writing-tools",
    "title": "記事タイトル",
    "tags": ["tag1", "tag2"]
  },
  "article_path": "_posts/YYYY-MM-DD-slug.md",
  "image_path": "/assets/images/YYYY-MM-DD-slug.png",
  "status": "running | completed | failed",
  "agents_completed": [
    { "agent": "ceo", "timestamp": "ISO8601", "duration": 1.23 }
  ]
}
```

## 8. コンテンツ品質ルール（継続）
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

## 9. セーフティ（絶対守る）
- 既存 110 記事は原則「改変しない」
- 削除・大規模リライト・設定変更など破壊的変更は禁止（人間承認が必要）
- 変更したら必ずログに「差分の要約」を書く
- 不確実なときは「安全な代替案」を提案し、最も安全な高レバレッジを選ぶ

## 10. 収益予測（v2.0）
| 期間 | 記事数 | 月間PV | AdSense収益 | API費用 | 純利益 |
|------|--------|--------|------------|---------|--------|
| 現在 | 110 | 500 | ¥150 | ¥0 | ¥150 |
| 1ヶ月後 | 175 | 18,000 | ¥5,400 | ¥1,625 | ¥3,775 |
| 3ヶ月後 | 305 | 60,000 | ¥18,000 | ¥1,625 | ¥16,375 |
| 6ヶ月後 | 500 | 150,000 | ¥45,000 | ¥1,625 | ¥43,375 |

---

## 付録A: Orchestrator 実行コマンド
```bash
# ローカルテスト
cd /path/to/auto-ai-blog
node ve/orchestrator.js

# GitHub Actions 手動トリガー
gh workflow run daily.yml
```

## 付録B: トラブルシューティング
### Q: エージェントが失敗した場合
A: `ve/logs/YYYY-MM-DD.md` と `context.json` の `failed_at` を確認。該当エージェントの `run.js` をデバッグ。

### Q: 画像生成に失敗する
A: `OPENAI_API_KEY` が設定されているか確認。設定されていない場合は画像なしで記事公開（非ブロッキング）。

### Q: 記事が重複生成される
A: SEO Agent が `_posts/` をスキャンして既存スラッグを除外。`ve/run.js` の `KEYWORD_POOL` を確認。

---

## 11. 実装状況と動作確認

### 11.1 現在の実装状況(2026-02-18)

| エージェント | soul.md | memory.md | input.md | output.md | run.js | ステータス |
|------------|---------|-----------|----------|-----------|--------|----------|
| CEO | ✅ | ✅ | ✅ | ✅ | ✅ | **完成** |
| SEO | ✅ | ✅ | ✅ | ✅ | ✅ | **完成** |
| Writer | ✅ | ❌ | ❌ | ❌ | ❌ | 部分実装 |
| Designer | ❌ | ❌ | ❌ | ❌ | ❌ | 未実装 |
| Linker | ❌ | ❌ | ❌ | ❌ | ❌ | 未実装 |
| Editor | ❌ | ❌ | ❌ | ❌ | ❌ | 未実装 |
| Analyst | ❌ | ❌ | ❌ | ❌ | ❌ | 未実装 |
| Marketer | ❌ | ❌ | ❌ | ❌ | ❌ | 未実装 |

**コア実装**:
- ✅ `ve/orchestrator.js`: エージェント実行制御
- ✅ `ve/context.json`: 実行コンテキスト管理
- ✅ `ve/user.md`: ユーザー情報
- ⚠️ `.github/workflows/daily.yml`: 未実装(手動実行のみ)

### 11.2 段階的動作確認プラン

#### フェーズ1: CEO + SEO パイプライン検証(完了予定: 2026-02-18)
**目標**: CEO → SEO の2エージェントが正常に連携することを確認。

**実行コマンド**:
```bash
cd /path/to/auto-ai-blog
node ve/orchestrator.js
```

**検証項目**:
1. Orchestrator が `context.json` を初期化
2. CEO Agent が戦略を決定し `ceo/output.md` に記録
3. SEO Agent が CEO 戦略に基づきキーワード選定
4. `context.json` に `ceo_strategy` と `selected_keyword` が記録される
5. Writer 未実装のため `phase: "writer"` で停止

**期待出力**:
```json
{
  "date": "2026-02-18",
  "phase": "writer",
  "ceo_strategy": "ai-productivity",
  "selected_keyword": {
    "slug": "ai-email-writing-tools",
    "title": "AIメール作成ツール比較 | 2026年最新版"
  },
  "status": "partial",
  "agents_completed": [
    {"agent": "ceo", "duration": 1.2},
    {"agent": "seo", "duration": 0.8}
  ]
}
```

#### フェーズ2: Writer Agent 実装(予定: 2026-02-19)
- `ve/writer/run.js` 作成
- OpenAI API 統合(gpt-5.2)
- 4000字以上の Evergreen 記事生成
- `_posts/YYYY-MM-DD-slug.md` 出力

#### フェーズ3: Designer, Editor, Analyst 実装(予定: 2026-02-21)
- Designer: hero image 自動生成
- Editor: 品質チェック(文字数・構成・スパム検知)
- Analyst: メトリクス記録

#### フェーズ4: GitHub Actions 統合(予定: 2026-02-24)
- `.github/workflows/daily.yml` 作成
- 平日2回・週末3回の自動実行
- OPENAI_API_KEY の Secrets 設定

### 11.3 既知の制約事項

**技術的制約**:
- OpenAI API コスト: 月間約 ¥1,625(記事生成 + 画像生成)
- GitHub Actions 実行時間: 無料枠 2,000分/月(現在の設定で週16回 × 5分 = 80分)
- 既存110記事は原則編集禁止(安全性重視)

**現在の制限**:
- SNS 自動投稿: 未実装(手動承認必須)
- Writer 以降のエージェント: 未実装(順次追加予定)
- API エラー時のリトライ: 未実装

### 11.4 デバッグコマンド

```bash
# 実行ログ確認
cat ve/logs/$(date +%Y-%m-%d).md

# context.json 確認
cat ve/context.json | jq .

# 各エージェントの出力確認
cat ve/ceo/output.md
cat ve/seo/output.md

# エラー時のロールバック
git reset --hard HEAD~1
```

---

**変更履歴**:
- v1.0: 初版(単一スクリプト方式)
- v1.2: アイキャッチ画像生成追加
- v2.0: マルチエージェントアーキテクチャ導入(OpenClaw + multi-agent-shogun 方式)
- v2.1: 実装状況と動作確認プラン追記(2026-02-18)
