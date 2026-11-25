import type { Meta, StoryObj } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AppErrorComponent } from "./error-component.tsx";

// The router error screen (TD-05.3): AppErrorComponent renders the
// shared ErrorScreen itself — SiteHeader with the Meridian home
// lockup, the narrow PageColumn, the pinned blameless copy and the
// two exits (Try again, Home). The story renders the real component
// with no extra frame. SiteHeader can render router Links, so the
// story carries the shell stories' own router wrapper: a real
// TanStack router on a memory history, the story as root route.
const meta = {
  title: "Screens/ErrorComponent",
  component: AppErrorComponent,
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
} satisfies Meta<typeof AppErrorComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const errorArgs = {
  error: new Error("Example error, shown so the page can be reviewed."),
  reset: () => {},
};

export const Desktop: Story = {
  args: errorArgs,
};

export const Mobile: Story = {
  args: errorArgs,
  decorators: [
    (Story) => (
      <div style={{ width: 390, margin: "0 auto" }}>
        <Story />
      </div>
    ),
  ],
};
