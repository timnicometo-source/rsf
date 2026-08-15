#!/bin/bash

cd "$(dirname "$0")" || exit 1
node scripts/build-news.mjs

echo
echo "News pages are ready. Press Return to close this window."
read -r
