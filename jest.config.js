module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/spec/javascript/**/*.spec.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/javascript/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/spec/javascript/setupTests.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(chart\.js|@stimulus)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/vendor/',
  ],
  verbose: true,
};
