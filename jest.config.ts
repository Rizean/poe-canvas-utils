// jest.config.ts
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    collectCoverage: true,
    coverageProvider: 'v8',
    coverageDirectory: 'coverage',
    // Look for test files under the "__test__" folder or files ending with .test.ts or .spec.ts
    testMatch: ['**/__test__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
    coverageThreshold: {
        global: {
            branches: 95,
            functions: 90,
            lines: 99,
            statements: 99,
        },
    },
};

export default config;
