# auto-ai-blog 動作確認プラン

## 目的
マルチエージェントシステム（spec.md v2.0）の段階的動作確認。

## 前提条件
- ✅ CEO Agent 完全実装済み（soul.md + run.js）
- ✅ SEO Agent 完全実装済み（soul.md + run.js）
- ✅ Orchestrator 実装済み（orchestrator.js）
- ⚠️ Writer Agent 部分実装（soul.md のみ、run.js 未実装）
- ❌ Designer, Linker, Editor, Analyst 未実装

## フェーズ1: CEO + SEO 単体動作確認（本日実施）

### 目標
CEO → SEO の2エージェントパイプラインが正常に動作することを確認。

### 検証項目
1. **Orchestrator 起動**
   ```bash
   cd /c/project/auto-ai-blog
   node ve/orchestrator.js
   ```
   - [ ] context.json が初期化される
   - [ ] `phase: "ceo"` で開始

2. **CEO Agent 実行**
   - [ ] `ve/ceo/input.md` を読み込む
   - [ ] `ve/metrics.md` を分析
   - [ ] `ve/ceo/output.md` に戦略を出力
   - [ ] `context.json` に `ceo_strategy: "ai-productivity"` を記録
   - [ ] `ve/ceo/memory.md` に履歴追加

3. **SEO Agent 実行**
   - [ ] `context.json` から CEO 戦略を読み込む
   - [ ] `ve/run.js` の KEYWORD_POOL から未使用キーワードを選定
   - [ ] `ve/seo/output.md` に選定結果を出力
   - [ ] `context.json` に `selected_keyword` を記録
   - [ ] `ve/seo/memory.md` に履歴追加

4. **終了処理**
   - [ ] Writer が未実装のため、orchestrator は `phase: "writer"` で停止
   - [ ] `context.json` の `status: "partial"` を確認
   - [ ] ログファイル `ve/logs/2026-02-18.md` が生成される

### 期待出力
```json
{
  "date": "2026-02-18",
  "timestamp": "2026-02-18T12:00:00+09:00",
  "phase": "writer",
  "ceo_strategy": "ai-productivity",
  "selected_keyword": {
    "slug": "ai-email-writing-tools",
    "title": "AIメール作成ツール比較 | 2026年最新版",
    "tags": ["ai-tools", "productivity", "email"]
  },
  "status": "partial",
  "agents_completed": [
    {"agent": "ceo", "timestamp": "...", "duration": 1.2},
    {"agent": "seo", "timestamp": "...", "duration": 0.8}
  ]
}
```

### エラーハンドリング確認
- CEO が失敗した場合、orchestrator が `status: "failed"` を記録し停止
- SEO が失敗した場合、context.json に `failed_at: "seo"` を記録

## フェーズ2: Writer Agent 実装（今後）

### 必要なファイル
- `ve/writer/run.js`
- `ve/writer/memory.md`
- `ve/writer/input.md`
- `ve/writer/output.md`

### 実装内容
- OpenAI API で記事本文生成（4000字以上）
- 比較表・FAQ・CTA を含む Evergreen コンテンツ
- `_posts/YYYY-MM-DD-slug.md` に出力

## フェーズ3: Designer Agent 実装（今後）

### 必要なファイル
- `ve/designer/run.js`
- `ve/designer/soul.md`
- `ve/designer/memory.md`
- `ve/designer/input.md`
- `ve/designer/output.md`

### 実装内容
- OpenAI Images API で hero image 生成
- `assets/images/YYYY-MM-DD-slug.png` に保存
- 記事の front matter に `image:` 追加

## フェーズ4: Linker, Editor, Analyst 実装（今後）

### 優先順位
1. **Editor**: 品質チェック（必須）
2. **Linker**: 内部リンク自動生成（重要）
3. **Analyst**: メトリクス記録（必須）

## フェーズ5: GitHub Actions 統合

### .github/workflows/daily.yml
現在は存在しないため、手動実行のみ。
実装後は平日2回・週末3回の自動実行。

## 実施コマンド（フェーズ1）

```bash
# 1. リポジトリ最新化
cd /c/project/auto-ai-blog
git pull origin main

# 2. Orchestrator 実行（ドライラン）
node ve/orchestrator.js

# 3. 実行結果確認
cat ve/context.json
cat ve/ceo/output.md
cat ve/seo/output.md
cat ve/logs/2026-02-18.md

# 4. 問題なければコミット
git add ve/context.json ve/ceo/ ve/seo/ ve/logs/
git commit -m "test: verify CEO + SEO agent pipeline"
git push origin main
```

## 成功基準

### 最小限（フェーズ1）
- [x] orchestrator.js がエラーなく終了
- [x] context.json に ceo_strategy + selected_keyword が記録される
- [x] CEO と SEO の memory.md に履歴が追加される

### 理想（全フェーズ完了後）
- [ ] 記事が `_posts/` に自動生成される
- [ ] hero image が `assets/images/` に保存される
- [ ] 内部リンクが自動挿入される
- [ ] Editor の承認/却下が機能する
- [ ] metrics.md に新規行が追加される
- [ ] GitHub Actions で日次自動実行

## トラブルシューティング

### orchestrator.js が起動しない
- Node.js バージョン確認: `node --version` (>= 18)
- 依存関係確認: orchestrator.js は外部パッケージを使わない

### CEO Agent がエラー
- `ve/ceo/run.js` の構文チェック: `node -c ve/ceo/run.js`
- input.md の存在確認: `cat ve/ceo/input.md`

### SEO Agent がエラー
- KEYWORD_POOL の読み込み確認: `ve/run.js` の構文
- 既存記事の重複チェック: `_posts/` ディレクトリスキャン

## 次のアクション

1. **今すぐ**: フェーズ1 実行
2. **今日中**: Writer Agent の run.js 実装
3. **今週中**: Designer, Editor, Analyst 実装
4. **来週**: GitHub Actions 統合
