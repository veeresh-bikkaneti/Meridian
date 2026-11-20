import type { Meta, StoryObj } from "@storybook/react";
import { SiteHeader } from "./site-header.tsx";
import { Button } from "./button.tsx";

const meta = {
  title: "UI/SiteHeader",
  component: SiteHeader,
} satisfies Meta<typeof SiteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// Slot contents mirror the shell's own render test
// (shared-shell.test.ts): the onHome surface, action nav items, and
// host-built status / mute / end-game nodes in the fixed slot order.
export const Default: Story = {
  args: {
    onHome: () => {},
    navItems: [
      { label: "What's coming", onClick: () => {} },
      { label: "Get involved", onClick: () => {} },
    ],
    status: <span>Case #3</span>,
    mute: <button type="button">Sound</button>,
    endGame: <Button variant="secondary">End game</Button>,
  },
};

export const OnMap: Story = {
  args: {
    onHome: () => {},
    variant: "map",
    status: null,
    mute: null,
  },
};
