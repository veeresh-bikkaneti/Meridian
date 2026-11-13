import { CardFilm } from "@/components/card-film";
import quietHourVtt from "../../../docs/scaling/journals/world-wars/captions/quiet-hour.vtt?raw";
import schoolMorningVtt from "../../../docs/scaling/journals/world-wars/captions/school-morning.vtt?raw";
import { getJournalClipById } from "../data.ts";
import {
  captionFromVtt,
  isJournalStillClip,
  narrationUrlForSlug,
  stillSlug,
  stillUrlForSlug,
  videoUrlForFile,
  type JournalStillClipId,
} from "../journal-still.ts";

const VTT_BY_ID: Record<JournalStillClipId, string> = {
  "world-wars:school-morning": schoolMorningVtt,
  "world-wars:quiet-hour": quietHourVtt,
};

export function JournalStillPanel({ clipId }: { clipId: string }) {
  if (!isJournalStillClip(clipId)) return null;
  const clip = getJournalClipById(clipId);
  if (!clip) return null;
  const slug = stillSlug(clipId);
  const stillUrl = stillUrlForSlug(slug);
  const caption = captionFromVtt(VTT_BY_ID[clipId]);
  return (
    <div className="playlab-journal-still" data-testid={`journal-still-${slug}`}>
      <div className="playlab-journal-still-frame">
        <CardFilm
          media={{
            videoUrl: videoUrlForFile(clip.file),
            posterUrl: stillUrl,
            stillUrl,
          }}
          testId={`card-film-${slug}`}
        />
      </div>
      <p className="playlab-journal-place">{clip.place.name}</p>
      <p className="playlab-journal-caption">{caption}</p>
      <audio
        className="playlab-journal-audio"
        controls
        preload="none"
        src={narrationUrlForSlug(slug)}
        data-testid={`journal-narration-${slug}`}
      />
    </div>
  );
}
