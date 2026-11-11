# Release signing: Life's own key

The release build (`com.lifeapp.dashboard`) used to be signed with the public
Android debug key from the Expo template. It is now signed with a private key
that lives outside the repo. `plugins/withSideloadBuildTypes.js` writes the
wiring into `android/app/build.gradle` on every prebuild.

- The key is described by a properties file, by default
  `~/.config/lifeapp/release-signing.properties`, or wherever
  `LIFEAPP_RELEASE_SIGNING_PROPERTIES` points. It holds four lines:
  `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. A relative
  `storeFile` is read next to the properties file.
- Without that file, any Gradle run that includes a release task fails and
  says why. It never falls back to the debug key.
- The dev build (`com.lifeapp.dashboard.dev`) still uses the debug key and
  needs no file. `./gradlew assembleDebug` works as before, but
  `./gradlew assembleDebug assembleRelease` in one run needs the file.

Android only installs an update signed with the same key as the installed
app. So switching keys means one uninstall, which deletes the database. The
steps below do that once, safely.

## 1. Create the key (once, on the laptop)

```bash
mkdir -p ~/.config/lifeapp && chmod 700 ~/.config/lifeapp
keytool -genkeypair -v \
  -keystore ~/.config/lifeapp/life-release.jks \
  -alias life -keyalg RSA -keysize 4096 -validity 36500 \
  -dname "CN=Life"
```

`keytool` asks for a password. The keystore is PKCS12, which uses one password
for the store and the key, so the same password goes in both lines below.

```bash
cat > ~/.config/lifeapp/release-signing.properties <<'PROPS'
storeFile=life-release.jks
storePassword=THE_PASSWORD
keyAlias=life
keyPassword=THE_PASSWORD
PROPS
chmod 600 ~/.config/lifeapp/release-signing.properties ~/.config/lifeapp/life-release.jks
```

Write down the key's fingerprint, to check builds against later:

```bash
keytool -list -v -keystore ~/.config/lifeapp/life-release.jks -alias life | grep SHA256
```

## 2. Back the key up

Copy `life-release.jks` and the password somewhere that is not this laptop,
for example the password manager (file attachment) and an encrypted USB stick.
If the key is lost, every later update needs another uninstall and import.

## 3. Switch the phone over (once)

1. On the phone, stop any running timer, then Settings → Back up, and send the
   file to the laptop. Open it and check it is not empty. The daily copy in
   the backup folder is a second copy.
2. On the laptop, build the release with the new key:

   ```bash
   npx expo prebuild --platform android
   cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2
   "$(ls -d "$ANDROID_HOME"/build-tools/* | tail -1)/apksigner" verify --print-certs \
     app/build/outputs/apk/release/app-release.apk
   ```

   The SHA-256 printed must match the one from step 1.
3. `adb install -r app/build/outputs/apk/release/app-release.apk` now fails
   with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. That is expected, and nothing on
   the phone has changed.
4. Only once the backup from 1. is checked: uninstall the old app. **This
   deletes its database.** Files in the backup folder stay.

   ```bash
   adb uninstall com.lifeapp.dashboard
   adb install app/build/outputs/apk/release/app-release.apk
   ```

5. Open Life → Settings → Restore from a backup, and pick the file from 1.
   Check today's habits and a past day in History.
6. Settings → Daily copy to a folder → choose the backup folder again. The
   folder permission went with the uninstall.

From then on, every release build is signed with this key and installs over
the previous one with `adb install -r`, as before.
