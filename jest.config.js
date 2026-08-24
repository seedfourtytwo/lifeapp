const jestExpoPreset = require('jest-expo/jest-preset.js');

// jest-expo's own transform for .js/.ts/.jsx/.tsx, plus dynamic-import-node.
// Metro handles `await import(...)` at runtime via its own code-splitting;
// Jest's CJS test environment can't execute real dynamic import without
// --experimental-vm-modules, so source files using it (e.g. optional native
// module loaders) fail under test unless it's rewritten to `require()`.
// Scoped to this one transform entry only — everything else from the preset
// (moduleNameMapper, asset transforms, setupFiles) is left untouched.
const [transformer, babelOpts] = jestExpoPreset.transform['\\.[jt]sx?$'];

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Git worktrees created under .claude/ are full checkouts, so jest-haste-map
  // sees two copies of every local native module in `modules/` and refuses to
  // resolve them. Ignore them here or every run fails while a worktree exists.
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|uuid)',
  ],
  transform: {
    ...jestExpoPreset.transform,
    '\\.[jt]sx?$': [
      transformer,
      { ...babelOpts, plugins: ['babel-plugin-dynamic-import-node'] },
    ],
  },
};
