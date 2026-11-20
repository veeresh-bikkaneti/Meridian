import type { Meta, StoryObj } from "@storybook/react";
import { PageColumn } from "./page-column.tsx";

const meta = {
  title: "UI/PageColumn",
  component: PageColumn,
} satisfies Meta<typeof PageColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleContent = (
  <>
    <h1>A page heading</h1>
    <p>Body text sits in the one centred column every page uses.</p>
  </>
);

export const Default: Story = {
  args: {
    children: sampleContent,
  },
};

export const Narrow: Story = {
  args: {
    width: "narrow",
    children: sampleContent,
  },
};
