// The plugin is CommonJS, as Expo config plugins must be.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { patchSideloadBuildTypes } = require('../plugins/withSideloadBuildTypes.js') as {
  patchSideloadBuildTypes: (contents: string) => string;
};

/** What `expo prebuild` writes: the stock template, without this app's edits. */
const PRISTINE_GRADLE = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

function releaseBlock(gradle: string): string {
  return gradle.slice(gradle.indexOf('release {'));
}

describe('patchSideloadBuildTypes', () => {
  it('restores the .dev application id a prebuild would have dropped', () => {
    expect(patchSideloadBuildTypes(PRISTINE_GRADLE)).toContain("applicationIdSuffix '.dev'");
  });

  it('signs the release with the private key, and only with it', () => {
    const release = releaseBlock(patchSideloadBuildTypes(PRISTINE_GRADLE));
    expect(release.match(/signingConfig signingConfigs\.\w+/g)).toEqual([
      'signingConfig signingConfigs.sideloadRelease',
    ]);
  });

  it('turns a release the old plugin signed with the public debug key over to the private key', () => {
    const oldPatched = PRISTINE_GRADLE.replace(
      'release {\n            signingConfig signingConfigs.release',
      [
        'release {',
        '            // Personal sideload: the debug keystore is deliberate. A stable key',
        '            // is what lets a new build upgrade the installed app in place',
        '            // instead of forcing an uninstall, which would take the database',
        '            // with it. Publishing to Play needs a real keystore here.',
        '            resValue "string", "app_name", "Life"',
        '            signingConfig signingConfigs.debug',
        '            // Caution! In production, you need to generate your own keystore file.',
        '            // see https://reactnative.dev/docs/signed-apk-android.',
        '            signingConfig signingConfigs.debug',
      ].join('\n'),
    );
    const release = releaseBlock(patchSideloadBuildTypes(oldPatched));

    expect(release).not.toContain('signingConfigs.debug');
    expect(release).not.toContain('debug keystore is deliberate');
    expect(release.match(/"app_name", "Life"/g)).toHaveLength(1);
    expect(release).toContain('signingConfig signingConfigs.sideloadRelease');
  });

  it('keeps the dev build on the debug key', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    const debugBuild = patched.slice(patched.indexOf('buildTypes {'), patched.indexOf('release {'));
    expect(debugBuild).toContain('signingConfig signingConfigs.debug');
  });

  it('reads the key from a properties file outside the repo, by env var or the documented default', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    expect(patched).toContain("System.getenv('LIFEAPP_RELEASE_SIGNING_PROPERTIES')");
    expect(patched).toContain('/.config/lifeapp/release-signing.properties');
    for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
      expect(patched).toContain(`'${key}'`);
    }
    // Before android { }, so the signing config inside it can use what was read.
    expect(patched.indexOf('lifeReleaseSigningPath')).toBeLessThan(patched.indexOf('android {'));
  });

  it('fails a release build without the file instead of falling back to the debug key', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    expect(patched).toContain('gradle.taskGraph.whenReady');
    expect(patched).toContain('throw new GradleException');
    expect(patched).toContain("it.name.contains('Release')");
  });

  it('declares the private signing config beside the debug keystore, leaving that one alone', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    const signing = patched.slice(patched.indexOf('signingConfigs {'), patched.indexOf('buildTypes {'));
    expect(signing).toContain('sideloadRelease {');
    expect(signing).toContain("storeFile file('debug.keystore')");
    expect(signing).not.toMatch(/storePassword '(?!android)/);
  });

  it('names the two builds distinctly so both can sit on one device', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    expect(patched).toContain('"app_name", "Life dev"');
    expect(patched).toContain('"app_name", "Life"');
  });

  it('renames a project prebuilt under the old "prod"/"dev" labels instead of adding a second name', () => {
    const old = PRISTINE_GRADLE.replace(
      'debug {\n            signingConfig',
      'debug {\n            applicationIdSuffix \'.dev\'\n            resValue "string", "app_name", "dev"\n            signingConfig',
    ).replace(
      'release {\n            signingConfig signingConfigs.release',
      'release {\n            resValue "string", "app_name", "prod"\n            signingConfig signingConfigs.debug\n            signingConfig signingConfigs.release',
    );
    const patched = patchSideloadBuildTypes(old);

    expect(patched).not.toMatch(/"app_name", "(prod|dev)"/);
    expect(patched.match(/"app_name"/g)).toHaveLength(2);
    expect(releaseBlock(patched)).toContain('"app_name", "Life"');
  });

  it('puts the dev edits in the debug block, not the release one', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    expect(releaseBlock(patched)).not.toContain("applicationIdSuffix '.dev'");
  });

  it('edits buildTypes.debug, never the identically-named signingConfigs.debug', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    const signingBlock = patched.slice(
      patched.indexOf('signingConfigs {'),
      patched.indexOf('buildTypes {'),
    );

    expect(signingBlock).not.toContain('applicationIdSuffix');
    expect(signingBlock).toContain("storeFile file('debug.keystore')");
  });

  it('is idempotent — prebuilding twice must not duplicate the edits', () => {
    const once = patchSideloadBuildTypes(PRISTINE_GRADLE);
    const twice = patchSideloadBuildTypes(once);

    expect(twice).toBe(once);
    expect(twice.match(/applicationIdSuffix '\.dev'/g)).toHaveLength(1);
    expect(twice.match(/sideloadRelease \{/g)).toHaveLength(1);
    expect(twice.match(/LIFEAPP_RELEASE_SIGNING_PROPERTIES'\)/g)).toHaveLength(1);
  });

  it('leaves an already-edited file alone', () => {
    const edited = PRISTINE_GRADLE.replace(
      'debug {\n            signingConfig',
      "debug {\n            applicationIdSuffix '.dev'\n            signingConfig",
    );

    expect(patchSideloadBuildTypes(edited).match(/applicationIdSuffix '\.dev'/g)).toHaveLength(1);
  });

  it('fails loudly if a future template stops having a release buildType', () => {
    // Has debug, so the release check is the one under test.
    const debugOnly = 'android {\n    buildTypes {\n        debug {\n        }\n    }\n}';

    expect(() => patchSideloadBuildTypes(debugOnly)).toThrow(/release/);
  });

  it('fails loudly if a future template stops having a debug buildType', () => {
    expect(() =>
      patchSideloadBuildTypes('android {\n    buildTypes {\n        release {\n        }\n    }\n}'),
    ).toThrow(/debug/);
  });
});
