#!/bin/bash
#chmod +x release.sh

# Variables
REPO=$(jq -r '.repo' commit.json)
TAG=$(jq -r '.version' manifest.json) 
RELEASE_NAME="$TAG"
DESCRIPTION="Release $TAG"
FILES=("main.js" "manifest.json" "nobr.css" "highlight.css" "hyphens.css" "small_interline.css")

# Créer la release
gh release create "$TAG" "${FILES[@]}" \
  --repo "$REPO" \
  --title "$RELEASE_NAME" \
  --notes "$DESCRIPTION"
