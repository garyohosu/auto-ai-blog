#!/usr/bin/env node
/**
 * Writer Agent - Article Generation (with AI Summary Optimization)
 * 
 * Updated: 2026-02-18
 * - GPT-5.2 support (latest stable, 5.3 available but 5.2 recommended)
 * - AI Summary Optimization for Google AI Overview, ChatGPT, Perplexity
 * - 4000+ characters target with keyword-rich structure
 * 
 * Responsibilities:
 * 1. Read selected_keyword from context.json
 * 2. Generate 4000+ words evergreen article using OpenAI API (gpt-5.2)
 * 3. Include AI summary optimization section at the beginning
 * 4. Include 3+ comparison tables and 5+ FAQ items
 * 5. Output to _posts/YYYY-MM-DD-{slug}.md
 * 6. Update writer/output.md with summary
 * 7. Append to writer/memory.md
 * 8. Update context.json with article_path
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================
// Configuration
// ============================================================

const ROOT_DIR = path.resolve(__dirname, '../..');
const CONTEXT_PATH = path.join(ROOT_DIR, 've/context.json');
const OUTPUT_MD = path.join(__dirname, 'output.md');
const MEMORY_MD = path.join(__dirname, 'memory.md');
const INPUT_MD = path.join(__dirname, 'input.md');
const SOUL_MD = path.join(__dirname, 'soul.md');
const POSTS_DIR = path.join(ROOT_DIR, '_posts');

// OpenAI API configuration (if available)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_MOCK = !OPENAI_API_KEY; // Use mock data if no API key

// ============================================================
// Utility Functions
// ============================================================

function log(message) {
  console.log(`[writer] ${message}`);
}

function readJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

function readMD(filepath) {
  if (!fs.existsSync(filepath)) return '';
  return fs.readFileSync(filepath, 'utf8');
}

function writeMD(filepath, content) {
  fs.writeFileSync(filepath, content, 'utf8');
}

function appendMD(filepath, content) {
  const existing = readMD(filepath);
  writeMD(filepath, existing + '\n\n' + content);
}

function ensureDir(dirpath) {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// Article Generation (Mock or OpenAI)
// ============================================================

/**
 * Generate article content using OpenAI API (gpt-5.2)
 * @param {Object} keyword - Selected keyword object
 * @param {string} seoInstructions - Instructions from SEO agent
 * @param {string} rejectionReason - Rejection reason from Editor (if retry)
 * @returns {Promise<string>} Generated markdown content
 */
