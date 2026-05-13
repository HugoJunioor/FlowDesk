/**
 * Setup global pra todos os testes.
 *
 * - @testing-library/jest-dom adiciona matchers (toBeInTheDocument, etc)
 * - cleanup automatico apos cada teste (RTL faz por padrao em setupFiles, mas
 *   garantimos via afterEach pra robustez)
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
