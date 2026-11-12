import type { AgeGroup, MotionTier, PlayLabTab } from "../types.ts";

export interface PlayLabHeaderProps {
  activeTab: PlayLabTab;
  onSelectTab: (tab: PlayLabTab) => void;
  ageGroup: AgeGroup;
  onChangeAgeGroupClick: () => void;
  motionTier: MotionTier;
  onSelectMotionTier: (tier: MotionTier) => void;
}

export function PlayLabHeader({
  activeTab,
  onSelectTab,
  ageGroup,
  onChangeAgeGroupClick,
  motionTier,
  onSelectMotionTier,
}: PlayLabHeaderProps) {
  return (
    <header className="playlab-header" role="banner">
      <div className="playlab-header-top">
        <div className="playlab-brand">
          <span className="playlab-logo-pill">LAB MOCKUP</span>
          <h1 className="playlab-title">Meridian Play Lab</h1>
          <span className="playlab-tagline">Scale Features: Subjects + Journals</span>
        </div>

        <div className="playlab-header-controls">
          {/* Age Group Control */}
          <div className="playlab-control-group">
            <span className="playlab-control-label">Age Band</span>
            <button
              type="button"
              onClick={onChangeAgeGroupClick}
              className="playlab-pill-btn"
              data-testid="age-group-pill"
              aria-label={`Current age band: Ages ${ageGroup}. Tap to change.`}
            >
              <span>Ages {ageGroup}</span>
              <span className="playlab-caret" aria-hidden="true">▾</span>
            </button>
          </div>

          {/* Motion Tier Selector */}
          <div className="playlab-control-group">
            <span className="playlab-control-label">Motion Tier</span>
            <div
              role="radiogroup"
              aria-label="Motion Tier"
              className="playlab-tier-toggle"
              data-testid="motion-tier-toggle"
            >
              {(["full", "lite", "flat"] as MotionTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  role="radio"
                  aria-checked={motionTier === tier}
                  onClick={() => onSelectMotionTier(tier)}
                  className={`playlab-tier-btn ${motionTier === tier ? "active" : ""}`}
                  data-testid={`motion-tier-${tier}`}
                >
                  {tier === "full" ? "Full 3D" : tier === "lite" ? "Lite CSS" : "Flat"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Flow Tabs */}
      <nav className="playlab-tabs" role="tablist" aria-label="Mockup Candidate Flows">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "case-file"}
          aria-controls="tabpanel-case-file"
          id="tab-case-file"
          onClick={() => onSelectTab("case-file")}
          className={`playlab-tab-btn ${activeTab === "case-file" ? "active" : ""}`}
          data-testid="tab-case-file"
        >
          <span className="playlab-tab-num">Flow A</span>
          <span className="playlab-tab-title">Case File</span>
          <span className="playlab-tab-sub">Holmes &amp; Watson</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "atlas-skills"}
          aria-controls="tabpanel-atlas-skills"
          id="tab-atlas-skills"
          onClick={() => onSelectTab("atlas-skills")}
          className={`playlab-tab-btn ${activeTab === "atlas-skills" ? "active" : ""}`}
          data-testid="tab-atlas-skills"
        >
          <span className="playlab-tab-num">Flow B</span>
          <span className="playlab-tab-title">Atlas of Skills</span>
          <span className="playlab-tab-sub">3D Constellation &amp; Globe</span>
        </button>
      </nav>
    </header>
  );
}

