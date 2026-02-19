# ページビュー記録システム

## 概要
GitHub Pages（静的サイト）から、さくらレンタルサーバーのデータベースAPIを使ってページビューを記録するシステム。

---

## アーキテクチャ

```
GitHub Pages (静的HTML/JS)
  ↓ fetch() (CORS)
さくらサーバー /cgi/api/db.cgi
  ↓
SQLite データベース: auto_ai_blog.db
  ↓ テーブル: pageviews
```

---

## データフロー

### 1️⃣ ユーザーが記事を閲覧
```
1. ブラウザが HTML をロード
2. pageview-tracker.js が自動実行
3. セッションID・ビジターIDを生成/取得
4. fetch() で sakura DB に POST
```

### 2️⃣ データベースに記録
```sql
INSERT INTO pageviews (
  page_path,
  page_title,
  referrer,
  session_id,
  visitor_id,
  user_agent,
  screen_width,
  screen_height,
  timestamp,
  created_at
) VALUES (...)
```

### 3️⃣ Analyst Agent が集計
```
毎日の Virtual Employee 実行時:
1. ve/analyst/pageview.js が API 呼び出し
2. 過去7日間のPV統計を取得:
   - 総PV数
   - ユニーク訪問者数
   - トップ10記事
   - 日別PV推移
   - トップリファラー
3. metrics.md に書き込み
```

---

## ファイル構成

### フロントエンド（GitHub Pages）
```
assets/js/pageview-tracker.js
├─ getSessionId()         # セッションID生成・取得
├─ getVisitorId()         # ビジターID生成・取得
├─ recordPageview()       # PVをDBに記録
├─ initializeTable()      # 初回テーブル作成
└─ trackPageview()        # デバウンス処理
```

### バックエンド（さくらサーバー）
```
~/www/cgi/api/db.cgi      # 既存のDB API
├─ execute_select()
├─ execute_insert()       # PV記録に使用
├─ execute_count()        # 総PV取得に使用
└─ execute_create_table() # テーブル自動作成
```

### アナリティクス（Virtual Employee）
```
ve/analyst/pageview.js
├─ getTotalPageviews()    # 総PV数
├─ getUniqueVisitors()    # UU数
├─ getTopPages()          # トップ記事
├─ getPageviewsByDay()    # 日別PV
└─ getTopReferrers()      # リファラー統計

ve/analyst/run.js
└─ updateMetrics()        # metrics.md に統計追加
```

---

## データベーススキーマ

### テーブル: pageviews

| カラム名 | 型 | 説明 |
|----------|----|----|
| id | INTEGER PRIMARY KEY | 自動採番ID |
| page_path | TEXT NOT NULL | ページパス（例: /auto-ai-blog/2026-02-19-ai-tools.html） |
| page_title | TEXT | ページタイトル |
| referrer | TEXT | リファラー（参照元URL） |
| session_id | TEXT NOT NULL | セッションID（UUID v4形式） |
| visitor_id | TEXT NOT NULL | ビジターID（永続、localStorage保存） |
| user_agent | TEXT | ユーザーエージェント |
| screen_width | INTEGER | 画面幅 |
| screen_height | INTEGER | 画面高さ |
| timestamp | TEXT | ISO8601形式のタイムスタンプ |
| created_at | INTEGER | Unix timestamp（秒） |

---

## API呼び出し例

### ページビュー記録（フロントエンド）
```javascript
fetch('https://www.garyo.sakura.ne.jp/cgi/api/db.cgi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'query',
    database: 'auto_ai_blog',
    operation: 'insert',
    table: 'pageviews',
    data: {
      page_path: '/auto-ai-blog/2026-02-19-ai-tools.html',
      page_title: 'AI ツール比較',
      referrer: 'https://google.com',
      session_id: 'abc123-...',
      visitor_id: 'v1234567890_xyz',
      user_agent: 'Mozilla/5.0...',
      screen_width: 1920,
      screen_height: 1080,
      timestamp: '2026-02-19T12:34:56Z',
      created_at: 1708340096
    }
  })
});
```

### PV統計取得（バックエンド）
```javascript
// 総PV数
{
  action: 'query',
  database: 'auto_ai_blog',
  operation: 'count',
  table: 'pageviews'
}
// → { ok: true, data: { count: 1234 } }

// 過去7日間のPV
{
  action: 'query',
  database: 'auto_ai_blog',
  operation: 'select',
  table: 'pageviews',
  fields: ['page_path', 'created_at'],
  limit: 10000
}
```

