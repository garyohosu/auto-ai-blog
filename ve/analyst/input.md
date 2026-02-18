# Analyst Agent - Input

## 入力データソース

### 1. context.json
全エージェントの実行結果を含む完全なコンテキスト：
- `date`: 実行日
- `timestamp`: 実行開始タイムスタンプ
- `current_phase`: 現在のフェーズ
- `ceo_strategy`: CEO が決定した戦略クラスター
- `selected_keyword`: SEO が選択したキーワード
- `article_path`: Writer が生成した記事パス
- `editor_decision`: Editor の判定結果
- `editor_issues`: 検出された品質問題
- `completed_agents`: 各エージェントの実行履歴
- `status`: 全体ステータス

### 2. _posts/ ディレクトリ
累計記事数とクラスター別統計を取得

### 3. ve/metrics.md（既存）
過去のメトリクスデータ

---

## 入力スキーマ

**context.json**:

```json
{
  "date": "2026-02-18",
  "timestamp": "2026-02-18T12:25:29.522Z",
  "current_phase": "analyst",
  "ceo_strategy": "ai_productivity",
  "selected_keyword": {
    "slug": "ai-productivity-complete-guide",
    "title": "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】",
    "tags": ["AI効率化", "生産性", "ビジネス"]
  },
  "article_path": "_posts/2026-02-18-ai-productivity-complete-guide.md",
  "editor_decision": "approved",
  "editor_issues": [],
  "completed_agents": [
    {
      "agent": "ceo",
      "timestamp": "2026-02-18T12:25:29.566Z",
      "duration": 0.04
    },
    {
      "agent": "seo",
      "timestamp": "2026-02-18T12:25:29.607Z",
      "duration": 0.04
    },
    {
      "agent": "writer",
      "timestamp": "2026-02-18T12:25:30.077Z",
      "duration": 0.51
    },
    {
      "agent": "editor",
      "timestamp": "2026-02-18T12:57:40.969Z",
      "duration": 0.01
    }
  ],
  "status": "in_progress"
}
```

---

## 処理内容

### 1. メトリクス更新
`ve/metrics.md` に以下を記録：
- **累計記事数**: _posts/ 内のファイル数
- **クラスター別記事数**: タグ別の集計
- **日次ログ**: 本日の記事生成結果

### 2. 詳細ログ保存
`ve/logs/YYYY-MM-DD.md` に記録：
- **実行サマリー**: ステータス、記事パス、キーワード
- **エージェント実行履歴**: 各エージェントの所要時間
- **エラー情報**: 品質チェック問題など

### 3. 統計分析
- 総記事数
- トップクラスター（記事数上位5個）
- 実行時間合計

---

## 出力データ

### output.md
本日の実行サマリー（記事情報、実行時間、累計統計）

### memory.md
過去の分析履歴（日付、記事数、ステータス）

### metrics.md（更新）
累計メトリクスに本日のデータを追加

### logs/YYYY-MM-DD.md（更新）
詳細な実行ログ
