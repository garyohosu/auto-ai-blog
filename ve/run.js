#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, "..");
const VE = path.join(ROOT, "ve");
const POSTS = path.join(ROOT, "_posts");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";

const { execSync } = require("child_process");

/** WSL2 の default gateway を使って Windows 側 Ollama のURLを推定 */
function detectOllamaBaseUrl() {
  if (process.env.OLLAMA_HOST) return process.env.OLLAMA_HOST.replace(/\/$/, "");
  try {
    const gw = execSync("ip route | awk '/default/ {print $3}' | head -n1", {
      encoding: "utf8",
      timeout: 2000,
    }).trim();
    if (gw) return `http://${gw}:11434`;
  } catch (_) {}
  return "http://127.0.0.1:11434";
}

/** ローカルOllamaで本文生成（ラクダ君） */
function callLocalOllama(prompt) {
  const baseUrl = detectOllamaBaseUrl();
  const url = new URL("/api/generate", baseUrl);
  const body = JSON.stringify({
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data || "{}");
            const output = (json.response || "").trim();
            if (output && output.length > 200) {
              console.log(`[local] ✓ ollama(${OLLAMA_MODEL}): ${output.length} chars`);
              resolve(output);
              return;
            }
            reject(new Error("Ollama output too short"));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(180000, () => req.destroy(new Error("Ollama timeout")));
    req.write(body);
    req.end();
  });
}

/**
 * ローカルCLIでLLMを呼び出す（Codex/Claude/Gemini）
 * 定額サブスクリプション対応
 */
function callCLI(prompt) {
  const cliTools = [
    { name: "codex", args: ["exec", "-"] },
    { name: "claude", args: ["--print"] },
    { name: "gemini", args: [] },
  ];
  for (const { name, args } of cliTools) {
    try {
      const result = execSync([name, ...args].join(" "), {
        input: prompt,
        maxBuffer: 1024 * 1024 * 10,
        timeout: 300000,
        encoding: "utf8",
      });
      const output = result.trim();
      if (output && output.length > 200) {
        console.log(`[cli] ✓ ${name}: ${output.length} chars`);
        return output;
      }
      throw new Error("Output too short");
    } catch (err) {
      console.log(`[cli] ⚠️ ${name}: ${String(err.message || err).slice(0, 100)}`);
    }
  }
  throw new Error("All CLI tools unavailable");
}

