#!/usr/bin/env bash
# build.sh — Gradle-free APK build. One universal, ABI-independent APK.
# First run downloads the Android SDK (~600MB) into ./sdk and takes a few minutes.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$D"
# shellcheck source=tools/version.sh
. "$D/tools/version.sh"
VER="$(ver_read)"; VCODE="$(ver_code "$VER")"
echo "== FF Tracker v$VER (versionCode $VCODE) =="
SDK="$D/sdk"; API="${API:-36}"; BT="${BT:-36.0.0}"
PKG=com.tj.fftracker
OUT="$D/build"; rm -rf "$OUT"; mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res" "$OUT/dex"

# ---- 1. SDK ---------------------------------------------------------------
if [ ! -d "$SDK/platforms/android-$API" ]; then
  echo "== installing Android SDK (first run only) =="
  mkdir -p "$SDK/cmdline-tools"
  if [ ! -d "$SDK/cmdline-tools/latest" ]; then
    curl -fsSL -o /tmp/cmdline.zip \
      https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
    unzip -q -o /tmp/cmdline.zip -d "$SDK/cmdline-tools"
    mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
  fi
  yes 2>/dev/null | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses >/dev/null || true
  "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
      "platforms;android-$API" "build-tools;$BT" >/dev/null
fi
BTDIR="$SDK/build-tools/$BT"
AJ="$SDK/platforms/android-$API/android.jar"
[ -f "$AJ" ] || { echo "FAIL: no android.jar for API $API"; exit 1; }

# ---- 2. resources ---------------------------------------------------------
# The page needs to print the same number the APK carries, and a file:// page
# cannot read the manifest — so stamp it into an asset script instead.
printf 'window.APP_VERSION=%s;\n' "\"$VER\"" > app/assets/version.js
echo "== aapt2 compile =="
"$BTDIR/aapt2" compile --dir android/res -o "$OUT/res/res.zip"

# seed.json is the SOURCE tools/mkseed.py turns into seed.js. index.html loads
# seed.js and nothing has read the .json on the phone for many versions, but
# aapt2 -A ships the whole directory, so 38 KB of dead weight rode along in
# every APK. Staged copy: the bundle keeps the source, the APK does not carry
# it. Anything genuinely unused by index.html can be added to this list.
echo "== staging assets (excluding build-time sources) =="
APKASSETS="$OUT/assets"
rm -rf "$APKASSETS"; mkdir -p "$APKASSETS"
cp app/assets/* "$APKASSETS"/
rm -f "$APKASSETS/seed.json"

echo "== aapt2 link =="
"$BTDIR/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$AJ" \
  --manifest android/AndroidManifest.xml \
  -R "$OUT/res/res.zip" \
  --java "$OUT/gen" \
  -A "$APKASSETS" \
  --min-sdk-version 29 \
  --target-sdk-version "$API" \
  --version-code "$VCODE" --version-name "$VER" \
  --auto-add-overlay

# ---- 3. java -> dex -------------------------------------------------------
echo "== javac =="
find android/src "$OUT/gen" -name '*.java' > "$OUT/srcs.txt"
# THIS PIPELINE ONCE SHIPPED THREE BROKEN APKs.
# It used to end in `| grep -v ... || true`, which threw away javac's exit
# status: a compile error printed, scrolled past, and the build carried on and
# signed an APK containing only the classes that happened to compile. The app
# then died on launch with NoClassDefFoundError and the build said "built".
# javac's status is now the build's status, and PIPESTATUS is what carries it
# across the pipe.
set +e
javac -source 8 -target 8 -nowarn -encoding UTF-8 \
      -bootclasspath "$AJ" -classpath "$AJ" \
      -d "$OUT/classes" @"$OUT/srcs.txt" > "$OUT/javac.log" 2>&1
JC=$?
set -e
grep -v 'bootstrap class path' "$OUT/javac.log" || true
if [ "$JC" != "0" ]; then
  echo
  echo "  FAIL  javac exited $JC. NOTHING HAS BEEN PACKAGED — fix the error above."
  echo "        (This is the check that was missing when v2.7-v2.9 shipped an APK"
  echo "         with half its classes and crashed on launch.)"
  exit 1
fi

echo "== d8 =="
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BTDIR/d8" --lib "$AJ" --min-api 29 --output "$OUT/dex" @"$OUT/classes.txt"

# Every top-level source file must have produced a class. A silent partial
# compile is exactly what happened before; this makes it loud.
for f in $(find android/src -name '*.java'); do
  CN=$(basename "$f" .java)
  if ! grep -q "/$CN.class\$" "$OUT/classes.txt"; then
    echo "  FAIL  $CN.java produced no class file — the APK would be missing it."
    exit 1
  fi
done
echo "  OK    every source file produced a class ($(wc -l < "$OUT/classes.txt") in total)"

# ---- 4. package, align, sign ---------------------------------------------
echo "== package =="
cp "$OUT/base.apk" "$OUT/unsigned.apk"
( cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes*.dex )

KS="$D/android/debug.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -storepass android -keypass android \
    -alias fftracker -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=FF Tracker, OU=Personal, O=Personal, L=NA, S=NA, C=US" >/dev/null 2>&1
fi
"$BTDIR/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$BTDIR/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --min-sdk-version 29 --v1-signing-enabled true --v2-signing-enabled true \
  --v3-signing-enabled true --out "$OUT/app-release.apk" "$OUT/aligned.apk"
"$BTDIR/apksigner" verify --min-sdk-version 29 "$OUT/app-release.apk" && echo "  signature OK"

rm -f "$OUT/unsigned.apk" "$OUT/aligned.apk" "$OUT/base.apk"
echo
echo "== built =="
ls -lh "$OUT/app-release.apk" | awk '{print "  "$9"  "$5}'
echo "  ABIs: none (pure Java + WebView) -> installs on armeabi-v7a AND arm64-v8a"
echo "  minSdk 29 (Android 10)  targetSdk $API"
