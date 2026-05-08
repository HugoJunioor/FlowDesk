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
    "@storybook/addon-essentials",
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
