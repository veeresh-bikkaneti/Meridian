import { CardFilm } from "@/components/card-film.tsx";
import { greatLeadersMedia } from "../great-leaders-media.ts";

export function JournalClipFilm({ clipId }: { clipId: string }) {
  const media = greatLeadersMedia(clipId);
  if (!media) return null;

  return (
    <div className="playlab-video-slot" data-testid="journal-video-slot">
      <div className="playlab-clip-frame">
        <CardFilm
          className="playlab-clip-film"
          testId={`clip-film-${clipId}`}
          media={{
            videoUrl: media.videoUrl,
            posterUrl: media.stillUrl,
            stillUrl: media.stillUrl,
          }}
        />
      </div>
      <div className="playlab-video-captions">
        <span className="playlab-caption-tag">Caption</span>
        <p data-testid="clip-caption">{media.captionText}</p>
      </div>
      {media.narrationUrl ? (
        <audio
          src={media.narrationUrl}
          controls
          preload="none"
          data-testid="clip-narration"
        />
      ) : null}
    </div>
  );
}
