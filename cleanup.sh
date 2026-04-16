#!/bin/bash

# Pre-publication sanity script.
# The example app's Xcode project gets a DEVELOPMENT_TEAM written to it the
# first time anyone signs the app locally — this script wipes that out before
# you push or publish so a personal team ID never lands in git.
#
# macOS only (uses BSD sed's `-i ''` syntax).

set -e

echo "Pre-publication cleanup..."

# Soft-warn on uncommitted changes so the strip doesn't get folded into an
# unrelated commit by accident.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "  WARN: working tree is not clean — review changes before committing"
fi

PROJECT="example/ios/AnotherReactNativeImageCropperExample.xcodeproj/project.pbxproj"

if [ -f "$PROJECT" ]; then
  echo "  Stripping DEVELOPMENT_TEAM from $PROJECT"
  # Handle both quoted (`"ABC123"`) and unquoted (`ABC123`) forms that Xcode
  # writes depending on version / signing mode.
  sed -i '' -E 's/DEVELOPMENT_TEAM = "?[A-Z0-9]+"?;/DEVELOPMENT_TEAM = "";/g' "$PROJECT"
fi

if ! grep -q "^coverage/$" .gitignore 2>/dev/null; then
  echo "  coverage/ missing from .gitignore — adding"
  echo "coverage/" >> .gitignore
fi

if [ ! -f NOTICE ]; then
  echo "  WARN: NOTICE file missing — third-party attribution required"
fi

if [ ! -f LICENSE ]; then
  echo "  WARN: LICENSE file missing"
fi

echo "Done."
echo ""
echo "Next:"
echo "  yarn release --dry-run   # preview the release without publishing"
echo "  yarn release             # bump version, tag, push, publish"