/** JST today as YYYY-MM-DD */
function jstToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** Read a file (UTF-8) or return null */
function readFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** Ensure directory exists */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Keyword pool (used when LLM is unavailable)
// ---------------------------------------------------------------------------
// ピラー記事（各クラスターの中心となる包括ガイド）を先頭に追加
const KEYWORD_POOL = [
  { slug: "ultimate-ai-tools-guide-2026",      title: "【2026年版】AIツール完全ガイド｜用途別おすすめ30選まとめ",          tags: ["AIツール", "まとめ", "完全ガイド"] },
  { slug: "ai-productivity-complete-guide",    title: "AIで仕事効率化する方法｜生産性3倍の完全ガイド【2026年】",            tags: ["AI効率化", "生産性", "ビジネス"] },
  { slug: "ai-business-monetization-guide",    title: "AIビジネス完全ガイド｜2026年版収益化・副業から起業まで",             tags: ["AIビジネス", "収益化", "副業"] },
  { slug: "best-ai-coding-assistants", title: "【2026年】AIコーディングアシスタント おすすめ6選｜GitHub Copilot vs Cursor vs Claude Code", tags: ["AIコーディング", "GitHub Copilot", "プログラミング"] },
  { slug: "ai-presentation-tools", title: "【2026年】AIプレゼン作成ツール おすすめ5選｜Gamma・Beautiful.ai・Canvaを比較", tags: ["AIプレゼン", "Gamma", "スライド作成"] },
  { slug: "best-ai-translation-tools", title: "【2026年】AI翻訳ツール おすすめ7選｜DeepL vs Google翻訳 vs ChatGPT", tags: ["AI翻訳", "DeepL", "多言語"] },
  { slug: "ai-customer-support-chatbot-guide", title: "AIチャットボットでカスタマーサポートを自動化する方法【導入手順つき】", tags: ["AIチャットボット", "カスタマーサポート", "自動化"] },
  { slug: "best-ai-video-generators", title: "【2026年】AI動画生成ツール おすすめ6選｜Runway・Pika・Soraを徹底比較", tags: ["AI動画生成", "Runway", "Sora"] },
  { slug: "ai-seo-tools-comparison", title: "【2026年】AI搭載SEOツール おすすめ5選｜Surfer SEO・Frase・Jasperを比較", tags: ["AI SEO", "Surfer SEO", "コンテンツSEO"] },
  { slug: "how-to-automate-sns-with-ai", title: "AIでSNS運用を自動化する方法｜投稿作成からスケジュールまで完全ガイド", tags: ["SNS自動化", "AI運用", "マーケティング"] },
  { slug: "best-ai-music-generators", title: "【無料あり】AI音楽生成ツール おすすめ5選｜Suno・Udio・AIVA比較", tags: ["AI音楽", "Suno", "作曲"] },
  { slug: "ai-email-writing-tools", title: "AIでビジネスメールを自動作成｜おすすめツール5選と活用テクニック", tags: ["AIメール", "ビジネス効率化", "文章作成"] },
  { slug: "best-ai-data-analysis-tools", title: "【2026年】AIデータ分析ツール おすすめ6選｜非エンジニアでも使える", tags: ["AIデータ分析", "BI", "ノーコード"] },
  // 第2弾キーワード
  { slug: "chatgpt-api-getting-started",    title: "ChatGPT APIの使い方完全ガイド｜初心者向け入門から実践まで",            tags: ["ChatGPT API", "OpenAI", "プログラミング"] },
  { slug: "claude-api-usage-guide",         title: "Claude APIの使い方と料金｜Anthropic APIで何ができるか解説",              tags: ["Claude API", "Anthropic", "LLM"] },
  { slug: "ai-image-generator-comparison",  title: "【2026年】AI画像生成ツール比較｜Midjourney・DALL-E・Stable Diffusion", tags: ["AI画像生成", "Midjourney", "DALL-E"] },
  { slug: "best-ai-writing-assistants-2026",title: "【2026年】AI文章作成ツール おすすめ7選｜ブログ・SNS・広告コピーに",    tags: ["AI文章作成", "ライティング", "コピーライティング"] },
  { slug: "ai-chatbot-comparison-2026",     title: "【2026年版】AIチャットボット比較｜ChatGPT・Gemini・Claude・Copilot",   tags: ["AIチャットボット", "ChatGPT", "Gemini"] },
  { slug: "ai-document-summarizer-tools",   title: "AI要約ツール おすすめ5選｜PDFや長文をワンクリックで要約する方法",         tags: ["AI要約", "PDF要約", "文書処理"] },
  { slug: "how-to-use-ai-for-job-hunting",  title: "就活・転職活動にAIを活用する方法｜履歴書・面接対策まで完全ガイド",        tags: ["AI転職", "就活", "履歴書"] },
  { slug: "ai-voice-generation-tools",      title: "【2026年】AI音声合成ツール おすすめ6選｜テキスト読み上げ・ナレーション", tags: ["AI音声", "テキスト読み上げ", "ナレーション"] },
  { slug: "ai-no-code-app-builder",         title: "AIノーコードアプリ作成ツール おすすめ5選｜プログラミング不要で開発",      tags: ["ノーコード", "AIアプリ開発", "ローコード"] },
  { slug: "ai-marketing-automation-guide",  title: "AIマーケティング自動化ガイド｜メール・広告・SNSを一元管理する方法",        tags: ["AIマーケティング", "マーケティング自動化", "デジタルマーケティング"] },
  { slug: "best-ai-meeting-transcription",  title: "AI議事録作成ツール おすすめ5選｜会議の自動文字起こしと要約",              tags: ["AI議事録", "文字起こし", "会議効率化"] },
  { slug: "ai-logo-design-tools",           title: "AIロゴ作成ツール おすすめ5選｜無料で本格的なロゴをデザインする方法",       tags: ["AIロゴ", "ロゴ作成", "デザイン"] },
  // 第3弾キーワード
  { slug: "best-ai-pdf-tools-2026",         title: "【2026年】AI PDFツール おすすめ7選｜要約・翻訳・OCRまで一気に効率化",        tags: ["AI PDF", "OCR", "業務効率化"] },
  { slug: "ai-research-automation-guide",   title: "AIリサーチ自動化ガイド｜調査・要約・比較を最短で終わらせる方法",             tags: ["AIリサーチ", "自動化", "情報収集"] },
  { slug: "best-ai-note-taking-apps",       title: "AIノートアプリ比較｜議事録・メモ整理に強いおすすめ6選【2026年版】",          tags: ["AIノート", "メモ", "議事録"] },
  { slug: "ai-resume-coverletter-tools",    title: "履歴書・職務経歴書をAIで作る方法｜転職で使える実践ツール6選",               tags: ["履歴書", "職務経歴書", "AI転職"] },
  { slug: "best-ai-landing-page-builders",  title: "AIランディングページ作成ツール比較｜CVR改善に効くおすすめ5選",             tags: ["LP作成", "CVR", "AIマーケ"] },
  { slug: "ai-youtube-script-tools",        title: "YouTube台本をAIで作る方法｜企画・構成・原稿作成の完全ガイド",               tags: ["YouTube", "台本作成", "動画マーケ"] },
  { slug: "ai-ecommerce-copywriting",       title: "EC商品説明文をAIで量産する方法｜売れるコピー作成テンプレ付き",               tags: ["EC", "商品説明", "コピーライティング"] },
  { slug: "best-ai-prompt-management-tools",title: "プロンプト管理ツールおすすめ5選｜AI活用を再現可能にする運用術",               tags: ["プロンプト", "ナレッジ管理", "AI活用"] },
  { slug: "ai-workflow-automation-no-code", title: "ノーコードで作るAI業務フロー自動化｜Zapier・Make活用ガイド",                tags: ["ノーコード", "Zapier", "業務自動化"] },
  { slug: "ai-customer-review-analysis",    title: "口コミ分析をAIで自動化する方法｜感情分析で改善点を見える化",                 tags: ["口コミ分析", "感情分析", "CX改善"] },
  { slug: "best-ai-calendar-scheduling",    title: "AI日程調整ツール比較｜会議設定を自動化して調整ストレスを減らす",               tags: ["日程調整", "会議", "生産性"] },
  { slug: "ai-podcast-production-tools",    title: "AIポッドキャスト制作ツールおすすめ6選｜台本・編集・配信を効率化",             tags: ["ポッドキャスト", "音声編集", "AI音声"] },
  // 第4弾キーワード
  { slug: "chatgpt-prompt-engineering-guide",  title: "ChatGPTプロンプトエンジニアリング完全ガイド｜精度を上げる書き方と実例",       tags: ["プロンプトエンジニアリング", "ChatGPT", "AI活用術"] },
  { slug: "ai-language-learning-apps",         title: "AI語学学習アプリ おすすめ7選｜英語・中国語を最短でマスターする方法",          tags: ["AI語学学習", "英語学習", "語学アプリ"] },
  { slug: "ai-personal-finance-advisor",       title: "AI家計管理・資産運用ツール おすすめ5選｜お金の悩みをAIで解決",               tags: ["AI資産運用", "家計管理", "節約"] },
  { slug: "ai-project-management-tools",       title: "AIプロジェクト管理ツール おすすめ6選｜タスク自動化で納期を守る方法",           tags: ["AIプロジェクト管理", "タスク管理", "業務効率化"] },
  { slug: "ai-hr-recruitment-tools",           title: "AI採用・人事ツール おすすめ5選｜選考を自動化して採用コストを削減",             tags: ["AI採用", "人事", "HR Tech"] },
  { slug: "ai-travel-planning-tools",          title: "AI旅行計画ツール おすすめ5選｜旅程・ホテル・予算を自動で最適化",              tags: ["AI旅行", "旅行計画", "観光"] },
  { slug: "ai-for-teachers-education",         title: "先生・教育者向けAI活用ガイド｜授業準備・採点・教材作成を効率化する方法",        tags: ["AI教育", "EdTech", "授業効率化"] },
  { slug: "best-ai-health-fitness-apps",       title: "AIヘルスケア・フィットネスアプリ おすすめ6選｜健康管理をAIに任せる",          tags: ["AIヘルスケア", "フィットネス", "健康管理"] },
  { slug: "ai-news-summarizer-tools",          title: "AIニュース要約ツール おすすめ5選｜情報収集の時間を9割削減する方法",            tags: ["AIニュース", "情報収集", "要約"] },
  { slug: "ai-interior-design-tools",          title: "AIインテリアデザインツール おすすめ5選｜部屋のレイアウトをAIで可視化",         tags: ["AIインテリア", "部屋づくり", "デザイン"] },
  { slug: "best-ai-social-media-analytics",    title: "AIソーシャルメディア分析ツール おすすめ5選｜伸びるSNS運用の秘訣",             tags: ["SNS分析", "AIマーケ", "ソーシャルメディア"] },
  { slug: "ai-legal-document-tools",           title: "AI法律・契約書ツール おすすめ5選｜契約書レビューを自動化してリスクを減らす",    tags: ["AI法律", "契約書", "リーガルテック"] },
  { slug: "ai-recipe-meal-planning",           title: "AI料理レシピ・献立計画アプリ おすすめ5選｜食費を減らして栄養バランスを改善",   tags: ["AIレシピ", "献立", "食費節約"] },
  { slug: "best-ai-3d-modeling-tools",         title: "AI 3Dモデリングツール おすすめ5選｜テキストから3Dオブジェクトを自動生成",      tags: ["AI 3D", "3Dモデリング", "デザイン"] },
  { slug: "ai-real-estate-tools",              title: "AI不動産ツール おすすめ5選｜物件探しから価格査定まで自動化する方法",           tags: ["AI不動産", "物件探し", "不動産投資"] },
  { slug: "ai-customer-segmentation-tools",    title: "AI顧客分析・セグメンテーションツール おすすめ5選｜売上を伸ばすデータ活用法",    tags: ["AI顧客分析", "マーケティング", "データ活用"] },
  { slug: "ai-accessibility-tools",            title: "AIアクセシビリティツール おすすめ5選｜障害者支援・ユニバーサルデザインに活用",  tags: ["AIアクセシビリティ", "UX", "ユニバーサルデザイン"] },
  { slug: "ai-startup-tools-guide",            title: "スタートアップ・起業家向けAIツール完全ガイド｜コスト0で始めるAI経営",          tags: ["AI起業", "スタートアップ", "副業"] },
  { slug: "ai-content-repurposing-tools",      title: "AIコンテンツ再利用ツール おすすめ5選｜1本の記事を10種のコンテンツに変換",      tags: ["コンテンツ再利用", "AI効率化", "マーケ"] },
  { slug: "best-ai-cybersecurity-tools",       title: "AIサイバーセキュリティツール おすすめ5選｜脅威検出・対策を自動化する方法",     tags: ["AIセキュリティ", "サイバー攻撃", "情報セキュリティ"] },
  // 第5弾キーワード（在庫補充）
  { slug: "ai-agent-observability-tools",      title: "AIエージェント運用の可観測性ツール比較｜失敗検知・再実行を仕組み化する",         tags: ["AIエージェント", "可観測性", "運用監視"] },
  { slug: "ai-github-actions-automation",      title: "GitHub ActionsをAIで自動化する方法｜CI/CD運用を軽くする実践ガイド",            tags: ["GitHub Actions", "CI/CD", "AI自動化"] },
  { slug: "ai-small-business-ops",             title: "小規模事業の業務をAIで回す方法｜1人運用でも回る仕組みづくり",                 tags: ["業務自動化", "中小企業", "AI活用"] },
  { slug: "ai-knowledge-base-tools",           title: "AIナレッジベース構築ツールおすすめ6選｜社内知見を検索可能にする",             tags: ["ナレッジベース", "社内FAQ", "情報整理"] },
  { slug: "ai-customer-onboarding-automation", title: "AIで顧客オンボーディングを自動化する方法｜離脱を減らす導入設計",             tags: ["オンボーディング", "SaaS", "顧客体験"] },
  { slug: "ai-sales-prospecting-tools",        title: "AI営業リスト作成ツール比較｜見込み客探索を効率化する実践手順",               tags: ["営業DX", "リード獲得", "AI営業"] },
  { slug: "ai-email-newsletter-workflow",      title: "AIでニュースレター運用を自動化する方法｜企画・執筆・配信まで",               tags: ["ニュースレター", "メールマーケ", "自動化"] },
  { slug: "ai-product-roadmap-planning",       title: "AIでプロダクトロードマップを作る方法｜意思決定を速くする運用術",             tags: ["プロダクト管理", "ロードマップ", "意思決定"] },
  { slug: "ai-community-management-tools",     title: "AIコミュニティ運用ツールおすすめ5選｜投稿分析とモデレーション効率化",         tags: ["コミュニティ運用", "モデレーション", "SNS"] },
  { slug: "ai-bug-triage-workflow",            title: "AIでバグトリアージを自動化する方法｜Issue分類と優先度付けを最適化",           tags: ["バグ管理", "Issue運用", "開発効率"] },
  { slug: "ai-research-assistant-for-devs",    title: "開発者向けAIリサーチアシスタント活用法｜技術調査を最短で終わらせる",          tags: ["開発者向け", "技術調査", "AIアシスタント"] },
  { slug: "ai-content-qa-automation",          title: "AIでコンテンツ品質チェックを自動化する方法｜誤情報・重複・体裁を防ぐ",         tags: ["品質管理", "コンテンツ運用", "ファクトチェック"] },
  { slug: "ai-dashboard-reporting-tools",      title: "AIダッシュボード作成ツール比較｜週次レポートを自動生成する",                 tags: ["ダッシュボード", "レポート自動化", "BI"] },
  { slug: "ai-support-ticket-routing",         title: "AIでサポートチケット振り分けを自動化する方法｜一次対応を高速化",             tags: ["カスタマーサポート", "チケット管理", "自動分類"] },
  { slug: "ai-work-documentation-tools",       title: "AIドキュメント整備ツールおすすめ5選｜手順書・運用記録を継続可能にする",       tags: ["ドキュメント", "運用設計", "ナレッジ共有"] },
  // 第6弾キーワード（在庫補充）
  { slug: "ai-runbook-automation",             title: "AIで運用Runbookを自動化する方法｜障害対応を標準化して属人化を防ぐ",             tags: ["運用Runbook", "障害対応", "標準化"] },
  { slug: "ai-release-notes-generator",        title: "AIでリリースノートを自動生成する方法｜開発更新の共有を高速化",                 tags: ["リリースノート", "開発運用", "自動生成"] },
  { slug: "ai-internal-helpdesk-tools",        title: "社内ヘルプデスクをAIで効率化する方法｜問い合わせ削減と回答速度向上",             tags: ["社内ヘルプデスク", "情シス", "業務改善"] },
  { slug: "ai-procurement-ops",                title: "AIで調達業務を効率化する方法｜見積比較・発注管理・コスト最適化",               tags: ["調達", "購買", "コスト削減"] },
  { slug: "ai-sop-builder-tools",              title: "AI手順書作成ツール比較｜SOP整備を高速化して教育コストを下げる",                 tags: ["SOP", "手順書", "教育"] },
  { slug: "ai-meeting-minutes-workflow",       title: "AI議事録自動化ワークフロー｜会議後の整理と共有を最短にする",                   tags: ["議事録", "会議効率化", "自動化"] },
  { slug: "ai-vendor-monitoring-tools",        title: "AIで外注・ベンダー管理を見える化する方法｜納期遅延と品質ばらつきを減らす",       tags: ["ベンダー管理", "外注管理", "品質管理"] },
  { slug: "ai-employee-handbook-tools",        title: "AIで社内規程・ハンドブックを整備する方法｜更新漏れを防いで検索性を高める",       tags: ["社内規程", "ハンドブック", "情報整備"] },
  { slug: "ai-inbox-triage-workflow",          title: "AIでメール受信箱を整理する方法｜重要返信の見落としを防ぐトリアージ術",           tags: ["メール整理", "Inbox Zero", "業務効率"] },
  { slug: "ai-renewal-reminder-system",        title: "AI更新リマインダー設計｜契約・ドメイン・サブスクの期限切れを防ぐ",             tags: ["更新管理", "サブスク管理", "契約管理"] },
  { slug: "ai-changelog-automation",           title: "AIで変更履歴を自動生成する方法｜開発と運用の情報差分を埋める",                 tags: ["変更履歴", "changelog", "開発情報共有"] },
  { slug: "ai-small-team-knowledge-ops",       title: "少人数チームのナレッジ運用をAIで回す方法｜情報散逸を止める実践ルール",         tags: ["ナレッジ運用", "小規模チーム", "情報共有"] },
  { slug: "ai-backoffice-automation-stack",    title: "バックオフィスをAIで自動化するツール構成｜経理・総務・労務の負担を減らす",       tags: ["バックオフィス", "経理", "総務"] },
  { slug: "ai-risk-log-management",            title: "AIリスクログ管理の始め方｜障害・監査・運用ミスを横断で記録する",               tags: ["リスク管理", "監査対応", "運用改善"] },
  { slug: "ai-postmortem-writing-tools",       title: "AIで障害ポストモーテムを書く方法｜再発防止を形骸化させない記録術",             tags: ["ポストモーテム", "障害分析", "再発防止"] },
];

