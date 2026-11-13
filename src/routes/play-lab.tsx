import { createFileRoute } from "@tanstack/react-router";
import { PlayLab } from "@/play-lab/PlayLab.tsx";

export const Route = createFileRoute("/play-lab")({
  head: () => ({
    meta: [
      { title: "Play Lab — Scale Features Preview" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayLab,
});
