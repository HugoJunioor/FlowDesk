import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook config — usa o mesmo Vite do app pra alias @ + Tailwind funcionarem.
 *
 * Cobertura inicial: shadcn/ui components em src/components/ui/.
 * Expandir conforme necessario pra componentes de dominio (DemandCard, etc).
 */
const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    // Em Storybook 10, addon-essentials foi integrado ao core. Apenas
    // addons opcionais aqui (a11y eh extra util pra compliance).
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
