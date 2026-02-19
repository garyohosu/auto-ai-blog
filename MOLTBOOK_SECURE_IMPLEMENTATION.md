# Moltbook投稿 - セキュア実装ガイド (書き込み専用)

## ⚠️ セキュリティ方針

**プロンプトインジェクション対策として、以下の原則を厳守:**

1. **書き込み専用モード**: Moltbookからの読み込みは行わない
2. **投稿内容の事前生成**: すべての投稿をローカルで生成・レビュー
3. **自動実行の禁止**: 外部入力に基づくAI判断を排除
4. **人間承認フロー**: 投稿前に必ず人間が確認

## OpenClawを使わない代替案（推奨）

OpenClawはセルフホスト型で、セキュリティリスクが高いため、**Moltbook APIを直接使用する方式**を推奨します。

### 方式A: Moltbook公式API (推奨) ⭐️⭐️⭐️⭐️⭐️

```javascript
// ve/marketer/moltbook-poster.js
const https = require('https');

class SecureMoltbookPoster {
  constructor(apiKey, agentId) {
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.apiUrl = 'https://api.moltbook.com'; // 仮のURL
  }

  /**
   * 事前に生成された投稿内容を送信（読み込み一切なし）
   */
  async post(content, metadata = {}) {
    // 投稿内容のサニタイゼーション
    const sanitized = this.sanitizeContent(content);
    
    // 人間承認フラグチェック
    if (!metadata.humanApproved) {
      throw new Error('❌ 人間による承認が必要です');
    }

    const payload = {
      agent_id: this.agentId,
      content: sanitized,
      metadata: {
        source: 'auto-ai-blog-marketer',
        timestamp: new Date().toISOString(),
        approved_by: metadata.approvedBy || 'system'
      }
    };

    return this.sendRequest('/posts', 'POST', payload);
  }

  sanitizeContent(content) {
    // プロンプトインジェクション対策
    // - スクリプトタグ削除
    // - 制御文字除去
    // - 長さ制限
    return content
      .replace(/<script.*?>.*?<\/script>/gi, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .substring(0, 5000);
  }

  async sendRequest(path, method, data) {
    // 実装略（HTTPSリクエスト送信）
  }
}

module.exports = SecureMoltbookPoster;
```

**使用例**:
```javascript
const poster = new SecureMoltbookPoster(
  process.env.MOLTBOOK_API_KEY,
  process.env.MOLTBOOK_AGENT_ID
);

// 事前に生成した投稿内容
const preGeneratedPost = {
  content: '👋 初めまして！Alex Chenです。...',
  humanApproved: true,
  approvedBy: 'hantani'
};

await poster.post(preGeneratedPost.content, {
  humanApproved: true,
  approvedBy: 'hantani'
});
```

### 方式B: 手動投稿 + 自動化なし ⭐️⭐️⭐️

最も安全な方法：

1. ローカルで投稿内容を生成（`node ve/marketer/generate-posts.js`）
2. 生成内容を `/tmp/posts_queue.json` に保存
3. **人間がレビュー**
4. **手動でMoltbookに投稿**（Webインターフェース経由）

**メリット**:
- プロンプトインジェクションリスクゼロ
- 完全なコンテンツ制御
- API不要

**デメリット**:
- 手動作業が必要
- スケールしない

### 方式C: GitHub Actions + 承認フロー ⭐️⭐️⭐️⭐️

```yaml
# .github/workflows/moltbook-post-approval.yml
name: Moltbook Post (Manual Approval)

on:
  schedule:
    - cron: '0 23 * * *'  # 08:00 JST
  workflow_dispatch:

jobs:
  generate-post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate Post Content
        run: node ve/marketer/generate-posts.js
        
      - name: Create Issue for Approval
        uses: actions/github-script@v7
        with:
          script: |
            const postContent = require('./tmp/post_draft.json');
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `📝 Moltbook投稿承認: ${postContent.title}`,
              body: `## 投稿内容\n\n${postContent.content}\n\n---\n\n承認する場合は "approved" とコメント`,
              labels: ['moltbook', 'approval-required']
            });

  post-after-approval:
    needs: generate-post
    runs-on: ubuntu-latest
    if: github.event.issue.comment.body == 'approved'
    steps:
      - name: Post to Moltbook
        run: node ve/marketer/moltbook-poster.js
        env:
          MOLTBOOK_API_KEY: ${{ secrets.MOLTBOOK_API_KEY }}
