# Linker Agent - Input

## 入力データソース

### 1. context.json
- `article_path`: Writer Agent が生成した記事ファイルのパス
- `selected_keyword`: 記事のキーワード情報（タグを含む）

### 2. _posts/ ディレクトリ
すべての既存記事のメタデータ（タイトル、スラッグ、タグ）を取得して内部リンク解決に使用

---

## 入力スキーマ

**context.json**:

```json
{
  "article_path": "_posts/2026-02-18-ai-productivity-complete-guide.md",
  "selected_keyword": {
    "slug": "ai-productivity-complete-guide",
    "title": "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】",
    "tags": ["AI効率化", "生産性", "ビジネス"]
  }
}
```

---

## 処理内容

### 1. 内部リンクプレースホルダー解決

記事内の `[INTERNAL: slug]` を実リンクに変換：

**変換前**:
```markdown
詳細は [INTERNAL: best-ai-writing-tools] をご覧ください。
```

**変換後**:
```markdown
詳細は [最高のAI文章作成ツール](/posts/best-ai-writing-tools) をご覧ください。
```

### 2. 関連記事セクション追加

記事末尾に「## 関連記事」セクションを自動追加：

```markdown
---

## 関連記事

- [AIツール比較ガイド](/posts/ai-tools-comparison)
- [生産性を上げるAI活用術](/posts/ai-productivity-tips)
- [ビジネスAIの最新トレンド](/posts/ai-business-trends)
```

**選択ロジック**:
- 同じタグを持つ記事を優先
- タグの重複数でスコアリング
- 最新順にソート
- 上位3件を選択

---

## 出力データ

### output.md
リンク処理結果サマリー（解決数、関連記事追加状況）

### memory.md
リンク処理履歴（日時、記事、解決リンク数）

### 記事ファイル更新
内部リンク解決 + 関連記事セクション追加

### context.json更新
```json
{
  "current_phase": "editor"
}
```
