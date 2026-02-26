#!/usr/bin/env bash
# run-local.sh — ローカルPCでの定額実行スクリプト
# Codex CLI からのキック用エントリーポイント
#
# 使い方:
#   bash run-local.sh            # 通常実行
#   bash run-local.sh --no-push  # git push を省略（デバッグ用）
#
# 必要ツール（いずれか1つ以上）:
#   - claude CLI (Claude Code) : https://claude.ai/download
#   - gemini CLI               : https://github.com/google-gemini/gemini-cli
# オプション:
#   - OPENAI_API_KEY 環境変数が設定されていれば画像生成にも使用

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

NO_PUSH=false
for arg in "$@"; do
  [[ "$arg" == "--no-push" ]] && NO_PUSH=true
done

echo ""
echo "=============================================="
echo "  Auto AI Blog — Local Runner"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=============================================="
echo ""

# LLMツール確認
if command -v claude &>/dev/null; then
  echo "[info] Claude CLI: OK"
elif command -v gemini &>/dev/null; then
  echo "[info] Gemini CLI: OK"
elif [ -n "$OPENAI_API_KEY" ]; then
  echo "[info] OpenAI API key: OK (fallback)"
else
  echo "[warn] No LLM tool found. Install claude or gemini CLI."
  echo "       Template articles will be generated instead."
fi

# Node.js 確認
if ! command -v node &>/dev/null; then
  echo "[error] Node.js not found. Please install Node.js."
  exit 1
fi

echo ""
echo "--- Step 1: Running orchestrator ---"
node ve/orchestrator.js

echo ""
echo "--- Step 2: Lint & fix image paths ---"
if ls _posts/*.md 2>/dev/null | head -1 >/dev/null 2>&1; then
  grep -rl "image:.*\/auto-ai-blog\/assets" _posts/ 2>/dev/null | while read -r f; do
    sed -i 's|image: \(.*\)/auto-ai-blog/assets/|image: \1/assets/|g' "$f"
    echo "  fixed: $f"
  done
fi

if $NO_PUSH; then
  echo ""
  echo "[info] --no-push: skipping git commit/push"
  echo ""
  echo "=============================================="
  echo "  Done! (dry run)"
  echo "=============================================="
  exit 0
fi

echo ""
echo "--- Step 3: Git commit & push ---"
git config user.name  "virtual-employee-bot" 2>/dev/null || true
git config user.email "virtual-employee-bot@users.noreply.github.com" 2>/dev/null || true
git add _posts/ ve/ assets/ 2>/dev/null || git add -A
if git diff --cached --quiet; then
  echo "[info] No changes to commit"
else
  git commit -m "ve: daily run $(date -u +%F)"
  git push
  echo "[info] Pushed to remote"
fi

echo ""
echo "=============================================="
echo "  Done!"
echo "  Jekyll deploy will trigger automatically"
echo "  via GitHub Actions (push to main)."
echo "=============================================="
echo ""
