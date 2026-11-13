import { createFileRoute } from "@tanstack/react-router";
import { JournalClipCard } from "@/play-lab/journal-clip-card";
import { ROBBEN_ISLAND_CLIP_ID } from "@/play-lab/robben-island-clip.ts";

export const Route = createFileRoute("/play-lab")({
  head: () => ({ meta: [{ title: "Robben Island, Meridian" }] }),
  component: PlayLabClipPage,
});

function PlayLabClipPage() {
  return (
    <main>
      <JournalClipCard id={ROBBEN_ISLAND_CLIP_ID} />
    </main>
  );
}
