const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Re-applies the native edits this app depends on, so `expo prebuild`
 * regenerates a working project instead of a broken one.
 *
 * Without this the edits live only in the gitignored `android/` directory. A
 * fresh clone or `prebuild --clean` silently drops them, and the next release
 * build is signed with a different key — which cannot upgrade the copy already
 * installed on a phone. The only way out of that is uninstalling, which takes
 * the SQLite database with it.
 *
 * 1. Debug builds get a `.dev` application id, so the dev client and the real
 *    app coexist on one device. They keep the debug keystore.
 * 2. Release builds are signed with Chris's own key, described by a properties
 *    file outside the repo (storeFile, storePassword, keyAlias, keyPassword):
 *    `$LIFEAPP_RELEASE_SIGNING_PROPERTIES`, or by default
 *    `~/.config/lifeapp/release-signing.properties`. Without that file a
 *    release build fails and says why — it never falls back to the public
 *    debug key. See docs/release-signing.md.
 */
const DEV_SUFFIX = `
            // Separate application id so the dev client and the real app can
            // both be installed at once.
            applicationIdSuffix '.dev'
            versionNameSuffix '-dev'
            resValue "string", "app_name", "Life dev"`;

const RELEASE_SIGNING = `
            // Signed with Chris's own key (the release signing block at the
            // top of this file), never with the public debug key.
            resValue "string", "app_name", "Life"
            signingConfig signingConfigs.sideloadRelease`;

/** Marks the top-of-file block, so a second prebuild does not add it again. */
const SIGNING_MARKER = '// Life release signing';

/**
 * Plain strings, not a template literal: the Groovy is full of `\${…}`.
 * Read at configuration time, so a debug build never needs the file; the
 * check only fires once the task graph holds a release task.
 */
const SIGNING_PROPERTIES = [
  SIGNING_MARKER + ' (plugins/withSideloadBuildTypes.js): the release build is signed with',
  "// a private key described by a properties file kept outside the repo. See",
  '// docs/release-signing.md. Never falls back to the public debug key.',
  "def lifeReleaseSigningPath = System.getenv('LIFEAPP_RELEASE_SIGNING_PROPERTIES') ?:",
  "        \"\${System.getProperty('user.home')}/.config/lifeapp/release-signing.properties\"",
  'def lifeReleaseSigningFile = new File(lifeReleaseSigningPath)',
  'def lifeReleaseSigning = new Properties()',
  'if (lifeReleaseSigningFile.isFile()) {',
  '    lifeReleaseSigningFile.withInputStream { lifeReleaseSigning.load(it) }',
  '}',
  "def lifeReleaseSigningMissing = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']",
  '        .findAll { !lifeReleaseSigning.getProperty(it) }',
  'gradle.taskGraph.whenReady { graph ->',
  "    def buildsRelease = graph.allTasks.any { it.project == project && it.name.contains('Release') }",
  '    if (buildsRelease && !lifeReleaseSigningMissing.isEmpty()) {',
  '        throw new GradleException(lifeReleaseSigningFile.isFile()',
  "            ? \"Release signing: \${lifeReleaseSigningPath} is missing \${lifeReleaseSigningMissing.join(', ')}.\"",
  '            : "Release signing: no file at \${lifeReleaseSigningPath}. A release build is signed only with " +',
  '              "your own key: see docs/release-signing.md, or point LIFEAPP_RELEASE_SIGNING_PROPERTIES at the file.")',
  '    }',
  '}',
  '',
  '',
].join('\n');

const SIGNING_CONFIG = `
        sideloadRelease {
            if (lifeReleaseSigningMissing.isEmpty()) {
                // A relative storeFile is read next to the properties file.
                def keystore = new File(lifeReleaseSigning.getProperty('storeFile'))
                storeFile keystore.isAbsolute() ? keystore : new File(lifeReleaseSigningFile.parentFile, keystore.path)
                storePassword lifeReleaseSigning.getProperty('storePassword')
                keyAlias lifeReleaseSigning.getProperty('keyAlias')
                keyPassword lifeReleaseSigning.getProperty('keyPassword')
            }
        }`;

/**
 * What earlier prebuilds left in the release block: the debug-key comment this
 * plugin used to write, and the template's warning about that same line.
 */
const STALE_RELEASE_COMMENTS = [
  `
            // Personal sideload: the debug keystore is deliberate. A stable key
            // is what lets a new build upgrade the installed app in place
            // instead of forcing an uninstall, which would take the database
            // with it. Publishing to Play needs a real keystore here.`,
  `
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.`,
];