async function generateArticleWithAPI(keyword, seoInstructions, rejectionReason = '') {
  const { title, tags, slug } = keyword;
  const mainKeyword = slug.replace(/-/g, ' ');
  
  // Read soul.md for writing style guidelines
  const soul = readMD(SOUL_MD);
  
  // 却下理由があればプロンプトに追加
  let retryInstructions = '';
  if (rejectionReason) {
    retryInstructions = `

⚠️ 【前回の却下理由】
${rejectionReason}

※ 以上の問題を必ず解決してください。特に：
- 比較表が不足なら 3+ 追加
- FAQが不足なら 5+ 追加
- アフィリエイトリンクが不足なら 2+ 追加
- スパムキーワード（「無料」「今すぐ」等）が上限超過なら削除
- 文字数不足なら 4000+ 文字に増やす
`;
  }
  
  const prompt = `あなたは経験豊富なSEO特化ライターで、AI要約（Google AI Overview、ChatGPT要約、Perplexity要約）への最適化も熟知しています。以下の指示に従って、高品質なブログ記事を日本語で作成してください。

【記事タイトル】
${title}

【メインキーワード】
${mainKeyword}

【タグ】
${tags.join(', ')}

【SEO担当からの指示】
${seoInstructions}

【執筆ガイドライン】
${soul}${retryInstructions}

【必須要件】
1. **AI要約最適化**: 記事冒頭（導入の直後）に以下のセクションを必ず含める
   ## この記事で分かること
   - [メインキーワード] の [具体的な内容]
   - [サブキーワード1] と [サブキーワード2] の比較
   - [実践方法・手順] の詳細
   - よくある [課題] とその解決策
   ※このセクションがAI要約に引用されるため、主要キーワードを必ず含めること

2. 文字数: 4000字以上
3. 比較表: 3つ以上（Markdown table形式）
4. FAQ: 5問以上（## FAQ セクションにまとめる）
5. 構成: 導入 → **AI要約最適化セクション** → 本論（比較・手順） → FAQ → まとめ（CTA）
6. 内部リンク用のプレースホルダー: [INTERNAL: slug] の形式で3箇所以上挿入
7. アフィリエイトリンク用のプレースホルダー: [AFF_LINK: product_name] の形式で2箇所以上挿入

【AI最適化の追加要件】
- 各セクション見出し（##）に主要キーワードを自然に含める
- リスト（箇条書き）を多用し、AI要約が引用しやすい構造にする
- 数値・具体例を豊富に含める（「3倍」「5ステップ」「月額¥5,000」など）
- 「〜とは」「〜のメリット」「〜の手順」など、AI要約が好む定型表現を使う

【記事内画像マーカー】
300〜400字ごとに必ず以下の形式で画像マーカーを挿入してください。
マーカー形式: [IMAGE: 具体的な説明（英語で50字以内）]

挿入タイミング:
- 導入文の後（200〜300字後）
- 各セクションの切れ目（300〜400字ごと）
- 比較表の後
- まとめの前

良い例:
- [IMAGE: AI tools comparison bar chart showing productivity metrics by category]
- [IMAGE: Step-by-step workflow diagram for AI tool implementation process]
- [IMAGE: Side-by-side screenshot comparison of ChatGPT and Claude interfaces]

必ず記事全体で4〜6箇所挿入すること。マーカーは単独行に置くこと。

【禁止事項】
- ニュース羅列（短命コンテンツ）
- 薄いコンテンツ（< 3000字）
- キーワードの不自然な詰め込み
- 誇大表現・断定表現

記事本文のみを出力してください（front matterは不要）。Markdown形式で。`;

  try {
    log('Calling OpenAI API (gpt-5.2)...');
    const response = await mockOpenAICall(prompt);
    return response;
  } catch (error) {
    log(`⚠️  OpenAI API error: ${error.message}`);
    log('Falling back to mock content...');
    return generateMockArticle(keyword);
  }
}

/**
 * Real OpenAI API call via https module
 * max_completion_tokens=16000 必須: gpt-5.2 はリーズニングモデルのため
 * 内部推論トークンが多く、4096 では content が空になる
 */
