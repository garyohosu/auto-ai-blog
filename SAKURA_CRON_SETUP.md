# さくらサーバー cron から auto-ai-blog をキックする設定ガイド

## ✅ 完了した作業

### 1. GitHub Actions ワークフローの修正
- ファイル: `.github/workflows/daily.yml`
- 追加内容: `repository_dispatch` トリガー
  ```yaml
  on:
    workflow_dispatch:
    repository_dispatch:
      types: [run-virtual-employee]
    schedule:
      ...
  ```

### 2. トリガースクリプトの作成とアップロード
- ファイル: `~/bin/trigger_auto_ai_blog.sh`
- 場所: さくらサーバー `/home/garyo/bin/trigger_auto_ai_blog.sh`
- 権限: 実行可能（chmod +x 済み）

---

## 🔧 残りの設定手順

### **Step 1: GitHub Personal Access Token (PAT) の作成**

1. GitHub にログイン
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
   URL: https://github.com/settings/tokens
3. "Generate new token (classic)" をクリック
4. 設定:
   - **Note**: `auto-ai-blog cron trigger`
   - **Expiration**: `No expiration` または長期（90日等）
   - **Scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
5. "Generate token" をクリック
6. 生成されたトークンをコピー（例: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

### **Step 2: スクリプトにトークンを設定**

```bash
# さくらサーバーにSSH接続
ssh garyo@garyo.sakura.ne.jp

# スクリプトを編集
vi ~/bin/trigger_auto_ai_blog.sh

# 13行目の GITHUB_TOKEN を実際のトークンに置き換え
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 保存して終了（vi: :wq）
```

### **Step 3: 動作テスト**

```bash
# スクリプトを手動実行
~/bin/trigger_auto_ai_blog.sh

# 期待される出力:
# ✅ 成功: GitHub Actions ワークフローがトリガーされました
# 🔗 確認URL: https://github.com/garyohosu/auto-ai-blog/actions
```

### **Step 4: crontab に追加**

```bash
# crontab 編集
crontab -e

# 以下の行を追加（毎日 JST 7:00 に実行）
0 7 * * * ~/bin/trigger_auto_ai_blog.sh >> ~/log/auto_ai_blog_trigger.log 2>&1

# 保存して終了
```

**cron スケジュールの説明:**
```
0 7 * * *    = 毎日 7:00 (JST)
0 7 * * 1-5  = 平日のみ 7:00
0 7,20 * * * = 毎日 7:00 と 20:00
```

### **Step 5: ログディレクトリ作成**

```bash
# ログディレクトリが存在しない場合は作成
mkdir -p ~/log
```

---

## 📊 現在の cron 設定

```cron
# NAME: cron test
0 0 * * * /home/garyo/project/ruby/cron.rb

# NAME: xperia_bot
0 */1 * * * /home/garyo/project/ruby/cronxperiabot.rb

# MagicBoxAI Cleanup
0 2 * * * cd /home/garyo/www/magicboxai && php cron_cleanup.php >> /tmp/magicboxai_cleanup.log 2>&1

# ↓ ここに追加（推奨）
# NAME: auto-ai-blog GitHub Actions Trigger
0 7 * * * ~/bin/trigger_auto_ai_blog.sh >> ~/log/auto_ai_blog_trigger.log 2>&1
```

---

## 🎯 メリット

### **さくらサーバー cron の利点**

1. **確実な実行** - GitHub Actions の schedule は遅延や欠落があるが、さくらサーバーの cron は確実
2. **柔軟なスケジュール** - JST で直接指定可能
3. **ログの一元管理** - さくらサーバーで実行ログを確認できる
4. **複数時間帯の設定が簡単** - cron 1行追加で複数実行可能
5. **無料** - さくらサーバーの既存機能を使うだけ

### **GitHub Actions schedule の問題点**

- 15-30分の遅延が頻発
- リポジトリ活動が少ないとスキップされる
- GitHub のインフラ負荷でスキップされることがある
- UTC 基準で設定が複雑

---

## 🔍 トラブルシューティング

### **エラー: 401 Unauthorized**
→ GitHub Token が無効または期限切れ
→ https://github.com/settings/tokens で確認

### **エラー: 404 Not Found**
→ リポジトリ名が間違っているか、Token に `repo` スコープがない

### **Actions が起動しない**
→ GitHub Actions ページで "repository_dispatch" イベントが表示されるか確認
→ ワークフローファイルの `types: [run-virtual-employee]` が正しいか確認

### **cron が実行されない**
→ `~/log/auto_ai_blog_trigger.log` でログを確認
→ `ps aux | grep cron` で cron デーモンが起動しているか確認

---

## ✅ チェックリスト

- [ ] GitHub Personal Access Token を作成（repo + workflow スコープ）
- [ ] `~/bin/trigger_auto_ai_blog.sh` にトークンを設定
- [ ] スクリプトの手動実行テストが成功
- [ ] GitHub Actions ページで実行を確認
- [ ] crontab に追加
- [ ] ログディレクトリ作成（`~/log/`）
- [ ] 翌日 7:00 に自動実行を確認
- [ ] ローカルリポジトリで `.github/workflows/daily.yml` を更新して push

---

## 📝 次のステップ

1. **GitHub Token を作成して設定**
2. **スクリプトをテスト実行**
3. **成功したら crontab に追加**
4. **ローカルで `.github/workflows/daily.yml` を push**

以上で、さくらサーバーの cron から auto-ai-blog を確実にキックできるようになります！
