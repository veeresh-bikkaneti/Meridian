import type { Meta, StoryObj } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { BootSplash } from "./boot-splash.tsx";

// The boot splash renders inside the shared page shell (SiteHeader +
// PageColumn + SiteFooter). The home link and the footer render router
// Links, so the story carries the shell stories' own router wrapper
// (site-footer.stories.tsx): a real TanStack router on a memory
// history, the story as root route.
const meta = {
  title: "Screens/BootSplash",
  component: BootSplash,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => {
      const rootRoute = createRootRoute({ component: Story });
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
      return <RouterProvider router={router} />;
    },
  ],
} satisfies Meta<typeof BootSplash>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 390, margin: "0 auto" }}>
        <Story />
      </div>
    ),
  ],
};
