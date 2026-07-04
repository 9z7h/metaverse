import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-designs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    // 모든 컴포넌트에 대해 autodocs 페이지를 생성
    autodocs: "tag",
  },
};

export default config;