```

**フロー**:
1. GitHub Actionsが投稿内容を生成
2. 自動でGitHub Issueを作成
3. hantaniがレビュー
4. "approved" とコメント → 投稿実行

## 実装ロードマップ

### Phase 1: 調査（今週）
- [ ] Moltbook公式APIの存在確認
- [ ] APIドキュメントの入手
- [ ] 認証方式の確認（API Key / OAuth）
- [ ] 投稿レート制限の確認

### Phase 2: 最小実装（来週）
- [ ] 投稿内容生成スクリプト作成
- [ ] ローカルでのテスト投稿
- [ ] 人間承認フロー実装
- [ ] GitHub Actions統合

### Phase 3: 本番運用（2-3週間後）
- [ ] 毎日3回の自動生成
- [ ] 人間レビュー + 承認
- [ ] 投稿実行
- [ ] GA4でトラッキング

## セキュリティチェックリスト

### ✅ 必須対策
- [ ] 外部入力をAIに渡さない
- [ ] 投稿内容は事前生成のみ
- [ ] すべての投稿に人間承認が必要
- [ ] API Keyは環境変数で管理
- [ ] 投稿内容のサニタイゼーション
- [ ] レート制限の遵守
- [ ] エラーハンドリング

### ⚠️ 禁止事項
- ❌ Moltbookからのメッセージ読み込み
- ❌ 他のエージェントの投稿内容を解析
- ❌ 外部入力に基づく動的な投稿生成
- ❌ OpenClawの自動実行モード
- ❌ 無制限のAPI呼び出し

## OpenClawを使う場合の制限付き設定

もしOpenClawを使う場合は、以下の制限を設ける：

```yaml
# openclaw_config.yml (読み込み禁止設定)
agent:
  name: "Alex Chen"
  mode: "write-only"
  
permissions:
  read_messages: false        # 読み込み禁止
  read_posts: false           # 他の投稿を読まない
  execute_commands: false     # コマンド実行禁止
  web_browsing: false         # ブラウジング禁止
  
  write_posts: true           # 投稿のみ許可
  
skills:
  - moltbook_post             # 投稿機能のみ有効化
  
safeguards:
  require_human_approval: true
  sanitize_all_content: true
  log_all_actions: true
```

## 代替案: 完全手動運用（最も安全）

**推奨**: 当面は完全手動で運用

1. **毎朝08:00**: GitHub Actionsが投稿案を生成 → Issueに投稿
2. **hantaniがレビュー**: 内容を確認・修正
3. **手動投稿**: MoltbookのWebUIから投稿
4. **記録**: GA4でトラッキング

この方式なら：
- プロンプトインジェクションリスクゼロ
- 完全なコンテンツ品質管理
- セキュリティ問題なし

自動化は十分にテストしてから段階的に導入。

## まとめ

**現時点での推奨アプローチ**:

1. **短期（1-2週間）**: 完全手動運用
   - 投稿内容生成は自動
   - レビューと投稿は手動

2. **中期（1ヶ月）**: 半自動化
   - GitHub Actionsでの承認フロー
   - APIによる自動投稿

3. **長期（2-3ヶ月）**: 段階的自動化
   - 実績を見て判断
   - セキュリティモニタリング継続

**次のステップ**:
1. Moltbook APIの調査
2. 投稿内容生成スクリプトの作成
3. 手動投稿での初期テスト

---
作成: 2026-02-19
作成者: hantani (garyohosu)
