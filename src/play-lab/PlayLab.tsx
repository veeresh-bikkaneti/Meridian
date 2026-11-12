import { useEffect, useState } from "react";
import type { AgeGroup, JournalClip, MotionTier, PlayLabTab, UnitItem } from "./types.ts";
import { getSystemMotionTier } from "./motion.ts";
import { PlayLabHeader } from "./components/PlayLabHeader.tsx";
import { FlowACaseFile } from "./components/FlowACaseFile.tsx";
import { FlowBAtlasSkills } from "./components/FlowBAtlasSkills.tsx";
import { getAgeGroup, loadProfile, saveBand } from "@/game/age-profile/store.ts";
import type { AgeBandId, AgeProfile } from "@/game/age-profile/types.ts";
import { AgePicker } from "@/components/age-profile/AgePicker.tsx";
import { CelebrationOverlay } from "@/components/celebration-overlay.tsx";
import "./play-lab.css";

declare global {
  interface Window {
    __meridian_ready?: boolean;
  }
}

export function PlayLab() {
  const [activeTab, setActiveTab] = useState<PlayLabTab>("case-file");
  const [motionTier, setMotionTier] = useState<MotionTier>(() => getSystemMotionTier());

  // Signal ready to _shell.html crash watchdog
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.__meridian_ready = true;
      } catch {
        /* best-effort */
      }
    }
  }, []);

  // Listen to prefers-reduced-motion setting changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => {
      if (mq.matches) setMotionTier("flat");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Age group state initialized from stored profile
  const [profile, setProfile] = useState<AgeProfile>(() => loadProfile());
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(() => getAgeGroup());
  const [showAgePicker, setShowAgePicker] = useState<boolean>(() => profile.status === "unset");
  const [pendingBand, setPendingBand] = useState<AgeBandId | null>(() => profile.band);

  // Celebration state
  const [celebration, setCelebration] = useState<{
    open: boolean;
    title: string;
    body: string;
  }>({
    open: false,
    title: "",
    body: "",
  });

  function handleSaveAgePicker() {
    if (pendingBand) {
      setAgeGroup(pendingBand as AgeGroup);
      const updated = saveBand(pendingBand, { runInProgress: false });
      setProfile(updated);
    }
    setShowAgePicker(false);
  }

  function handleItemSolved(item: UnitItem | JournalClip) {
    const title = "objective" in item ? "Skill Connected!" : "Evidence Recorded!";
    const body = item.why;

    setCelebration({
      open: true,
      title,
      body,
    });
  }

  return (
    <main className="playlab-root" data-testid="playlab-root">
      <PlayLabHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        ageGroup={ageGroup}
        onChangeAgeGroupClick={() => {
          setPendingBand(ageGroup as AgeBandId);
          setShowAgePicker(true);
        }}
        motionTier={motionTier}
        onSelectMotionTier={setMotionTier}
      />

      <div className="playlab-content">
        {activeTab === "case-file" ? (
          <FlowACaseFile
            ageGroup={ageGroup}
            motionTier={motionTier}
            onSolveItem={handleItemSolved}
          />
        ) : (
          <FlowBAtlasSkills
            ageGroup={ageGroup}
            motionTier={motionTier}
            onSolveItem={handleItemSolved}
          />
        )}
      </div>

      {/* AgePicker Modal */}
      {showAgePicker && (
        <div className="playlab-modal-backdrop" role="dialog" aria-modal="true">
          <div className="playlab-modal-content">
            <AgePicker
              profile={profile}
              selected={pendingBand}
              onSelect={(band) => setPendingBand(band)}
              onSave={handleSaveAgePicker}
              onCancel={() => setShowAgePicker(false)}
              onClear={() => {
                setPendingBand(null);
                setAgeGroup("7-10");
                setShowAgePicker(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      {celebration.open && (
        <CelebrationOverlay
          variant="mystery-solved"
          character="nova"
          title={celebration.title}
          body={celebration.body}
          onDismiss={() => setCelebration((prev) => ({ ...prev, open: false }))}
          motionOff={motionTier === "flat"}
        />
      )}
    </main>
  );
}
