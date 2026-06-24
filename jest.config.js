const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/stores/**/*.{ts,tsx}',
    'src/components/ui/**/*.{ts,tsx}',
    'src/app/api/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/components/globe/**', // Three.js components can't be tested in jsdom
    '!src/app/page.tsx', // Integration test, requires full mock setup
    '!src/app/layout.tsx', // Static metadata export
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 65,
      lines: 90,
      statements: 90,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

module.exports = createJestConfig(config);
