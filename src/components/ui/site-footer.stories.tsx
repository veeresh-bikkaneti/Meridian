import type { Meta, StoryObj } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { SiteFooter } from "./site-footer.tsx";

// SiteFooter always renders router Links (the shared route list from
// site-links.ts), so it needs a real router context. The wrapper is
// the shell tests' own pattern (brand-home-button.test.ts): a real
// TanStack router on a memory history, the story as its root route.
const meta = {
  title: "UI/SiteFooter",
  component: SiteFooter,
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
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onGrownUps: () => {},
    onTakeTour: () => {},
  },
};

export const Wide: Story = {
  args: {
    onGrownUps: () => {},
    onTakeTour: () => {},
    width: "wide",
  },
};