---

## 動作確認

### 1️⃣ フロントエンドの確認
```
1. https://garyohosu.github.io/auto-ai-blog/ にアクセス
2. ブラウザの開発者ツール → Console
3. "[Pageview] Recorded: ..." が表示されればOK
```

### 2️⃣ データベースの確認（さくらサーバー）
```bash
ssh garyo@garyo.sakura.ne.jp
sqlite3 ~/www/cgi/api/_data/databases/auto_ai_blog.db

sqlite> SELECT COUNT(*) FROM pageviews;
sqlite> SELECT * FROM pageviews ORDER BY created_at DESC LIMIT 5;
```

### 3️⃣ Analyst Agent の確認
```bash
# ローカルテスト
cd ve/analyst
node pageview.js

# 出力例:
{
  "totalPageviews": 142,
  "uniqueVisitors": 23,
  "topPages": [
    { "path": "/2026-02-18-ai-tools.html", "title": "AI ツール比較", "count": 45 },
    ...
  ],
  "pageviewsByDay": [
    { "date": "2026-02-18", "count": 67 },
    { "date": "2026-02-19", "count": 75 }
  ],
  "topReferrers": [
    { "referrer": "https://www.google.com", "count": 89 },
    ...
  ]
}
```

---

## metrics.md への出力例

```markdown
## 👁️  ページビュー統計（過去7日間）

**総 PV**: 142 | **ユニーク訪問者**: 23

### トップページ

| 記事 | PV | タイトル |
|------|----|----|
| ai-tools | 45 | AI ツール比較 |
| chatgpt-vs-claude | 32 | ChatGPT vs Claude 比較 |
| ai-image-generators | 28 | AI 画像生成ツール |

### 日別 PV

| 日付 | PV |
|------|-----|
| 2026-02-18 | 67 |
| 2026-02-19 | 75 |

### トップリファラー

| 参照元 | 件数 |
|------|------|
| https://www.google.com | 89 |
| https://twitter.com | 23 |
```

---

## セキュリティ

### CORS設定
- サーバー側（db.cgi）が `Access-Control-Allow-Origin: *` を返す
- フロントエンドのドメインチェックは `check_origin()` で実施

### SQL インジェクション対策
- `sanitize_identifier()` で識別子をチェック
- プレースホルダー `?` でパラメータをバインド

### データサイズ制限
- `MAX_CONTENT_LENGTH = 64KB` で POST サイズ制限
- `MAX_LIMIT = 1000` でSELECT結果数を制限

---

## トラブルシューティング

### PVが記録されない
```
1. ブラウザのConsoleでエラーを確認
2. CORSエラー → db.cgi のヘッダー確認
3. SSLエラー → URL が www.garyo.sakura.ne.jp か確認
4. テーブル未作成 → initializeTable() が実行されたか確認
```

### 統計が取得できない
```
1. ve/analyst/pageview.js を単体実行
   node ve/analyst/pageview.js
   
2. API エンドポイントが正しいか確認
   curl -X POST https://www.garyo.sakura.ne.jp/cgi/api/db.cgi \
     -H 'Content-Type: application/json' \
     -d '{"action":"query","database":"auto_ai_blog","operation":"count","table":"pageviews"}'
   
3. データベースファイルの権限確認
   ls -la ~/www/cgi/api/_data/databases/
```

---

## 参考資料

- [note記事: GitHub PagesからさくらCGIを呼び出す実験](https://note.com/hantani/n/n8f73bdfa48a1)
- [sakura DB API仕様](https://www.garyo.sakura.ne.jp/cgi/api/db.cgi)
- [GitHub リポジトリ: ai-lab](https://github.com/garyohosu/ai-lab)
- [GitHub リポジトリ: cgi](https://github.com/garyohosu/cgi)

---

## 将来の拡張

### Phase 2: リアルタイムダッシュボード
- `/analytics.html` ページを作成
- Chart.js で PV 推移をグラフ化
- リアルタイム訪問者数表示

### Phase 3: 記事推薦エンジン
- 閲覧履歴から関連記事を推薦
- 人気記事の関連キーワードを SEO Agent にフィードバック

### Phase 4: A/Bテスト
- タイトル・サムネイル画像の効果測定
- Writer Agent が人気タイトルパターンを学習
