#!/bin/sh
# Publish a new version that both Macs pick up automatically.
#   ./release.sh 1.0.1
# Sets the version, builds dist/hush-<version>.xpi, points updates.json at it, commits, tags,
# pushes, and attaches the .xpi to a GitHub Release. Zen checks updates.json about once a day
# (or immediately via about:addons → gear → Check for Updates).
set -e
cd "$(dirname "$0")"
VERSION="$1"
[ -n "$VERSION" ] || { echo "usage: ./release.sh <version>   (current: $(node -p 'require("./src/manifest.json").version'))"; exit 1; }

node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("src/manifest.json", "utf8"));
m.version = process.argv[1];
fs.writeFileSync("src/manifest.json", JSON.stringify(m, null, 2) + "\n");
' "$VERSION"

./build.sh

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
XPI="hush-$VERSION.xpi"
HASH=$(shasum -a 256 "dist/$XPI" | cut -d" " -f1)
node -e '
const fs = require("fs");
const [version, repo, xpi, hash] = process.argv.slice(1);
const id = JSON.parse(fs.readFileSync("src/manifest.json", "utf8")).browser_specific_settings.gecko.id;
const updates = { addons: { [id]: { updates: [{
  version,
  update_link: `https://github.com/${repo}/releases/download/v${version}/${xpi}`,
  update_hash: `sha256:${hash}`,
}] } } };
fs.writeFileSync("updates.json", JSON.stringify(updates, null, 2) + "\n");
' "$VERSION" "$REPO" "$XPI" "$HASH"

git add -A
git commit -m "Release v$VERSION"
git tag "v$VERSION"
git push origin HEAD "v$VERSION"
gh release create "v$VERSION" "dist/$XPI" --title "v$VERSION" --generate-notes
echo "Released v$VERSION — Macs will update within a day, or now via about:addons → Check for Updates."
