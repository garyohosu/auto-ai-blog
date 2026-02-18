# Designer Agent - Output Template

## 🎨 画像生成結果

**日時**: YYYY-MM-DDTHH:mm:ss.sssZ  
**記事**: `_posts/YYYY-MM-DD-{slug}.md`  
**画像**: `/assets/images/YYYY-MM-DD-{slug}-hero.png`

---

## ✅ 生成成功 / ⚠️ モック画像を使用

### 成功時

- **モデル**: DALL·E 3
- **サイズ**: 1792x1024
- **スタイル**: vivid
- **品質**: HD

#### 最適化されたプロンプト

```
（OpenAI が自動生成した詳細プロンプト）
```

### モック時

OpenAI API Key が設定されていないため、プレースホルダー画像を使用しました。

**本番環境では `OPENAI_API_KEY` を設定してください。**

---

## 📝 更新内容

- 記事 front-matter に `image: "/assets/images/..."` を追加
- context.json に `image_path` を記録

## ✅ 完了

次のエージェント（Linker）へ引き継ぎます。

---

## 更新されるデータ

**context.json**:

```json
{
  "image_path": "/assets/images/2026-02-18-ai-productivity-complete-guide-hero.png",
  "current_phase": "linker",
  "completed_agents": [
    ...existing agents,
    {
      "agent": "designer",
      "timestamp": "...",
      "duration": 0.45,
      "success": true
    }
  ]
}
```

**記事 front-matter**:

```yaml
---
layout: post
title: "記事タイトル"
date: 2026-02-18
tags: ["タグ1", "タグ2"]
image: "/assets/images/2026-02-18-slug-hero.png"
---
```
