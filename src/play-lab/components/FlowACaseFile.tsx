import { useState } from "react";
import type { AgeGroup, JournalClip, MotionTier, SubjectId, UnitItem } from "../types.ts";
import { getAllItems, getJournalClipsForAgeGroup, getItemsForSubject } from "../data.ts";
import { isInteractiveItem } from "../interactions.ts";
import { HolmesRig, WatsonRig } from "@/game/loop/detective/DetectivePair.tsx";
import { ProblemCard } from "./ProblemCard.tsx";

export interface FlowACaseFileProps {
  ageGroup: AgeGroup;
  motionTier: MotionTier;
  onSolveItem: (item: UnitItem | JournalClip) => void;
}

export function FlowACaseFile({
  ageGroup,
  motionTier,
  onSolveItem,
}: FlowACaseFileProps) {
  const [selectedItem, setSelectedItem] = useState<UnitItem | JournalClip | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | "journal" | "all">("all");
  const [holmesPose, setHolmesPose] = useState<"announce" | "card-look" | "celebrate-jump">("announce");
  const [watsonPose, setWatsonPose] = useState<"read" | "think" | "clap">("read");

  // Fetch items for current age group
  const allItems = getAllItems().filter((item) => {
    if (ageGroup === "18+") return true;
    if (ageGroup === "10-18") return item.group === "7-10" || item.group === "10-18";
    return item.group === "7-10";
  });

  const journalClips = getJournalClipsForAgeGroup(ageGroup);

  const displayedItems =
    subjectFilter === "all"
      ? allItems
      : subjectFilter === "journal"
        ? []
        : allItems.filter((i) => i.subjectId === subjectFilter);

  const displayedJournals =
    subjectFilter === "all" || subjectFilter === "journal" ? journalClips : [];

  function handleOpenCase(item: UnitItem | JournalClip) {
    setSelectedItem(item);
    setHolmesPose("card-look");
    setWatsonPose("think");
  }

  function handleCloseCase() {
    setSelectedItem(null);
    setHolmesPose("announce");
    setWatsonPose("read");
  }

  function handleCaseSolved(item: UnitItem | JournalClip) {
    setHolmesPose("celebrate-jump");
    setWatsonPose("clap");
    onSolveItem(item);
  }

  return (
    <section
      id="tabpanel-case-file"
      role="tabpanel"
      aria-labelledby="tab-case-file"
      className="playlab-flow-container flow-a-case-file"
      data-testid="flow-a-container"
    >
      {/* Detective Pair Header Rig */}
      <div className="playlab-detectives-stage">
        <div className="playlab-detective-figures">
          <div className="playlab-rig-wrapper holmes" aria-label="Sherlock Holmes">
            <HolmesRig pose={holmesPose} facing="right" />
          </div>
          <div className="playlab-rig-wrapper watson" aria-label="Dr. John Watson">
            <WatsonRig pose={watsonPose} facing="left" />
          </div>
        </div>

        <div className="playlab-dialogue-bubble">
          <div className="playlab-dialogue-speaker">
            {holmesPose === "celebrate-jump" ? "Dr. Watson" : "Sherlock Holmes"}
          </div>
          <p className="playlab-dialogue-text">
            {holmesPose === "celebrate-jump" ? (
              <span>
                &ldquo;Brilliant deduction, Holmes! Look closely in my notebook — this very skill
                connects directly to other subjects on the atlas!&rdquo;
              </span>
            ) : selectedItem ? (
              <span>
                &ldquo;Examine the clue carefully, Watson! Before we touch any equation, we must answer:{" "}
                <strong>why does this problem exist in the real world?</strong>&rdquo;
              </span>
            ) : (
              <span>
                &ldquo;A new set of cases across the sciences, Watson! Every mystery begins with a real
                problem. Select any docket below to begin our investigation.&rdquo;
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Case Ledger or Open Case File */}
      {selectedItem ? (
        <div className="playlab-open-case-view">
          <div className="playlab-case-top-actions">
            <button
              type="button"
              onClick={handleCloseCase}
              className="playlab-back-ledger-btn"
              data-testid="back-to-ledger-btn"
            >
              ← Back to Case Ledger
            </button>
            <span className="playlab-case-id-tag">Case ID: {selectedItem.id}</span>
          </div>

          <ProblemCard
            item={selectedItem}
            motionTier={motionTier}
            onCorrectAnswer={handleCaseSolved}
            onClose={handleCloseCase}
          />
        </div>
      ) : (
        <div className="playlab-case-ledger-view">
          <div className="playlab-ledger-header">
            <div>
              <h2 className="playlab-ledger-title">The Case Ledger</h2>
              <p className="playlab-ledger-sub">
                Curated problems for <strong>Ages {ageGroup}</strong>. Six cases feature real, playable
                solving interactions.
              </p>
            </div>

            {/* Subject Filter Pills */}
            <div role="radiogroup" aria-label="Filter cases by subject" className="playlab-filter-pills">
              {[
                { id: "all", label: "All Cases" },
                { id: "math", label: "Math" },
                { id: "physics", label: "Physics" },
                { id: "chemistry", label: "Chemistry" },
                { id: "social-studies", label: "Social Studies" },
                { id: "general-knowledge", label: "General Knowledge" },
                { id: "journal", label: "Case Evidence (Journals)" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  role="radio"
                  aria-checked={subjectFilter === pill.id}
                  onClick={() => setSubjectFilter(pill.id as SubjectId | "journal" | "all")}
                  className={`playlab-pill-btn ${subjectFilter === pill.id ? "active" : ""}`}
                  data-testid={`filter-${pill.id}`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Featured Docket */}
          <div className="playlab-docket-section">
            <div className="playlab-docket-section-header">
              <span className="playlab-stamp-badge">ACTIVE DOSSIERS</span>
              <h3>Interactive Field Problems</h3>
            </div>

            <div className="playlab-cases-grid">
              {displayedItems
                .filter((item) => isInteractiveItem(item.id))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenCase(item)}
                    className="playlab-case-docket-card featured"
                    data-testid={`case-card-${item.id}`}
                  >
                    <div className="playlab-card-top-row">
                      <span className="playlab-case-subject-tag">{item.subjectId}</span>
                      <span className="playlab-badge-interactive">Playable</span>
                    </div>
                    <h4 className="playlab-card-why">&ldquo;{item.why}&rdquo;</h4>
                    <p className="playlab-card-objective">{item.objective}</p>
                    <div className="playlab-card-footer">
                      <span className="playlab-card-standard">{item.standardCode || "Standard"}</span>
                      <span className="playlab-card-cta">Open Case File ➔</span>
                    </div>
                  </button>
                ))}

              {displayedJournals
                .filter((j) => isInteractiveItem(j.id))
                .map((journal) => (
                  <button
                    key={journal.id}
                    type="button"
                    onClick={() => handleOpenCase(journal)}
                    className="playlab-case-docket-card featured journal"
                    data-testid={`case-card-${journal.id}`}
                  >
                    <div className="playlab-card-top-row">
                      <span className="playlab-case-subject-tag">Journal Evidence</span>
                      <span className="playlab-badge-interactive">Playable</span>
                    </div>
                    <h4 className="playlab-card-why">&ldquo;{journal.why}&rdquo;</h4>
                    <p className="playlab-card-objective">{journal.place.name}</p>
                    <div className="playlab-card-footer">
                      <span className="playlab-card-standard">{journal.standardCode || "Historical"}</span>
                      <span className="playlab-card-cta">Inspect Evidence ➔</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* All Other Dockets */}
          <div className="playlab-docket-section">
            <div className="playlab-docket-section-header">
              <span className="playlab-stamp-badge faint">CURRICULUM DOCKETS</span>
              <h3>Upcoming Scale Items ({displayedItems.length + displayedJournals.length} total)</h3>
            </div>

            <div className="playlab-cases-grid">
              {displayedItems
                .filter((item) => !isInteractiveItem(item.id))
                .slice(0, 12)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenCase(item)}
                    className="playlab-case-docket-card"
                    data-testid={`case-card-${item.id}`}
                  >
                    <div className="playlab-card-top-row">
                      <span className="playlab-case-subject-tag">{item.subjectId}</span>
                      <span className="playlab-badge-preview">Preview</span>
                    </div>
                    <h4 className="playlab-card-why">&ldquo;{item.why}&rdquo;</h4>
                    <p className="playlab-card-objective">{item.objective}</p>
                    <div className="playlab-card-footer">
                      <span className="playlab-card-standard">{item.standardCode || "Standard"}</span>
                      <span className="playlab-card-cta">View ➔</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