// ---------------------------------------------------------------------------
// Hero image generation (OpenAI Images API)
// ---------------------------------------------------------------------------
const ASSETS_IMAGES = path.join(ROOT, "assets", "images");

// ---------------------------------------------------------------------------
// Image prompt diversity: 6 visual styles × title-based visual hints
// ---------------------------------------------------------------------------
const IMAGE_STYLE_TEMPLATES = [
  (topic, el) =>
    `Modern flat illustration, blog hero image, ${el ? "featuring " + el + ", about " + topic : "about " + topic}, ` +
    `clean geometric shapes, blue and purple color palette, professional tech blog, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Isometric 3D illustration, blog thumbnail, ${el ? topic + " with " + el : topic}, ` +
    `vibrant emerald and teal colors, soft shadows, detailed icons, modern tech style, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Abstract gradient mesh background in warm orange and red tones, blog hero image, ` +
    `${el ? "floating " + el + " icons, " : ""}representing ${topic}, ` +
    `dynamic composition, modern design, professional, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Futuristic neon tech illustration, blog header, ${el ? topic + " featuring " + el : topic}, ` +
    `cyan and indigo neon accents, dark background, circuit board patterns, glowing details, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Clean vector illustration on white background, blog header image, ` +
    `${el ? topic + " concept with " + el : topic}, ` +
    `sky blue and amber accent colors, minimal friendly icons, editorial style, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,

  (topic, el) =>
    `Bold colorful editorial illustration, blog thumbnail, ${el ? topic + " theme with " + el : topic}, ` +
    `vibrant pink and yellow color blocking, modern graphic design, eye-catching composition, ` +
    `no text, no letters, 16:9 aspect ratio, high quality`,
];

// Map title keywords to specific visual element hints
const TITLE_VISUAL_HINTS = [
  [/ChatGPT/i,                    "chat interface and conversation bubbles"],
  [/Claude/i,                     "AI assistant interface with clean UI"],
  [/Copilot|Cursor/i,             "code editor with AI autocomplete suggestions"],
  [/プレゼン/,                      "presentation slides and bar charts"],
  [/翻訳/,                         "translation arrows between language speech bubbles"],
  [/コーディング|プログラミング/,        "code blocks and terminal window"],
  [/議事録|会議/,                    "meeting room setup and speech bubbles"],
  [/画像生成/,                      "colorful art canvases and digital paintbrush"],
  [/文章|ライティング/,               "document pages and writing pen"],
  [/動画/,                         "video player timeline and film frames"],
  [/音楽/,                         "music notes and sound waveforms"],
  [/メール/,                        "email envelope and inbox UI"],
  [/データ分析/,                     "charts, graphs, and data visualizations"],
  [/SEO/,                         "search bar, magnifier, and ranking arrows"],
  [/SNS/,                         "social media feed icons and share buttons"],
  [/稼ぐ|副業|収益/,                  "rising profit chart and coin stack"],
];

/** Pick array item deterministically by slug (reproducible per article) */
function pickBySlug(slug, arr) {
  const hash = slug.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return arr[hash % arr.length];
}

/** Build a diverse image prompt for the given keyword */
function buildImagePrompt(keyword) {
  const template = pickBySlug(keyword.slug, IMAGE_STYLE_TEMPLATES);
  let visualElement = null;
  for (const [pattern, hint] of TITLE_VISUAL_HINTS) {
    if (pattern.test(keyword.title)) {
      visualElement = hint;
      break;
    }
  }
  return template(keyword.title, visualElement);
}

async function generateHeroImage(date, keyword) {
  if (!OPENAI_API_KEY) return null;

  ensureDir(ASSETS_IMAGES);
  const filename = `${date}-${keyword.slug}.png`;
  const filepath = path.join(ASSETS_IMAGES, filename);

  if (fs.existsSync(filepath)) {
    console.log(`[skip] image already exists: ${filename}`);
    return `/assets/images/${filename}`;
  }

  const prompt = buildImagePrompt(keyword);
  console.log(`[image] style: template-${pickBySlug(keyword.slug, IMAGE_STYLE_TEMPLATES).name || "?"}`);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
    });

    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/images/generations",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data[0] && json.data[0].b64_json) {
              const buffer = Buffer.from(json.data[0].b64_json, "base64");
              fs.writeFileSync(filepath, buffer);
              console.log(`[created] image: ${filename}`);
              resolve(`/assets/images/${filename}`);
            } else {
              reject(new Error(`Image API error: ${data.slice(0, 300)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Topic clusters (#5) — ピラー記事とサテライト記事の関係を定義
// ---------------------------------------------------------------------------
const TOPIC_CLUSTERS = {
  "ai-tools": {
    pillar: "ultimate-ai-tools-guide-2026",
    satellites: [
      "chatgpt-vs-claude-comparison", "best-ai-coding-assistants",
      "best-ai-writing-tools", "best-free-ai-image-generators",
      "ai-presentation-tools", "best-ai-translation-tools",
      "best-ai-video-generators",
    ],
  },
  "ai-productivity": {
    pillar: "ai-productivity-complete-guide",
    satellites: [
      "best-ai-meeting-tools-comparison", "ai-email-writing-tools",
      "how-to-automate-sns-with-ai", "best-ai-data-analysis-tools",
    ],
  },
  "ai-business": {
    pillar: "ai-business-monetization-guide",
    satellites: [
      "how-to-make-money-with-ai", "ai-seo-tools-comparison",
      "best-ai-music-generators",
    ],
  },
};

// ---------------------------------------------------------------------------
// Internal link resolution (#6) — [INTERNAL: slug] を実リンクに変換
// ---------------------------------------------------------------------------

/** _posts/ をスキャンして slug → {title, url} のインデックスを構築 */
function buildPostIndex() {
  if (!fs.existsSync(POSTS)) return {};
  const index = {};
  const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const m = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
    if (!m) continue;
    const [, year, month, day, slug] = m;
    const raw = readFile(path.join(POSTS, file)) || "";
    const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    const title = titleMatch ? titleMatch[1] : slug;
    index[slug] = { title, url: `/${year}/${month}/${day}/${slug}/` };
  }
  return index;
}

/** [INTERNAL: slug] を [title](url) に置換 */
function resolveInternalLinks(content, postIndex) {
  return content.replace(/\[INTERNAL:\s*([^\]]+)\]/g, (match, slug) => {
    const post = postIndex[slug.trim()];
    return post ? `[${post.title}](${post.url})` : match;
  });
}

/** クラスター内の関連記事セクションを末尾に追加 */
function buildRelatedSection(keyword, postIndex) {
  const relatedSlugs = [];
  for (const cluster of Object.values(TOPIC_CLUSTERS)) {
    const all = [cluster.pillar, ...cluster.satellites];
    if (all.includes(keyword.slug)) {
      all.filter((s) => s !== keyword.slug && postIndex[s])
        .slice(0, 4)
        .forEach((s) => relatedSlugs.push(s));
      break;
    }
  }
  if (relatedSlugs.length === 0) return "";
  const links = relatedSlugs
    .map((s) => `- [${postIndex[s].title}](${postIndex[s].url})`)
    .join("\n");
  return `\n\n## 関連記事\n\n${links}\n`;
}

// ---------------------------------------------------------------------------
// LLM article generation (CLI tools first, OpenAI API as fallback)
// ---------------------------------------------------------------------------
function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) {
      reject(new Error("OPENAI_API_KEY not set"));
      return;
    }

    const body = JSON.stringify({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].message) {
              resolve(json.choices[0].message.content);
            } else {
              reject(new Error(`API error: ${data.slice(0, 200)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function generateArticleWithLLM(keyword) {
  // ローカルCLI（定額）を優先、フォールバックでOpenAI API
  const prompt = `あなたはSEOに精通したプロのブログライターです。以下のキーワードで、収益化を意識した高品質な日本語ブログ記事を書いてください。

タイトル: ${keyword.title}
タグ: ${keyword.tags.join(", ")}

記事の要件:
- 3000〜5000字程度
- 導入（誰のどんな悩みか）
- 本文（比較表、具体的な手順、ツール紹介）
- FAQ（3〜5問）
- まとめ（次のアクション・CTA）
- アフィリエイトリンクのプレースホルダーを [AFF_LINK: product_name] 形式で入れる
- 内部リンクのプレースホルダーを [INTERNAL: slug] 形式で入れる
- Jekyll の front matter は不要（本文のみ出力）
- evergreen（長期的に検索される）内容にする
- ニュース的な短命コンテンツは避ける

本文のみを出力してください。`;

  // 1. ローカルOllama（無料）を優先
  try {
    return await callLocalOllama(prompt);
  } catch (localErr) {
    console.log(`[llm] local ollama unavailable: ${localErr.message}`);
  }

  // 2. ローカルCLI（定額）
  try {
    return callCLI(prompt);
  } catch (cliErr) {
    console.log(`[llm] CLI unavailable: ${cliErr.message}`);
  }

  // 3. OpenAI API（最終フォールバック）
  return await callOpenAI(prompt);
}

// ---------------------------------------------------------------------------
// Pick today's keyword (avoid duplicates with existing posts)
// ---------------------------------------------------------------------------
function pickKeyword(date) {
  const existingFiles = fs.existsSync(POSTS)
    ? fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"))
    : [];

  for (const kw of KEYWORD_POOL) {
    const alreadyExists = existingFiles.some((f) => f.includes(kw.slug));
    if (!alreadyExists) return kw;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Create daily log  (ve/logs/YYYY-MM-DD.md)
// ---------------------------------------------------------------------------
function createDailyLog(date, articleTitle) {
  const logsDir = path.join(VE, "logs");
  ensureDir(logsDir);
  const logFile = path.join(logsDir, `${date}.md`);
  if (fs.existsSync(logFile)) {
    console.log(`[skip] log already exists: ${logFile}`);
    return false;
  }

  const content = `# Daily Log: ${date}

## What was done
- Published article: "${articleTitle || "daily note"}"
- Updated metrics and state files

## Reasoning
- Prioritized buyer-intent evergreen content for monetization
- Selected topic based on keyword pool to avoid duplication

## Metrics observed
- new_posts: 1
- gsc_clicks: -
- gsc_impr: -
- avg_pos: -
- ga_users: -
- revenue: -

## Next action
- Continue publishing buyer-intent articles from keyword pool
`;
  fs.writeFileSync(logFile, content, "utf8");
  console.log(`[created] ${logFile}`);
  return true;
}

// ---------------------------------------------------------------------------
// 2. Create article post
// ---------------------------------------------------------------------------
function createFallbackArticle(date, keyword, imagePath) {
  const imageField = imagePath ? `\nimage: ${imagePath}` : "";
  const frontMatter = `---
layout: post
title: "${keyword.title}"
date: ${date}
categories: [ai-tools, comparison]
tags: [${keyword.tags.join(", ")}]
description: "${keyword.title}について詳しく解説します。"
lang: ja${imageField}
---`;

  const body = `## はじめに

本記事では「${keyword.title.replace(/【.*?】/, "")}」について詳しく解説します。

AIツールは日々進化しており、最適なツール選びが重要になっています。本記事では主要なツールの特徴・料金・使い方を比較し、あなたに合った選択をサポートします。

---

*この記事は随時更新していきます。最新情報をお見逃しなく。*

[AFF_LINK: chatgpt-plus]
[AFF_LINK: claude-pro]
`;

  return `${frontMatter}\n\n${body}`;
}

async function createArticlePost(date, keyword) {
  ensureDir(POSTS);
  const postFile = path.join(POSTS, `${date}-${keyword.slug}.md`);
  if (fs.existsSync(postFile)) {
    console.log(`[skip] post already exists: ${postFile}`);
    return { created: false, title: keyword.title };
  }

  // Generate hero image first (non-blocking on failure)
  let imagePath = null;
  if (OPENAI_API_KEY) {
    try {
      console.log(`[image] Generating hero image for: ${keyword.slug}`);
      imagePath = await generateHeroImage(date, keyword);
    } catch (err) {
      console.log(`[image] Failed: ${err.message}, continuing without image`);
    }
  }

  let content;

  // Try LLM generation (CLI tools first, OpenAI API as fallback)
  try {
    console.log(`[llm] Generating article (CLI → OpenAI fallback)...`);
    const body = await generateArticleWithLLM(keyword);
    const imageField = imagePath ? `\nimage: ${imagePath}` : "";
    const frontMatter = `---
layout: post
title: "${keyword.title}"
date: ${date}
categories: [ai-tools, comparison]
tags: [${keyword.tags.join(", ")}]
description: "${keyword.title}について詳しく解説します。"
lang: ja${imageField}
---`;
    content = `${frontMatter}\n\n${body}`;
    console.log(`[llm] Article generated successfully`);
  } catch (err) {
    console.log(`[llm] Failed: ${err.message}, falling back to template`);
    content = createFallbackArticle(date, keyword, imagePath);
  }

  // Resolve [INTERNAL: slug] → actual links, append related posts section
  const postIndex = buildPostIndex();
  content = resolveInternalLinks(content, postIndex);
  content += buildRelatedSection(keyword, postIndex);

  fs.writeFileSync(postFile, content, "utf8");
  console.log(`[created] ${postFile}`);
  return { created: true, title: keyword.title };
}

// ---------------------------------------------------------------------------
// 3. Generate content support pack (titles/outline/faq/internal links)
// ---------------------------------------------------------------------------
function generateContentSupportPack(date, keyword) {
  if (!keyword) return;

  const plansDir = path.join(VE, "plans");
  ensureDir(plansDir);
  const outFile = path.join(plansDir, `${date}-content-pack.md`);

  const baseTitle = keyword.title
    .replace(/【2026年版】|【2026年】/g, "")
    .split("｜")[0]
    .trim();

  const titleIdeas = [
    `${baseTitle}の始め方｜失敗しない導入手順とおすすめツール`,
    `${baseTitle}を最短で実践する方法｜初心者向けチェックリスト`,
    `${baseTitle}の比較ガイド｜目的別に選ぶべきサービス`,
    `${baseTitle}で業務効率を上げるコツ｜現場で使えるテンプレ付き`,
    `${baseTitle}の費用対効果を検証｜無料プランでも使える？`,
    `${baseTitle}導入でよくある失敗と対策10選`,
    `${baseTitle}をチーム運用する方法｜ルール設計とKPI例`,
    `${baseTitle}のセキュリティ注意点｜安全に運用するための実務`,
    `${baseTitle}で成果を出すプロンプト設計｜再現性を高めるポイント`,
    `${baseTitle}の最新トレンド｜2026年に押さえるべき変化`,
  ];

  const outline = [
    "## はじめに",
    "## このテーマで解決できる課題",
    "## 失敗しない選び方（比較軸）",
    "## おすすめツール/手法5選",
    "## 導入手順（今日からできる）",
    "## 運用のコツ（KPI・体制・頻度）",
    "## よくある失敗と対策",
    "## まとめ",
  ];

  const faq = [
    "Q. 無料プランだけでも実運用できますか？\nA. 小規模運用なら可能ですが、継続運用では制限に注意が必要です。",
    "Q. 導入に必要な期間はどれくらいですか？\nA. 小さく始めれば1日で検証、1〜2週間で運用定着が目安です。",
    "Q. まず何から始めるべきですか？\nA. 目的を1つに絞り、最小のワークフローを作って効果測定します。",
    "Q. 品質を保つコツは？\nA. テンプレート化・レビュー基準・定期見直しの3点を固定化します。",
    "Q. セキュリティ面での注意点は？\nA. 機密データの投入制限、権限分離、ログ監査を必ず実施してください。",
    "Q. ROIはどう測定しますか？\nA. 作業時間削減・CVR改善・運用コストの3軸で追うのが有効です。",
  ];

  const postIndex = buildPostIndex();
  const internalLinks = Object.entries(postIndex).slice(-8).reverse();

  let md = `# Content Support Pack (${date})\n\n`;
  md += `- Seed keyword: \`${keyword.slug}\`\n`;
  md += `- Seed title: ${keyword.title}\n\n`;

  md += "## タイトル案10本\n";
  titleIdeas.forEach((t, i) => { md += `${i + 1}. ${t}\n`; });

  md += "\n## 見出し構成案\n";
  outline.forEach((h) => { md += `- ${h}\n`; });

  md += "\n## FAQ草案\n";
  faq.forEach((q) => { md += `- ${q}\n`; });

  md += "\n## 内部リンク候補\n";
  internalLinks.forEach(([slug, post]) => {
    md += `- [${post.title}](${post.url}) (slug: \`${slug}\`)\n`;
  });

  fs.writeFileSync(outFile, md, "utf8");
  console.log(`[created] ${outFile}`);
}

// ---------------------------------------------------------------------------
// 4. Append row to ve/metrics.md
// ---------------------------------------------------------------------------
function appendMetrics(date, newPosts) {
  const metricsFile = path.join(VE, "metrics.md");
  const current = readFile(metricsFile) || "";

  if (current.includes(`| ${date} `)) {
    console.log(`[skip] metrics row for ${date} already exists`);
    return;
  }

  let totalPosts = 100;
  try {
    const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"));
    totalPosts = 100 + files.length;
  } catch {
    // _posts may not exist yet
  }

  const row = `| ${date} | ${newPosts} | ${totalPosts} | - | - | - | - | - |\n`;
  fs.writeFileSync(metricsFile, current + row, "utf8");
  console.log(`[updated] metrics.md += ${date}`);
}

// ---------------------------------------------------------------------------
// 4. Update ve/state.md
// ---------------------------------------------------------------------------
function updateState(date, keyword) {
  const stateFile = path.join(VE, "state.md");
  const nextKeyword = pickNextKeyword(keyword);
  const content = `# state
- phase: publishing
- today_objective: publish "${keyword ? keyword.title : "daily content"}"
- focus_cluster: ai-tools
- blockers: -
- next_run: ${nextKeyword ? `publish article: ${nextKeyword.slug}` : "replenish keyword pool"}
`;
  fs.writeFileSync(stateFile, content, "utf8");
  console.log(`[updated] state.md`);
}

function pickNextKeyword(currentKeyword) {
  const existingFiles = fs.existsSync(POSTS)
    ? fs.readdirSync(POSTS).filter((f) => f.endsWith(".md"))
    : [];

  for (const kw of KEYWORD_POOL) {
    if (currentKeyword && kw.slug === currentKeyword.slug) continue;
    const alreadyExists = existingFiles.some((f) => f.includes(kw.slug));
    if (!alreadyExists) return kw;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Update ve/todo.md
// ---------------------------------------------------------------------------
function updateTodo(date, keyword) {
  const todoFile = path.join(VE, "todo.md");
  let content = readFile(todoFile);
  if (!content) return;

  const todayMatch = content.match(/## Today\n([\s\S]*?)(?=\n## )/);
  if (todayMatch && !todayMatch[1].includes("(empty)")) {
    // Replace Today with current task
    content = content.replace(
      /## Today\n[\s\S]*?(?=\n## Done)/,
      `## Today\n- Publish: ${keyword ? keyword.slug : "daily content"}\n\n`
    );
  }

  // Append to Done
  if (!content.includes(`[${date}]`)) {
    content = content.replace(
      /## Done \(append-only\)\n/,
      `## Done (append-only)\n- [${date}] published: ${keyword ? keyword.slug : "daily content"}\n`
    );
  }

  fs.writeFileSync(todoFile, content, "utf8");
  console.log(`[updated] todo.md`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const date = jstToday();
  console.log(`\n=== Virtual Employee Run: ${date} (JST) ===\n`);

  // Ensure directories
  ensureDir(path.join(VE, "logs"));
  ensureDir(path.join(VE, "templates"));
  ensureDir(POSTS);
  ensureDir(ASSETS_IMAGES);

  // Pick keyword for today
  const keyword = pickKeyword(date);
  let newPosts = 0;
  let articleTitle = "";

  if (keyword) {
    console.log(`[keyword] Selected: ${keyword.slug}`);
    const result = await createArticlePost(date, keyword);
    newPosts = result.created ? 1 : 0;
    articleTitle = result.title;
  } else {
    console.log(`[info] All keywords exhausted, skipping post creation`);
  }

  generateContentSupportPack(date, keyword);
  createDailyLog(date, articleTitle);
  appendMetrics(date, newPosts);
  updateState(date, keyword);
  updateTodo(date, keyword);

  console.log(`\n=== Run complete ===\n`);
}

main().catch((err) => {
  console.error(`[fatal] ${err.message}`);
  process.exit(1);
});
