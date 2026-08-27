const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Re-applies the two native edits this app depends on, so `expo prebuild`
 * regenerates a working project instead of a broken one.
 *
 * Without this the edits live only in the gitignored `android/` directory. A
 * fresh clone or `prebuild --clean` silently drops them, and the next release
 * build is signed with a different key — which cannot upgrade the copy already
 * installed on a phone. The only way out of that is uninstalling, which takes
 * the SQLite database with it.
 *
 * 1. Debug builds get a `.dev` application id, so the dev client and the real
 *    app coexist on one device.
 * 2. Release builds are signed with the checked-in debug keystore. That is
 *    deliberate: this app is sideloaded to personal devices, never published,
 *    and a stable key is what makes in-place upgrades possible. Publishing to
 *    Play would need a real keystore here instead.
 */
const DEV_SUFFIX = `
            // Separate application id so the dev client and the real app can
            // both be installed at once.
            applicationIdSuffix '.dev'
            versionNameSuffix '-dev'
            resValue "string", "app_name", "dev"`;

const RELEASE_SIGNING = `
            // Personal sideload: the debug keystore is deliberate. A stable key
            // is what lets a new build upgrade the installed app in place
            // instead of forcing an uninstall, which would take the database
            // with it. Publishing to Play needs a real keystore here.
            resValue "string", "app_name", "prod"
            signingConfig signingConfigs.debug`;

/**
 * The `buildTypes` block only. `signingConfigs` contains a block called
 * `debug` too, and patching that one puts application-id settings inside a
 * keystore declaration.
 */
function buildTypesBlock(contents) {
  const header = contents.indexOf('buildTypes {');
  if (header === -1) {
    throw new Error('withSideloadBuildTypes: no buildTypes block in android/app/build.gradle');
  }

  let depth = 0;
  for (let i = contents.indexOf('{', header); i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    else if (contents[i] === '}') {
      depth -= 1;
      if (depth === 0) return { start: header, end: i + 1 };
    }
  }
  throw new Error('withSideloadBuildTypes: unbalanced braces in android/app/build.gradle');
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
 * The whole transform, as a pure string function: this is the part worth
 * testing, and it needs none of Expo's async mod plumbing to exercise.
 */
function patchSideloadBuildTypes(contents) {
  const { start, end } = buildTypesBlock(contents);
  let block = contents.slice(start, end);
  block = patchBuildType(block, 'debug', DEV_SUFFIX, "applicationIdSuffix '.dev'");
  block = patchBuildType(block, 'release', RELEASE_SIGNING, '"app_name", "prod"');
  return contents.slice(0, start) + block + contents.slice(end);
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
