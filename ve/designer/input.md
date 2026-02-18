# Designer Agent - Input

## 入力データソース

### 1. context.json
- `article_path`: Writer Agent が生成した記事ファイルのパス
- `selected_keyword`: SEO Agent が選択したキーワード情報
  - `slug`: URLスラッグ
  - `title`: 記事タイトル（画像プロンプト生成に使用）
  - `tags`: タグリスト

### 2. 環境変数
- `OPENAI_API_KEY`: OpenAI API キー（必須）

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

## 処理フロー

### 1. プロンプト生成
記事タイトルとキーワードから画像生成プロンプトを自動作成：

```
A professional, modern digital illustration representing "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】". Clean, minimalist design with vibrant colors. Business style. High quality, 4K resolution.
```

### 2. 画像生成
- **API**: OpenAI Images API (DALL·E 3)
- **モデル**: dall-e-3
- **サイズ**: 1792x1024（横長バナー、16:9比率）
- **品質**: HD
- **スタイル**: vivid（鮮やか）または natural（自然）

### 3. 画像保存
- **ディレクトリ**: `assets/images/`
- **ファイル名形式**: `YYYY-MM-DD-{slug}-hero.png`
- **例**: `assets/images/2026-02-18-ai-productivity-complete-guide-hero.png`

### 4. Front-matter更新
記事ファイルの front-matter に `image` フィールドを追加：

```yaml
---
layout: post
title: "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】"
date: 2026-02-18
tags: ["AI効率化", "生産性", "ビジネス"]
image: "/assets/images/2026-02-18-ai-productivity-complete-guide-hero.png"
---
```

---

## モック動作

`OPENAI_API_KEY` が未設定の場合：
- プレースホルダー画像を使用（`https://via.placeholder.com/1792x1024/...`）
- ダウンロードして保存
- Front-matter は正常に更新

---

## 出力データ

### output.md
画像生成結果サマリー（プロンプト、保存先、成功/失敗）

### memory.md
画像生成履歴（日時、記事、画像パス）

### context.json更新
```json
{
  "image_path": "/assets/images/2026-02-18-ai-productivity-complete-guide-hero.png",
  "current_phase": "linker"
}
```
