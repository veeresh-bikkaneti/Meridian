import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button.tsx";

const meta = {
  title: "UI/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Continue",
  },
};

export const Secondary: Story = {
  args: {
    children: "End game",
    variant: "secondary",
  },
};
