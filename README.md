# auto-ai-blog

AI副業ブログの完全自動運営システム。
ローカルPCのCLIツール（Claude Code / Gemini CLI / Codex CLI）から定額で動かせます。

## 公開サイト

- **ブログ**: https://garyohosu.github.io/auto-ai-blog/
- **GitHub**: https://github.com/garyohosu/auto-ai-blog

---

## ローカル実行（メインの使い方）

### 必要なもの

| ツール | 用途 | 入手先 |
|-------|------|--------|
| **Node.js** v18以上 | オーケストレーター実行 | https://nodejs.org |
| **Git** | commit / push | https://git-scm.com |
| **gh CLI** | GitHub操作（Issue作成等） | https://cli.github.com |
| **claude CLI** | 記事テキスト生成（優先） | `npm install -g @anthropic-ai/claude-code` |
| **gemini CLI** | 記事テキスト生成（次点） | `npm install -g @google/gemini-cli` |

> CLIツールはいずれか1つあれば動きます。両方なければテンプレート記事が生成されます。

### 環境変数（オプション）

```bash
# Gemini で画像生成する場合（無料枠: 1500回/日）
export GOOGLE_API_KEY="AIza..."

# OpenAI で画像生成する場合（フォールバック）
export OPENAI_API_KEY="sk-..."
```

> **テキスト生成**は claude / gemini CLI が定額サブスクリプション内で動くため API キー不要。
> **画像生成**も `GOOGLE_API_KEY` を設定すれば Gemini の無料枠で動きます。
> どちらも未設定の場合は 1×1 のプレースホルダー画像が使われます。

### 実行手順

```bash
# リポジトリをクローン済みの場合
cd C:/PROJECT/auto-ai-blog

# 通常実行（記事生成 → git push → Jekyll 自動デプロイ）
bash run-local.sh

# 動作確認用（git push を行わないドライラン）
bash run-local.sh --no-push
```

実行後、GitHub Actions の `jekyll-pages.yml` が push をトリガーに自動でデプロイします。

---

## Codex CLI からのキック

Codex CLI（OpenClaw）から以下のように指示することで自動実行できます。

```
bash run-local.sh
```

または Codex に「ブログ生成スクリプトを実行して」と伝えると `run-local.sh` を呼び出します。

---

## LLM 優先順位

### テキスト生成（記事本文）

```
1. claude --print   ← Claude Code CLI（月額定額）
2. gemini           ← Gemini CLI（無料）
3. OpenAI API       ← OPENAI_API_KEY があれば（従量課金・フォールバック）
4. テンプレート記事  ← すべて失敗した場合
```

### 画像生成（ヒーロー画像・記事内画像）

```
1. Gemini API       ← GOOGLE_API_KEY があれば（無料枠 1500回/日）
2. OpenAI API       ← OPENAI_API_KEY があれば（gpt-image-1・フォールバック）
3. 1×1 PNG モック   ← すべて未設定の場合
```

---

## エージェントパイプライン

```
orchestrator.js
  ├── 1. ceo      戦略決定（どのクラスターに注力するか）
  ├── 2. seo      キーワード選定（KEYWORD_POOL から未投稿を選ぶ）
  ├── 3. writer   記事本文生成（CLI → API → テンプレート）
  ├── 4. designer ヒーロー画像・インライン画像生成
  ├── 5. linker   内部リンク解決・関連記事追加
  ├── 6. editor   品質チェック（文字数・比較表・FAQ等）
  └── 7. analyst  メトリクス記録・ログ保存
```

Editor が却下した場合は writer → designer → linker → editor を最大3回リトライします。

---

## キーワードプールの補充

記事ネタは `ve/run.js` の `KEYWORD_POOL` 配列で管理しています。

```javascript
// ve/run.js
const KEYWORD_POOL = [
  { slug: "your-article-slug", title: "記事タイトル", tags: ["タグ1", "タグ2"] },
  // ...
];
```

残り5件以下になると GitHub Issue が自動作成されます。

---

## ディレクトリ構成

```
auto-ai-blog/
├── run-local.sh          # ローカル実行エントリーポイント ★
├── ve/
│   ├── orchestrator.js   # エージェントパイプライン制御
│   ├── run.js            # レガシー単体実行スクリプト
│   ├── context.json      # エージェント間の共有状態
│   ├── ceo/run.js
│   ├── seo/run.js
│   ├── writer/run.js     # テキスト生成（CLI優先）
│   ├── designer/run.js   # 画像生成（Gemini → OpenAI → モック）
│   ├── linker/run.js
│   ├── editor/run.js
│   └── analyst/run.js
├── _posts/               # 生成された記事（Jekyll）
├── assets/images/        # 生成された画像
├── .github/workflows/
│   ├── jekyll-pages.yml  # push → 自動デプロイ（変更不要）
│   └── daily.yml         # 手動実行用ポストプロセス（AI生成は行わない）
└── _config.yml
```

---

## エージェント構成

| ID | 役割 | 担当 |
|----|------|------|
| VE-001 | CEO | 戦略統括 |
| VE-002 | SEO Specialist | キーワード分析 |
| VE-003 | Writer | 記事執筆 |
| VE-004 | Designer | OGP画像作成 |
| VE-005 | Linker | 内部リンク最適化 |
| VE-006 | Editor | 品質管理 |
| VE-007 | Analyst | データ分析 |
| VE-008 | Marketer | SNSマーケティング（将来実装） |

## 技術スタック

- **フレームワーク**: Jekyll (GitHub Pages)
- **記事生成**: Claude Code CLI / Gemini CLI（定額）
- **画像生成**: Gemini API（無料）
- **デプロイ**: GitHub Actions（push トリガー）
- **分析**: Google Analytics 4

## ライセンス

記事コンテンツ: © 2026 garyohosu (hantani)
システムコード: MIT License

## 作者

- **X (Twitter)**: [@garyohosu](https://x.com/garyohosu)
- **note**: [garyohosu](https://note.com/garyohosu)
- **GitHub**: [garyohosu](https://github.com/garyohosu)
