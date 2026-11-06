/**
 * SoundToggle.tsx — the ONE speaker toggle for the whole app (SFX audio
 * spec §4), extracted from game-app.tsx for PR C (Sound Everywhere).
 *
 * Why its own file: game-app.tsx lazy-loads the GeoDetective and Cold
 * Trail screens, so those screens importing the toggle back from
 * game-app.tsx would close an import cycle. One implementation, shared
 * by every host — home header, map-quiz chrome, GeoDetective, Cold
 * Trail, and the detective pair's speaker chip — never a copy.
 *
 * Behaviour (unchanged from the game-app original): persisted under
 * `meridian.sound`, default ON, and the single control for ALL sounds —
 * every play call goes through the `isSoundEnabled()` gate. Turning ON
 * plays the card tap as confirmation; OFF is silent. This toggle is the
 * "reduced sound" control — reduced motion never mutes audio (§4.6).
 *
 * Instances CAN co-mount now (the pair chip sits beside the
 * GeoDetective screen toggle), so the icon state subscribes to
 * `onSoundChanged`: a flip from any instance — or from tapping Holmes —
 * updates every other mounted instance in the same event.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isSoundEnabled,
  onSoundChanged,
  playCardTap,
  setSoundEnabled,
} from "@/game/audio/sfx";

export function SoundToggle({
  testId,
  className,
  style,
  iconClassName = "size-5",
}: {
  testId: string;
  className?: string;
  style?: CSSProperties;
  iconClassName?: string;
}) {
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  // Keep co-mounted instances in sync: whichever control (or character
  // tap) flips the persisted value, every toggle shows the same state.
  useEffect(() => onSoundChanged((on) => setSoundOn(on)), []);
  const toggleSound = () => {
    try {
      const next = !soundOn;
      setSoundEnabled(next);
      setSoundOn(next);
      if (next) playCardTap();
    } catch {
      // Sound is enhancement-only; the toggle itself never throws.
    }
  };
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={soundOn}
      aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
      title={soundOn ? "Sound on" : "Sound off"}
      onClick={toggleSound}
      className={className}
      style={style}
    >
      {soundOn ? (
        <Volume2 className={iconClassName} aria-hidden="true" />
      ) : (
        <VolumeX className={iconClassName} aria-hidden="true" />
      )}
    </button>
  );
}
