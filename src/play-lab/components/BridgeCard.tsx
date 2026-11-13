import type { BridgeLink, UnitItem, JournalClip } from "../types.ts";
import { parseBridgeLinks } from "../data.ts";

export interface BridgeCardProps {
  item: UnitItem | JournalClip;
  onContinue?: () => void;
}

export function BridgeCard({ item, onContinue }: BridgeCardProps) {
  const links = parseBridgeLinks(item);

  return (
    <div
      role="region"
      aria-label="Cross-subject bridge connections"
      className="playlab-bridge-card"
      data-testid="playlab-bridge-card"
    >
      <div className="playlab-bridge-banner">
        <span className="playlab-bridge-kicker">Cross-Disciplinary Transfer</span>
        <h3 className="playlab-bridge-headline">You just used this in...</h3>
        <p className="playlab-bridge-sub">
          The skill you just practiced doesn&rsquo;t stay inside one subject. Here is where it connects:
        </p>
      </div>

      <div className="playlab-bridge-stage">
        {/* Animated Brass Thread connecting subjects */}
        <svg
          className="playlab-brass-thread-svg"
          viewBox="0 0 500 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M 40 60 C 140 20, 200 100, 320 60 C 380 40, 420 50, 460 60"
            stroke="var(--atlas-brass)"
            strokeWidth="2.5"
            strokeDasharray="8 6"
            className="playlab-thread-path"
          />
          <circle cx="40" cy="60" r="5" fill="var(--atlas-brass)" />
          <circle cx="460" cy="60" r="5" fill="var(--atlas-brass)" />
        </svg>

        <div className="playlab-bridge-links-grid">
          {links.length > 0 ? (
            links.map((link, idx) => (
              <div key={idx} className="playlab-bridge-node">
                <div className="playlab-bridge-node-header">
                  <span className="playlab-bridge-target-pill">{link.toSubject}</span>
                  <span className="playlab-bridge-arrow" aria-hidden="true">➔</span>
                </div>
                <p className="playlab-bridge-node-desc">{link.description}</p>
              </div>
            ))
          ) : (
            <div className="playlab-bridge-node">
              <span className="playlab-bridge-target-pill">Real World Application</span>
              <p className="playlab-bridge-node-desc">
                Applying foundational principles to everyday decisions, spatial reasoning, and discovery.
              </p>
            </div>
          )}
        </div>
      </div>

      {onContinue && (
        <div className="playlab-bridge-actions">
          <button
            type="button"
            onClick={onContinue}
            className="playlab-btn playlab-btn-primary"
            data-testid="bridge-continue-btn"
          >
            Continue Exploring
          </button>
        </div>
      )}
    </div>
  );
}
