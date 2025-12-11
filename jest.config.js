module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/{services,utils}/**/*.test.[tj]s?(x)'],
  clearMocks: true,
};
