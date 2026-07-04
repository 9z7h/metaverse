import type { Preview } from "@storybook/react";
// Tailwind v4 스타일을 스토리북에도 적용
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
