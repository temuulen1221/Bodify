module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/{services,utils,components,screens}/**/*.test.[tj]s?(x)'],
  clearMocks: true,
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  moduleNameMapper: {
    // Stub binary and media assets that can't be parsed by Node.js
    '\\.(fbx|vrm|glb|gltf|png|jpg|jpeg|gif|svg|mp3|wav|mp4)$': '<rootDir>/emptyShim.js',
  },
};