/** The `{ … }` block opened by the first `header` at or after `from`. */
function blockAt(contents, header, from = 0) {
  const start = contents.indexOf(header, from);
  if (start === -1) {
    throw new Error(`withSideloadBuildTypes: no ${header} block in android/app/build.gradle`);
  }

  let depth = 0;
  for (let i = contents.indexOf('{', start); i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    else if (contents[i] === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error('withSideloadBuildTypes: unbalanced braces in android/app/build.gradle');
}

/**
 * The `buildTypes` block only. `signingConfigs` contains a block called
 * `debug` too, and patching that one puts application-id settings inside a
 * keystore declaration.
 */
function buildTypesBlock(contents) {
  return blockAt(contents, 'buildTypes {');
}

function patchBuildType(block, buildType, insertion, marker) {
  if (block.includes(marker)) return block;

  const pattern = new RegExp(`(\\n\\s*${buildType} \\{)`);
  if (!pattern.test(block)) {
    throw new Error(
      `withSideloadBuildTypes: no ${buildType} buildType found in android/app/build.gradle`,
    );
  }
  return block.replace(pattern, `$1${insertion}`);
}

/**
 * Labels this plugin wrote before the app was called Life. A project prebuilt
 * then still carries them; renaming in place keeps one app_name per build type.
 */
const LEGACY_LABELS = [
  ['resValue "string", "app_name", "dev"', 'resValue "string", "app_name", "Life dev"'],
  ['resValue "string", "app_name", "prod"', 'resValue "string", "app_name", "Life"'],
];

/**
 * The release block signs with `sideloadRelease` and nothing else. Every
 * `signingConfig` line goes — the template's debug one, the one this plugin
 * used to add — so no later assignment can win, then the block gets exactly
 * one copy of RELEASE_SIGNING at its top. Rebuilt the same way every time,
 * which is what keeps a second prebuild a no-op.
 */
function patchReleaseSigning(buildTypes) {
  const { start, end } = blockAt(buildTypes, 'release {');
  let release = buildTypes.slice(start, end);
  for (const comment of [...STALE_RELEASE_COMMENTS, RELEASE_SIGNING]) {
    release = release.replace(comment, '');
  }
  release = release
    .replace(/\n[ \t]*signingConfig signingConfigs\.\w+[ \t]*(?=\n)/g, '')
    .replace(/\n[ \t]*resValue "string", "app_name", "Life"[ \t]*(?=\n)/g, '')
    .replace(/^release \{/, `release {${RELEASE_SIGNING}`);
  return buildTypes.slice(0, start) + release + buildTypes.slice(end);
}

function patchSigningConfigs(contents) {
  if (contents.includes('sideloadRelease {')) return contents;
  const { start } = blockAt(contents, 'signingConfigs {');
  const headerEnd = start + 'signingConfigs {'.length;
  return contents.slice(0, headerEnd) + SIGNING_CONFIG + contents.slice(headerEnd);
}

function addSigningProperties(contents) {
  if (contents.includes(SIGNING_MARKER)) return contents;
  const android = contents.search(/^android \{/m);
  if (android === -1) {
    throw new Error('withSideloadBuildTypes: no android block in android/app/build.gradle');
  }
  return contents.slice(0, android) + SIGNING_PROPERTIES + contents.slice(android);
}

/**
 * The whole transform, as a pure string function: this is the part worth
 * testing, and it needs none of Expo's async mod plumbing to exercise.
 */
function patchSideloadBuildTypes(contents) {
  const { start, end } = buildTypesBlock(contents);
  let block = contents.slice(start, end);
  for (const [from, to] of LEGACY_LABELS) block = block.replace(from, to);
  block = patchBuildType(block, 'debug', DEV_SUFFIX, "applicationIdSuffix '.dev'");
  if (!/\n\s*release \{/.test(block)) {
    throw new Error('withSideloadBuildTypes: no release buildType found in android/app/build.gradle');
  }
  block = patchReleaseSigning(block);
  const patched = contents.slice(0, start) + block + contents.slice(end);
  return addSigningProperties(patchSigningConfigs(patched));
}

function withSideloadBuildTypes(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('withSideloadBuildTypes: expected a Groovy build.gradle');
    }

    gradleConfig.modResults.contents = patchSideloadBuildTypes(gradleConfig.modResults.contents);
    return gradleConfig;
  });
}

module.exports = withSideloadBuildTypes;
module.exports.patchSideloadBuildTypes = patchSideloadBuildTypes;
