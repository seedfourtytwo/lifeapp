#!/usr/bin/env bash
# Draws each lock-screen widget state to docs/mockups/widget-preview/*.png,
# without a phone: the Kotlin unit test writes the drawing steps from the
# real view model, then Render.java paints them with Java2D.
#
#   ANDROID_HOME=~/Android/Sdk JAVA_HOME=~/.local/jdk-21 scripts/widget-preview.sh
#
# Needs a prebuilt android/ folder (npx expo prebuild --platform android).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
steps="$root/modules/life-core/android/build/widget-preview"
target="$root/docs/mockups/widget-preview"

(cd "$root/android" && ./gradlew :life-core:testDebugUnitTest --tests '*WidgetPreviewTest' --max-workers=2 -q)

json="$(find "$HOME/.gradle/caches/modules-2/files-2.1/org.json/json" -name 'json-*.jar' ! -name '*sources*' | sort -V | tail -n 1)"
mkdir -p "$target"
for file in "$steps"/*.json; do
  name="$(basename "$file" .json)"
  "${JAVA_HOME:-/usr}/bin/java" -Djava.awt.headless=true -cp "$json" "$root/scripts/widget-preview/Render.java" "$file" "$target/$name.png"
  echo "$target/$name.png"
done
