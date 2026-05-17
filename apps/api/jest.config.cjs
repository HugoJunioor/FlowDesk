/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.spec.ts', '**/*.spec.ts'],
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      // Valores ajustados após expansão da cobertura dos módulos críticos.
      // Cobertura global fica abaixo do ideal por causa de arquivos sem testes
      // intencionais: openapi/*, sentry, slack (em desenvolvimento), routes/index.ts.
      // Os módulos testados (auth, demanda, sla, auditoria, business-hours) estão
      // com 90-100% de cobertura individualmente.
      branches: 29,
      functions: 42,
      lines: 37,
      statements: 37,
    },
  },
};
