#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# eas-setup-and-build.sh
#
# Runs eas init for both Daari apps and kicks off preview Android builds.
# Run AFTER `eas login` succeeds.
#
# Preview builds produce installable APKs — perfect for testing on a real
# phone or BlueStacks without going through Google Play. Production AABs
# come next once we're happy.
#
# Usage:
#   cd /Users/ahmedalani/Downloads/maa-platform
#   bash scripts/eas-setup-and-build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# 1. Sanity checks
command -v eas >/dev/null || { echo "❌ eas CLI not installed. Run: npm i -g eas-cli"; exit 1; }
eas whoami >/dev/null 2>&1 || { echo "❌ Not logged in to Expo. Run: eas login"; exit 1; }

OWNER=$(eas whoami)
echo "✓ Authenticated as @$OWNER"
echo ""

# 2. eas init + build for each app
for app in mobile-customer mobile-worker; do
  echo "─────────────────────────────────────────────────"
  echo "  📱 $app"
  echo "─────────────────────────────────────────────────"
  cd "$ROOT/$app"

  # Update the owner in app.json to match the logged-in account
  # so eas init doesn't reject it
  node -e "
    const fs=require('fs');
    const c=JSON.parse(fs.readFileSync('app.json'));
    if (c.expo.owner !== '$OWNER') {
      c.expo.owner='$OWNER';
      fs.writeFileSync('app.json', JSON.stringify(c, null, 2));
      console.log('  ✓ owner updated to @$OWNER');
    }
  "

  # 2a. Initialize project (creates EAS project + writes projectId)
  if [ -z "$(node -p "require('./app.json').expo.extra?.eas?.projectId || ''")" ] ||
     [ "$(node -p "require('./app.json').expo.extra?.eas?.projectId")" = "REPLACE_WITH_PROJECT_ID_AFTER_eas_init" ]; then
    echo "  Running: eas init (non-interactive)"
    eas init --non-interactive --force
  else
    echo "  ✓ projectId already set"
  fi

  # 2b. Trigger a preview build (Android APK).
  # Run async ("--no-wait") so both apps build in parallel — saves ~25min.
  echo "  Running: eas build --profile preview --platform android (async)"
  eas build --profile preview --platform android --non-interactive --no-wait

  cd "$ROOT"
  echo ""
done

# 3. Show build queue
echo "─────────────────────────────────────────────────"
echo "  📦 Active builds"
echo "─────────────────────────────────────────────────"
eas build:list --limit 5 --non-interactive

echo ""
echo "💡 Builds run on Expo's cloud (~20 min each). When they finish:"
echo "   1. eas build:list                          ← see status"
echo "   2. Open the URL of each completed build"
echo "   3. Tap 'Install' on your phone → opens APK"
echo ""
echo "Or watch live: https://expo.dev/accounts/$OWNER/projects"
