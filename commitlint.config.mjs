/**
 * Commitlint config — valida mensagens de commit no hook commit-msg.
 * Padrao: Conventional Commits (https://www.conventionalcommits.org/)
 *
 * Formato: <type>(<scope>): <subject>
 * Exemplo: feat(slack): adiciona refresh manual no thread
 *
 * Types permitidos abaixo. Scope eh livre.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",      // nova funcionalidade
        "fix",       // bug fix
        "perf",      // melhoria de performance
        "refactor",  // refactor sem mudanca de comportamento
        "docs",      // so documentacao
        "test",      // adiciona/ajusta testes
        "chore",     // tarefas de manutencao (deps, build, ci)
        "ci",        // mudancas em CI/workflows
        "style",     // formatacao, lint (sem mudanca de codigo)
        "build",     // mudancas em sistema de build
        "revert",    // reverte commit anterior
      ],
    ],
    // Subject (titulo) com max 100 chars (mais permissivo que default 72)
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
    // Body line nao pode passar de 200 chars (default 100, restritivo demais)
    "body-max-line-length": [2, "always", 200],
    "footer-max-line-length": [2, "always", 200],
  },
};
