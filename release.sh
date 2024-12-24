#!/bin/bash
#chmod +x release.sh


# Variables
REPO="tcrouzet/obsidian-french-typos"
TAG=$(jq -r '.version' manifest.json) 
RELEASE_NAME="$TAG"
DESCRIPTION="Release $TAG"
FILES=("main.js" "manifest.json" "styles.css", "nobr.css")

# Créer la release
gh release create "$TAG" "${FILES[@]}" \
  --repo "$REPO" \
  --title "$RELEASE_NAME" \
  --notes "$DESCRIPTION"
