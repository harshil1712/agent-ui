import type { Preview } from "@storybook/react-vite";
import "../src/storybook.css";

const preview: Preview = {
  parameters: {
    a11y: { test: "error" },
    backgrounds: { default: "app" },
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ width: "min(680px, calc(100vw - 32px))" }}>
        <Story />
      </div>
    )
  ]
};

export default preview;
