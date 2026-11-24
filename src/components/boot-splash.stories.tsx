import type { Meta, StoryObj } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { PageShell } from "./ui/page-shell.tsx";
import { BootSplash } from "./boot-splash.tsx";

// TD-05.2 mockup: the boot splash inside the shared shell it will
// adopt in the Phase 2 shell sweep. The composition is the real
// PageShell (SiteHeader + PageColumn + SiteFooter) around the real
// BootSplash — nothing about the screen itself is redrawn.
// PageShell's footer renders router Links, so the story carries the
// shell stories' own router wrapper (site-footer.stories.tsx): a
// real TanStack router on a memory history, the story as root route.
// The header takes the in-app onHome form (site-header.stories.tsx),
// and status / mute are null: this screen has no status readout and
// plays no audio. The splash still renders its own main landmark today —
// that is the pageLocalMain baseline entry the later production PR
// removes; the mockup shows the target frame around it.
const meta = {
  title: "Screens/BootSplash",
  component: PageShell,
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
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const shellArgs = {
  header: { onHome: () => {}, status: null, mute: null },
  width: "narrow" as const,
  children: <BootSplash />,
};

export const Desktop: Story = {
  args: shellArgs,
};

export const Mobile: Story = {
  args: shellArgs,
  decorators: [
    (Story) => (
      <div style={{ width: 390, margin: "0 auto" }}>
        <Story />
      </div>
    ),
  ],
};
