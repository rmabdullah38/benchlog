#!/usr/bin/env bash
# One-shot: install, build, deploy to Firebase, and (first time) publish the GitHub repo.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Missing .env (copy .env.example and fill it in)"; exit 1; }

npm install
npm run build

FB="npx --yes firebase-tools@latest"
$FB projects:list >/dev/null 2>&1 || $FB login
$FB deploy --project benchlog-e9484 --only hosting,firestore,remoteconfig

if [ ! -d .git ]; then
  git init -b main
  git add -A
  git commit -m "BenchLog: offline-first lab notebook with Firebase AI Logic hybrid inference"
fi

if command -v gh >/dev/null 2>&1; then
  if ! git remote get-url origin >/dev/null 2>&1; then
    gh repo create benchlog --public --source=. --remote=origin --push \
      --description "Offline-first lab notebook: Gemini Nano on-device + Gemini cloud via Firebase AI Logic hybrid inference"
  else
    git add -A && git commit -m "Update" || true
    git push
  fi
else
  echo "GitHub CLI (gh) not found. Install it with 'brew install gh', run 'gh auth login', then re-run this script."
fi
echo "Live at https://benchlog-e9484.web.app"
