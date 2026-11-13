import { useEffect, useRef, useState } from "react";
import type { AgeGroup, JournalClip, MotionTier, SubjectId, UnitItem } from "../types.ts";
import {
  getAllSubjects,
  getItemsForSubject,
  getJournalClipsForAgeGroup,
} from "../data.ts";
import { isInteractiveItem } from "../interactions.ts";
import {
  mountSkillConstellation,
  type ConstellationHandle,
} from "../scenes/SkillConstellationScene.ts";
import {
  mountMiniJournalGlobe,
  type MiniGlobeHandle,
} from "../scenes/MiniJournalGlobeScene.ts";
import { ProblemCard } from "./ProblemCard.tsx";

export interface FlowBAtlasSkillsProps {
  ageGroup: AgeGroup;
  motionTier: MotionTier;
  onSolveItem: (item: UnitItem | JournalClip) => void;
}

export function FlowBAtlasSkills({
  ageGroup,
  motionTier,
  onSolveItem,
}: FlowBAtlasSkillsProps) {
  const subjects = getAllSubjects();
  const [activeSubject, setActiveSubject] = useState<SubjectId>("math");
  const [selectedItem, setSelectedItem] = useState<UnitItem | JournalClip | null>(null);

  // References for Three.js mounts
  const constellationMountRef = useRef<HTMLDivElement | null>(null);
  const constellationHandleRef = useRef<ConstellationHandle | null>(null);

  const globeMountRef = useRef<HTMLDivElement | null>(null);
  const globeHandleRef = useRef<MiniGlobeHandle | null>(null);

  const activeItems = getItemsForSubject(activeSubject);
  const journalClips = getJournalClipsForAgeGroup(ageGroup);

  // Mount/update Constellation Three.js scene
  useEffect(() => {
    if (motionTier !== "full") {
      constellationHandleRef.current?.dispose();
      constellationHandleRef.current = null;
      return;
    }

    const mountEl = constellationMountRef.current;
    if (!mountEl) return;

    let disposed = false;
    constellationHandleRef.current?.dispose();

    mountSkillConstellation(mountEl, activeItems, ageGroup, (item) => {
      if (!disposed) setSelectedItem(item);
    }).then((handle) => {
      if (disposed) {
        handle.dispose();
      } else {
        constellationHandleRef.current = handle;
      }
    });

    return () => {
      disposed = true;
      constellationHandleRef.current?.dispose();
      constellationHandleRef.current = null;
    };
  }, [activeSubject, motionTier]);

  // Update constellation age group lighting
  useEffect(() => {
    constellationHandleRef.current?.updateAgeGroup(ageGroup);
  }, [ageGroup]);

  // Mount Mini Journal Globe
  useEffect(() => {
    if (motionTier !== "full") {
      globeHandleRef.current?.dispose();
      globeHandleRef.current = null;
      return;
    }

    const mountEl = globeMountRef.current;
    if (!mountEl) return;

    let disposed = false;
    globeHandleRef.current?.dispose();

    mountMiniJournalGlobe(mountEl, journalClips, (clip) => {
      if (!disposed) setSelectedItem(clip);
    }).then((handle) => {
      if (disposed) {
        handle.dispose();
      } else {
        globeHandleRef.current = handle;
      }
    });

    return () => {
      disposed = true;
      globeHandleRef.current?.dispose();
      globeHandleRef.current = null;
    };
  }, [journalClips, motionTier]);

  return (
    <section
      id="tabpanel-atlas-skills"
      role="tabpanel"
      aria-labelledby="tab-atlas-skills"
      className="playlab-flow-container flow-b-atlas-skills"
      data-testid="flow-b-container"
    >
      {/* Subject Shelf */}
      <div className="playlab-shelf-section">
        <div className="playlab-shelf-header">
          <span className="playlab-stamp-badge">SHELF PREVIEW</span>
          <h2>Subject Shelf</h2>
          <p>
            Choose a subject to project its celestial skill constellation. Stars matching{" "}
            <strong>Ages {ageGroup}</strong> glow in bright gold.
          </p>
        </div>

        <div role="radiogroup" aria-label="Subject selection" className="playlab-subject-cards-shelf">
          {subjects.map((sub) => {
            const isSelected = activeSubject === sub.id;
            const itemsInSub = getItemsForSubject(sub.id);
            const activeInSub = itemsInSub.filter((i) => i.group === ageGroup || ageGroup === "18+").length;

            return (
              <button
                key={sub.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setActiveSubject(sub.id)}
                className={`playlab-subject-card ${isSelected ? "selected" : ""}`}
                data-testid={`subject-card-${sub.id}`}
              >
                <div className="playlab-subject-icon">{sub.icon}</div>
                <h3 className="playlab-subject-title">{sub.title}</h3>
                <p className="playlab-subject-tagline">{sub.tagline}</p>
                <div className="playlab-subject-meta">
                  <span className="playlab-stars-count">★ {activeInSub} active stars</span>
                  <span className="playlab-total-units">{itemsInSub.length} units</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Constellation & Globe */}
      <div className="playlab-atlas-visual-stage">
        {/* Constellation Viewer */}
        <div className="playlab-constellation-box">
          <div className="playlab-visual-box-header">
            <div>
              <h3>
                {subjects.find((s) => s.id === activeSubject)?.title} Skill Constellation
              </h3>
              <span className="playlab-visual-hint">
                {motionTier === "full"
                  ? "3D WebGL orbit: Tap any glowing star to reveal its real-world problem."
                  : "2D projection: Select a star node below to inspect."}
              </span>
            </div>
            <span className="playlab-tier-badge">Tier: {motionTier}</span>
          </div>

          {motionTier === "full" ? (
            <div
              ref={constellationMountRef}
              className="playlab-three-mount constellation-canvas"
              data-testid="constellation-3d-mount"
            />
          ) : (
            /* 2D Fallback for Lite / Flat tiers */
            <div className="playlab-lite-constellation" data-testid="constellation-lite-view">
              <svg viewBox="0 0 600 320" className="playlab-lite-svg" aria-label="2D Skill Constellation">
                {/* Connecting lines */}
                {activeItems.map((item, idx) => {
                  const x1 = 50 + (idx * 55) % 500;
                  const y1 = 40 + ((idx * 47) % 220);
                  return item.buildsOn.map((dep, dIdx) => (
                    <line
                      key={`${item.id}-${dIdx}`}
                      x1={x1}
                      y1={y1}
                      x2={x1 - 40}
                      y2={y1 + 40}
                      stroke="var(--atlas-brass)"
                      strokeOpacity="0.3"
                      strokeWidth="1.5"
                    />
                  ));
                })}
                {/* Star nodes */}
                {activeItems.map((item, idx) => {
                  const x = 50 + (idx * 55) % 500;
                  const y = 40 + ((idx * 47) % 220);
                  const isMatch = item.group === ageGroup || ageGroup === "18+";
                  const isInteractive = isInteractiveItem(item.id);

                  return (
                    <g key={item.id} onClick={() => setSelectedItem(item)} className="cursor-pointer">
                      <circle
                        cx={x}
                        cy={y}
                        r={isInteractive ? 8 : isMatch ? 6 : 4}
                        fill={isInteractive ? "#ffffff" : isMatch ? "var(--atlas-brass)" : "#4a6b74"}
                        stroke={isInteractive ? "var(--atlas-brass)" : "none"}
                        strokeWidth="2"
                      />
                      <text x={x + 10} y={y + 4} fill="#f0e7d2" fontSize="10" fontFamily="Space Mono">
                        {item.id.split(":").pop()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Quick star picker list for accessibility / keyboard navigation */}
          <div className="playlab-star-accessibility-list">
            <span className="playlab-quick-label">Or jump directly to a star:</span>
            <div className="playlab-quick-chips">
              {activeItems.slice(0, 8).map((item) => {
                const isInteractive = isInteractiveItem(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={`playlab-chip-btn ${isInteractive ? "interactive" : ""}`}
                    data-testid={`star-chip-${item.id}`}
                  >
                    {isInteractive && "★ "}
                    {item.id.split(":").pop()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Small Journal Globe */}
        <div className="playlab-globe-box">
          <div className="playlab-visual-box-header">
            <div>
              <h3>Journal World Globe</h3>
              <span className="playlab-visual-hint">
                Historical memories pinned to latitude &amp; longitude
              </span>
            </div>
            <span className="playlab-pin-count">{journalClips.length} Pins</span>
          </div>

          {motionTier === "full" ? (
            <div
              ref={globeMountRef}
              className="playlab-three-mount globe-canvas"
              data-testid="globe-3d-mount"
            />
          ) : (
            <div className="playlab-lite-globe" data-testid="globe-lite-view">
              <div className="playlab-globe-disc">
                <span className="playlab-globe-disc-label">Atlas Map Projection</span>
              </div>
            </div>
          )}

          {/* Journal Pins Quick List */}
          <div className="playlab-globe-pins-list">
            {journalClips.map((clip) => {
              const isInteractive = isInteractiveItem(clip.id);
              return (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => setSelectedItem(clip)}
                  className={`playlab-pin-row ${isInteractive ? "highlight" : ""}`}
                  data-testid={`journal-pin-${clip.id}`}
                >
                  <span className="playlab-pin-marker">📍</span>
                  <div className="playlab-pin-info">
                    <span className="playlab-pin-name">{clip.place.name}</span>
                    <span className="playlab-pin-sub">
                      {clip.journal} ({clip.place.lat.toFixed(1)}°, {clip.place.lon.toFixed(1)}°)
                    </span>
                  </div>
                  {isInteractive && <span className="playlab-pin-badge">Playable</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Item Modal / Card View */}
      {selectedItem && (
        <div className="playlab-modal-backdrop" role="dialog" aria-modal="true">
          <div className="playlab-modal-content">
            <ProblemCard
              item={selectedItem}
              motionTier={motionTier}
              onCorrectAnswer={onSolveItem}
              onClose={() => setSelectedItem(null)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

