# Editor Agent - Input

## 入力データソース

### 1. context.json
- `article_path`: Writer Agent が生成した記事ファイルのパス
- `selected_keyword`: 記事のターゲットキーワード情報
- `ceo_strategy`: CEO Agent が決定した戦略クラスター

### 2. 記事ファイル
- パス: `_posts/YYYY-MM-DD-{slug}.md`
- 内容: Writer Agent が生成したマークダウン記事
- チェック対象:
  - Front-matter（メタデータ）
  - 本文テキスト
  - 構成要素（見出し、テーブル、FAQ、リンク）

---

## 入力スキーマ

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

## 品質基準

### 必須要件

#### 1. 文字数
- **基準**: ≥ 3000文字（front-matter除く）
- **理由**: Evergreen コンテンツとして十分な情報量を確保

#### 2. 構成要素
| 要素 | 基準 | 理由 |
|------|------|------|
| 比較表 | ≥ 3個 | 具体的な比較情報の提供 |
| FAQ | ≥ 5個 | ユーザーの疑問解消 |
| 内部リンク | ≥ 3個 | サイト回遊率向上 |
| アフィリエイトリンク | ≥ 2個 | 収益化 |
| CTA | 必須 | コンバージョン誘導 |
| AI要約セクション | 必須 | AI Overview / ChatGPT Search 最適化 |

#### 3. スパムキーワード制限
- 各キーワード ≤ 5回/記事
- 対象: 「無料」「今すぐ」「限定」「特別価格」「緊急」「必見」

#### 4. 重複文検出
- 同一文の繰り返しがないこと
- 自然な文章フロー

---

## 入力データ例

**記事ファイル** (`_posts/2026-02-18-ai-productivity-complete-guide.md`):

```markdown
---
layout: post
title: "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】"
date: 2026-02-18
tags: ["AI効率化", "生産性", "ビジネス"]
---

## この記事で分かること

- **AI効率化ツールの選び方**：3つのポイントで比較
- **導入5ステップ**：実務で生産性3倍を実現
- **コスト比較**：無料〜月額¥5,000の具体例
...
```

**context.json**:

```json
{
  "date": "2026-02-18",
  "current_phase": "editor",
  "article_path": "_posts/2026-02-18-ai-productivity-complete-guide.md",
  "selected_keyword": {
    "slug": "ai-productivity-complete-guide",
    "title": "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】"
  }
}
```
