import type { Meta, StoryObj } from "@storybook/react";
import { Pill } from "./pill.tsx";

const meta = {
  title: "UI/Pill",
  component: Pill,
} satisfies Meta<typeof Pill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    count: 12,
  },
};

export const OneCase: Story = {
  args: {
    count: 1,
  },
};