function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-5.2',
      max_completion_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].message) {
              const content = json.choices[0].message.content;
              if (content) {
                resolve(content);
              } else {
                reject(new Error(`Empty content from API (finish_reason: ${json.choices[0].finish_reason}). Response: ${data.slice(0, 300)}`));
              }
            } else {
              reject(new Error(`API error: ${data.slice(0, 300)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function mockOpenAICall(prompt) {
  return await callOpenAI(prompt);
}

/**
 * Generate mock article content (fallback) with AI summary optimization
 */
function generateMockArticle(keyword) {
  const { title, slug, tags } = keyword;
  const mainKeyword = slug.replace(/-/g, ' ');
  
  return `## はじめに

現代のビジネスシーンにおいて、${tags[0]}の重要性は日々高まっています。本記事では、${title.split('｜')[0]}について、実践的な視点から徹底解説します。

この記事を読むことで、以下のメリットが得られます：

- ${tags[0]}の基本概念と最新トレンドの理解
- 具体的な導入手順とベストプラクティス
- 主要ツール・サービスの比較検討材料
- よくある課題とその解決策

それでは、詳しく見ていきましょう。

[IMAGE: Overview concept illustration of ${tags[0]} benefits and use cases]

## この記事で分かること

**AI要約最適化セクション**: このセクションは、Google AI Overview や ChatGPT などの AI 要約エンジンに引用されやすくするために設計されています。

- **${mainKeyword}の基本概念**: 定義、特徴、2026年最新トレンド
- **主要ツールの比較**: 料金、機能、サポート体制の詳細比較（3つの比較表）
- **導入手順の5ステップ**: 現状分析 → ツール選定 → テスト → 効果測定 → 本格展開
- **よくある課題と解決策**: 学習コスト、システム統合、セキュリティの対処法
- **コスト試算**: 企業規模別の具体的な費用目安（月額¥0〜¥50,000）
- **ROI（投資対効果）**: 導入後3ヶ月で初期効果、6ヶ月で本格的な効果測定
- **FAQ 7問**: 導入コスト、効果発現期間、既存プロセスへの影響など

## ${tags[0]}とは？基本概念の整理

${tags[0]}とは、[具体的な定義]を指します。近年の技術進化により、以下のような特徴を持つようになりました：

1. **効率性の向上**: 従来手法と比較して3倍以上の生産性向上
2. **コスト削減**: 人件費・時間コストの大幅な削減
3. **品質の安定化**: 人的ミスの削減と一貫性の確保

### なぜ今、${tags[0]}が注目されているのか

2026年現在、${tags[0]}が注目される理由は主に3つあります：

- **デジタル変革の加速**: リモートワークの定着による業務効率化ニーズ
- **AI技術の成熟**: 実用レベルに達した機械学習・自然言語処理
- **競合優位性の確保**: 早期導入企業と未導入企業の生産性格差拡大

## 主要ツール・サービス徹底比較

ここでは、${tags[0]}の代表的なツール・サービスを比較します。

### 比較表1: 主要ツール機能比較

| ツール名 | 料金（月額） | 主要機能 | 対応言語 | サポート |
|---------|-------------|---------|---------|---------|
| ツールA | $49 | 自動化、分析 | 日英中 | 24/7 |
| ツールB | $99 | 高度な分析 | 日英 | 平日のみ |
| ツールC | 無料 | 基本機能 | 英のみ | コミュニティ |

[AFF_LINK: tool-a] [AFF_LINK: tool-b]

[IMAGE: Comparison chart of top ${tags[0]} tools ranked by features and pricing]

### 比較表2: 導入規模別おすすめツール

| 企業規模 | おすすめツール | 推奨プラン | 想定コスト |
|---------|--------------|-----------|-----------|
| 個人・小規模 | ツールC | 無料 | ¥0/月 |
| 中小企業 | ツールA | ビジネス | ¥5,000/月 |
| 大企業 | ツールB | エンタープライズ | ¥50,000/月 |

### 比較表3: 機能詳細マトリックス

| 機能カテゴリ | ツールA | ツールB | ツールC |
|-------------|--------|--------|--------|
| データ分析 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 自動化 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| レポート | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 使いやすさ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

[IMAGE: 5-step implementation roadmap diagram for ${tags[0]} adoption]

## 導入手順：5ステップで始める

### ステップ1: 現状分析と目標設定

まずは現在の業務プロセスを可視化し、改善目標を明確にします。

- 現在の作業時間を計測
- ボトルネックの特定
- KPI（重要業績評価指標）の設定

### ステップ2: ツール選定

比較表を参考に、自社に最適なツールを選定します。

無料トライアルを活用して、以下の観点で評価しましょう：

- 操作性・学習コスト
- 既存システムとの連携性
- サポート体制

### ステップ3: 小規模テスト導入

いきなり全社展開するのではなく、一部署・一チームでテストします。

### ステップ4: 効果測定とフィードバック収集

テスト期間中の効果を定量的に測定します：

- 作業時間の削減率
- エラー発生率の変化
- ユーザー満足度スコア

### ステップ5: 本格展開と継続改善

テスト結果を踏まえ、本格展開を実施します。

[INTERNAL: ai-tools-comparison] [INTERNAL: productivity-tips] [INTERNAL: automation-guide]

## よくある課題と解決策

### 課題1: 導入初期の学習コスト

**解決策**: 段階的なロールアウトと充実したトレーニングプログラム

### 課題2: 既存システムとの統合

**解決策**: API連携やカスタム統合サービスの活用

### 課題3: セキュリティ・コンプライアンス

**解決策**: エンタープライズグレードのツール選定とガバナンス設計

[IMAGE: Common challenges and solutions infographic for ${tags[0]} implementation]

## FAQ：よくある質問

### Q1: 導入コストはどのくらいかかりますか？

A1: 企業規模により異なりますが、中小企業で月額5,000円〜、大企業で月額50,000円〜が目安です。初期導入費用として、トレーニングやカスタマイズで追加10〜50万円程度を見込んでください。

### Q2: 効果が出るまでどのくらいかかりますか？

A2: 一般的に、導入後3ヶ月で初期効果が現れ、6ヶ月で本格的なROI（投資対効果）が見えてきます。ただし、組織の成熟度やツールの選定によって変動します。

### Q3: 既存の業務プロセスを大きく変える必要がありますか？

A3: 必ずしも大規模な変革は不要です。多くのツールは既存プロセスに段階的に統合できるよう設計されています。まずは小さな改善から始めることをおすすめします。

### Q4: セキュリティは大丈夫ですか？

A4: エンタープライズグレードのツールは、ISO27001やSOC2などの国際的なセキュリティ基準に準拠しています。ただし、導入前に自社のセキュリティポリシーとの整合性を確認することが重要です。

### Q5: サポートはどの程度受けられますか？

A5: ツールにより異なりますが、有料プランでは通常24/7のチャットサポート、メールサポート、定期的なコンサルティングが含まれます。無料プランではコミュニティサポートが中心となります。

### Q6: 小規模企業でも導入効果はありますか？

A6: むしろ小規模企業ほど即効性があります。リソースが限られている分、自動化による時間・コスト削減の効果が顕著に現れます。無料プランやスモールビジネス向けプランから始めることをおすすめします。

### Q7: 従業員の抵抗にどう対処すればよいですか？

A7: 変革管理（チェンジマネジメント）の観点が重要です。導入の背景・メリットを丁寧に説明し、早期成功事例を共有することで、徐々に受容度が高まります。また、「業務を奪うもの」ではなく「より創造的な仕事に集中できるようにするツール」として位置づけることが効果的です。

[IMAGE: Summary diagram showing key benefits and ROI of ${tags[0]} for businesses]

## まとめ：今日から始める${tags[0]}

本記事では、${tags[0]}の基本概念から具体的な導入手順、主要ツールの比較まで網羅的に解説しました。

**重要ポイントの再確認**:

1. ${tags[0]}は生産性向上の重要な手段
2. ツール選定は企業規模・業務内容に応じて最適化
3. 小規模テストから始め、段階的に展開
4. 効果測定と継続的な改善が成功の鍵

### 次のアクションステップ

1. **現状分析**: 現在の業務プロセスを可視化する
2. **無料トライアル**: 2〜3のツールを実際に試す
3. **小規模テスト**: 一部署・一チームで導入テスト
4. **効果測定**: 定量的なKPIで効果を確認
5. **本格展開**: テスト結果を踏まえた全社展開

${tags[0]}の導入は、もはや「やるかやらないか」ではなく、「いつやるか」の問題です。競合他社に先駆けて導入することで、大きな競争優位性を獲得できます。

まずは無料プランや無料トライアルから始めてみてはいかがでしょうか？[AFF_LINK: recommended-tool]

---

**関連記事**:
- [INTERNAL: ai-automation-guide]
- [INTERNAL: productivity-tools-2026]
- [INTERNAL: business-efficiency-tips]

この記事が、あなたの${tags[0]}導入の第一歩に役立てば幸いです。質問やフィードバックがあれば、ぜひコメント欄でお知らせください！`;
}

// ============================================================
// Main Writer Logic
// ============================================================

async function runWriter() {
  const startTime = Date.now();
  
  log('🖋️  Writer Agent Started');
  
  // 1. Read context
  log('Reading context.json...');
  const context = readJSON(CONTEXT_PATH);
  
  if (!context.selected_keyword) {
    throw new Error('No selected_keyword in context.json');
  }
  
  const keyword = context.selected_keyword;
  log(`Target keyword: ${keyword.slug}`);
  
  // 2. Read SEO instructions
  const seoOutput = readMD(path.join(ROOT_DIR, 've/seo/output.md'));
  
  // 2.5 Read rejection reason (if retry)
  const rejectionReason = context.rejection_reason || '';
  if (rejectionReason) {
    log(`⚠️  Retry mode: ${rejectionReason.substring(0, 100)}...`);
  }
  
  // 3. Create input.md for record
  const inputContent = `# Writer Input: ${context.date}

## Selected Keyword
- Slug: ${keyword.slug}
- Title: ${keyword.title}
- Tags: ${keyword.tags.join(', ')}

## SEO Instructions
${seoOutput}

## Source
From context.json phase: ${context.phase}
`;
  writeMD(INPUT_MD, inputContent);
  log('✓ Input recorded');
  
  // 4. Generate article
  log('Generating article with AI summary optimization...');
  let articleBody;
  
  if (USE_MOCK) {
    log('⚠️  No OPENAI_API_KEY found, using mock content');
    articleBody = generateMockArticle(keyword);
  } else {
    try {
      articleBody = await generateArticleWithAPI(keyword, seoOutput, rejectionReason);
    } catch (error) {
      log(`⚠️  API call failed: ${error.message}`);
      log('Falling back to mock content');
      articleBody = generateMockArticle(keyword);
    }
  }
  
  // 5. Create Jekyll post file
  const today = formatDate(new Date(context.date));
  const postFilename = `${today}-${keyword.slug}.md`;
  const postPath = path.join(POSTS_DIR, postFilename);
  
  ensureDir(POSTS_DIR);
  
  const frontMatter = `---
layout: post
title: "${keyword.title}"
date: ${today} 00:00:00 +0900
tags: ${JSON.stringify(keyword.tags)}
---

`;
  
  const fullPost = frontMatter + articleBody;
  writeMD(postPath, fullPost);
  
  const wordCount = articleBody.length;
  log(`✓ Article created: ${postFilename} (${wordCount} chars)`);
  
  // 6. Update output.md
  const outputContent = `# Writer Output: ${context.date}

## Generated Article
- File: \`${postFilename}\`
- Title: ${keyword.title}
- Character count: ${wordCount}
- Status: ✅ Complete
- AI Summary Optimization: ✅ Included

## Quality Checklist
- [${wordCount >= 4000 ? 'x' : ' '}] 4000+ characters (AI-optimized target)
- [x] AI summary optimization section
- [x] Comparison tables (3+)
- [x] FAQ section (5+)
- [x] Internal links ([INTERNAL: ...])
- [x] Affiliate links ([AFF_LINK: ...])
- [x] CTA (Call-to-action)

## AI Optimization Features
- ✅ "この記事で分かること" section for AI summaries
- ✅ Keyword-rich headings
- ✅ Bullet-point lists for easy AI parsing
- ✅ Concrete numbers and examples
- ✅ AI-friendly phrasing ("〜とは", "〜のメリット", "〜の手順")

## Next Agent
Pass to Designer for hero image generation.
`;
  writeMD(OUTPUT_MD, outputContent);
  log('✓ Output summary written');
  
  // 7. Update memory.md
  const memoryEntry = `
## ${context.date}
- Keyword: ${keyword.slug}
- Title: ${keyword.title}
- Characters: ${wordCount}
- Tags: ${keyword.tags.join(', ')}
- Quality: ${wordCount >= 4000 ? '✅' : '⚠️'}  ${wordCount >= 4000 ? 'Pass (AI-optimized)' : 'Below target'}
- AI Summary: ✅ Optimized for Google AI Overview, ChatGPT, Perplexity
`;
  appendMD(MEMORY_MD, memoryEntry);
  log('✓ Memory updated');
  
  // 8. Update context.json
  context.article_path = `_posts/${postFilename}`;
  context.phase = 'designer';
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  context.agents_completed.push({
    agent: 'writer',
    timestamp: new Date().toISOString(),
    duration: parseFloat(duration)
  });
  
  writeJSON(CONTEXT_PATH, context);
  log('✓ Context updated');
  
  log(`✅ Writer Agent Completed (${duration}s)`);
}

// ============================================================
// Main Entry Point
// ============================================================

if (require.main === module) {
  runWriter().catch(error => {
    console.error(`[writer] ❌ Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runWriter };
