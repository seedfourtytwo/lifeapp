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

  it('restores release signing, without which a build cannot upgrade an installed app', () => {
    expect(releaseBlock(patchSideloadBuildTypes(PRISTINE_GRADLE))).toContain(
      'signingConfig signingConfigs.debug',
    );
  });

  it('names the two builds distinctly so both can sit on one device', () => {
    const patched = patchSideloadBuildTypes(PRISTINE_GRADLE);
    expect(patched).toContain('"app_name", "dev"');
    expect(patched).toContain('"app_name", "prod"');
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
