#!/bin/sh
# Lint and package Hush as an installable .xpi in dist/.
# Bump "version" in src/manifest.json before building an update you want to install over the old one.
set -e
cd "$(dirname "$0")"
VERSION=$(node -p 'require("./src/manifest.json").version')
npx --yes web-ext@8 lint -s src --self-hosted --warnings-as-errors
npx --yes web-ext@8 build -s src -a dist --overwrite-dest -n "hush-$VERSION.xpi"
cp "dist/hush-$VERSION.xpi" dist/hush.xpi
echo "Built dist/hush.xpi (v$VERSION)"
