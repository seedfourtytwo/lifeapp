/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// CommonJS so the pure helpers below can be unit-tested from Jest, which runs
// this repo's tests in a CJS environment (see plugins/withSideloadBuildTypes.js).
const fs = require('fs');
const path = require('path');

/**
 * Bump the app version in one place.
 *
 * `app.json` -> `expo.version` / `expo.android.versionCode` is the source of
 * truth: it is what `expo prebuild`, EAS and the runtime `Constants.expoConfig`
 * all read. `package.json` and `package-lock.json` are kept in step — the lock
 * records the root version too, and `npm ci` refuses to run when it disagrees
 * with package.json. `__tests__/appVersion.test.ts` fails if any of them
 * diverge.
 *
 *   npm run release -- patch      # 1.5.0 -> 1.5.1
 *   npm run release -- minor      # 1.5.0 -> 1.6.0
 *   npm run release -- major      # 1.5.0 -> 2.0.0
 *   npm run release -- 2.1.3      # explicit
 *   npm run release -- patch --dry-run
 */

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version) {
  const match = VERSION_RE.exec(String(version ?? ''));
  if (!match) {
    throw new Error(
      `Version "${version}" is not major.minor.patch (e.g. 1.6.0) — no prefix, no pre-release suffix.`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** -1 / 0 / 1, comparing each component numerically. */
function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

/**
 * Next version + versionCode for a release request.
 * `request` is `major` / `minor` / `patch`, or an explicit `x.y.z`.
 */
function nextRelease(current, request) {
  const [major, minor, patch] = parseVersion(current.version);
  if (!Number.isInteger(current.versionCode)) {
    throw new Error(
      `Current versionCode ${current.versionCode} is not an integer — fix app.json before releasing.`,
    );
  }

  let version;
  if (request === 'major') version = `${major + 1}.0.0`;
  else if (request === 'minor') version = `${major}.${minor + 1}.0`;
  else if (request === 'patch') version = `${major}.${minor}.${patch + 1}`;
  else {
    // Throws for anything that is not a bare x.y.z.
    parseVersion(request);
    version = request;
    if (compareVersions(version, current.version) <= 0) {
      throw new Error(
        `Refusing to release ${version}: it must be greater than ${current.version}.`,
      );
    }
  }

  // Play Store rejects a reused versionCode, so it moves on every release.
  return { version, versionCode: current.versionCode + 1 };
}

/** Rewrite one top-level JSON file, preserving 2-space style + trailing newline. */
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main(argv) {
  const args = argv.filter((arg) => arg !== '--dry-run');
  const dryRun = argv.includes('--dry-run');
  const request = args[0];

  if (!request) {
    console.error(
      'Usage: npm run release -- <major|minor|patch|x.y.z> [--dry-run]',
    );
    return 1;
  }

  const root = path.resolve(__dirname, '..');
  const appJsonPath = path.join(root, 'app.json');
  const packageJsonPath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const lockJson = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  const current = {
    version: appJson.expo.version,
    versionCode: appJson.expo.android.versionCode,
  };

  let next;
  try {
    next = nextRelease(current, request);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  console.log(
    `${current.version} (versionCode ${current.versionCode}) -> ` +
      `${next.version} (versionCode ${next.versionCode})`,
  );

  if (dryRun) {
    console.log('--dry-run: nothing written.');
    return 0;
  }

  appJson.expo.version = next.version;
  appJson.expo.android.versionCode = next.versionCode;
  packageJson.version = next.version;
  // The lock records the root version in two places; `npm ci` compares both.
  lockJson.version = next.version;
  if (lockJson.packages && lockJson.packages['']) {
    lockJson.packages[''].version = next.version;
  }

  writeJson(appJsonPath, appJson);
  writeJson(packageJsonPath, packageJson);
  writeJson(lockPath, lockJson);

  console.log('Updated app.json, package.json and package-lock.json.');
  console.log(
    'Next: commit, then rebuild the release APK (a versionCode change is native).',
  );
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { compareVersions, nextRelease, parseVersion };
