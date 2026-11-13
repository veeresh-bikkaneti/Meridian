import { useEffect, useRef, useState } from "react";
import { CardFilm } from "@/components/card-film";
import type { JournalClip, MotionTier, UnitItem } from "../types.ts";
import { checkAnswer, getInteractiveSpec, isInteractiveItem } from "../interactions.ts";
import { getJournalFilm } from "../journal-films.ts";
import { BridgeCard } from "./BridgeCard.tsx";
import { cartsPredictSeeScene } from "../scenes/CartsPredictSee.ts";

export interface ProblemCardProps {
  item: UnitItem | JournalClip;
  motionTier: MotionTier;
  onCorrectAnswer?: (item: UnitItem | JournalClip) => void;
  onClose?: () => void;
}

export function ProblemCard({
  item,
  motionTier,
  onCorrectAnswer,
  onClose,
}: ProblemCardProps) {
  const isInteractive = isInteractiveItem(item.id);
  const spec = isInteractive ? getInteractiveSpec(item.id) : null;
  const film = getJournalFilm(item.id);

  const [selectedChoice, setSelectedChoice] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; reason: string } | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [solved, setSolved] = useState(false);

  // Predict-see scene mount container
  const sceneMountRef = useRef<HTMLDivElement | null>(null);
  const sceneHandleRef = useRef<{ dispose: () => void } | null>(null);
  const [scenePlaying, setScenePlaying] = useState(false);

  // Clean up any mounted predict-see scene on unmount
  useEffect(() => {
    return () => {
      sceneHandleRef.current?.dispose();
      sceneHandleRef.current = null;
    };
  }, []);

  // Standard code & source
  const standardCode =
    "standardCode" in item && item.standardCode
      ? item.standardCode
      : typeof item.standard === "object" && item.standard && "code" in item.standard
        ? item.standard.code
        : typeof item.standard === "string"
          ? item.standard
          : null;

  // Handle choice submission
  async function handleSelectChoice(value: string | number) {
    if (feedback?.correct && !spec?.stepTwo) return;

    setSelectedChoice(value);

    // If physics predict-see
    if (spec?.type === "predict-see") {
      const result = checkAnswer(item.id, value);
      setFeedback(result);

      if (sceneMountRef.current) {
        setScenePlaying(true);
        sceneHandleRef.current?.dispose();
        const handle = await cartsPredictSeeScene.mount(sceneMountRef.current, motionTier);
        sceneHandleRef.current = handle;
        await handle.play(value === "cart-a" ? 0 : 1);
        setScenePlaying(false);
      }

      if (result.correct) {
        setSolved(true);
        onCorrectAnswer?.(item);
      }
      return;
    }

    // If journal two-step
    if (spec?.type === "journal-two-step") {
      if (step === 1) {
        const result = checkAnswer(item.id, value, 1);
        setFeedback(result);
        if (result.correct) {
          // Advance to video slot & retrieval step
          setTimeout(() => {
            setStep(2);
            setSelectedChoice(null);
            setFeedback(null);
          }, 900);
        }
      } else {
        const result = checkAnswer(item.id, value, 2);
        setFeedback(result);
        if (result.correct) {
          setSolved(true);
          onCorrectAnswer?.(item);
        }
      }
      return;
    }

    // Standard multiple choice
    const result = checkAnswer(item.id, value);
    setFeedback(result);
    if (result.correct) {
      setSolved(true);
      onCorrectAnswer?.(item);
    }
  }

  return (
    <article
      className="playlab-problem-card"
      data-testid="playlab-problem-card"
      aria-labelledby="problem-hook"
    >
      <div className="playlab-problem-header">
        <span className="playlab-subject-badge">
          {"subjectId" in item ? item.subjectId.toUpperCase() : "JOURNAL RECOVERY"}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="playlab-close-btn"
            aria-label="Close case"
            data-testid="problem-card-close"
          >
            ✕
          </button>
        )}
      </div>

      {/* The WHY text first, big, as the hook */}
      <h2 id="problem-hook" className="playlab-problem-why">
        &ldquo;{item.why}&rdquo;
      </h2>

      {/* The skill name / objective second */}
      <div className="playlab-problem-skill">
        <span className="playlab-skill-label">Target Skill:</span>
        <p className="playlab-skill-objective">{item.objective}</p>
      </div>

      {/* Interaction Body */}
      <div className="playlab-interaction-area">
        {isInteractive && spec ? (
          <div className="playlab-active-interaction" data-testid="active-interaction">
            {/* Step indicator for 2-step journal */}
            {spec.stepTwo && (
              <div className="playlab-step-indicator">
                <span className={`playlab-step-dot ${step === 1 ? "active" : "done"}`}>
                  Step 1: Construction Years
                </span>
                <span className="playlab-step-divider">➔</span>
                <span className={`playlab-step-dot ${step === 2 ? "active" : ""}`}>
                  Step 2: Video Evidence & Retrieval
                </span>
              </div>
            )}

            {/* Prompt */}
            <p className="playlab-prompt-text">
              {step === 1 ? spec.prompt : spec.stepTwo?.prompt}
            </p>

            {/* Video Slot for Journal */}
            {spec.type === "journal-two-step" && step === 2 && (
              <div className="playlab-video-slot" data-testid="journal-video-slot">
                <div className="playlab-video-poster">
                  <div className="playlab-video-badge">clip not rendered yet</div>
                  <div className="playlab-video-place">
                    🏛️ Lincoln Memorial, Washington, D.C.
                  </div>
                </div>
                <div className="playlab-video-captions">
                  <span className="playlab-caption-tag">Caption Audio Transcript:</span>
                  <p>&ldquo;Inside, Lincoln sits, carved in marble.&rdquo;</p>
                </div>
              </div>
            )}

            {/* Predict-See simulation container */}
            {spec.type === "predict-see" && (
              <div
                ref={sceneMountRef}
                className="playlab-predict-see-mount"
                data-testid="predict-see-canvas"
                aria-label="3D Cart race simulation"
              />
            )}

            {/* Choice buttons */}
            <div
              role="group"
              aria-label="Answer options"
              className="playlab-choices-grid"
            >
              {(step === 1 ? spec.choices : spec.stepTwo?.choices || []).map((choice) => {
                const isSelected = selectedChoice === choice.value;
                const isCorrect =
                  feedback?.correct &&
                  (step === 1 ? spec.correctValue : spec.stepTwo?.correctValue) ===
                    choice.value;

                return (
                  <button
                    key={String(choice.value)}
                    type="button"
                    onClick={() => handleSelectChoice(choice.value)}
                    disabled={scenePlaying || solved}
                    className={`playlab-choice-btn ${
                      isSelected ? "selected" : ""
                    } ${isCorrect ? "correct" : ""}`}
                    data-testid={`choice-${choice.value}`}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>

            {/* Result Feedback */}
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className={`playlab-feedback-banner ${
                  feedback.correct ? "feedback-success" : "feedback-retry"
                }`}
                data-testid="feedback-banner"
              >
                <div className="playlab-feedback-icon">
                  {feedback.correct ? "✓" : "!"}
                </div>
                <div className="playlab-feedback-text">
                  <strong>{feedback.correct ? "Solved!" : "Try again:"}</strong>{" "}
                  {feedback.reason}
                </div>
              </div>
            )}
          </div>
        ) : film ? (
          <div className="playlab-journal-film" data-testid="journal-film-ready">
            <p className="playlab-journal-film-place">{film.placeName}</p>
            <CardFilm
              className="playlab-journal-film-frame"
              media={{
                videoUrl: film.videoUrl,
                posterUrl: film.posterUrl,
                stillUrl: film.stillUrl,
              }}
              testId={`journal-film-${film.id}`}
            />
            <p className="playlab-journal-caption" data-testid="journal-film-caption">
              {film.caption}
            </p>
          </div>
        ) : (
          <div className="playlab-coming-soon-box" data-testid="coming-soon-stamp">
            <div className="playlab-stamp-seal">Coming soon</div>
            <p className="playlab-stamp-note">
              This unit item is part of the curriculum plan. Interactive simulation and question
              payloads are scheduled for the next development slice.
            </p>
          </div>
        )}
      </div>

      {/* Standard Footnote */}
      {standardCode && (
        <footer className="playlab-standard-footnote">
          <span className="playlab-standard-tag">STANDARD</span>
          <span className="playlab-standard-code">{standardCode}</span>
        </footer>
      )}

      {/* Bridge Card unlocks on solve or view */}
      {solved && (
        <div className="playlab-problem-bridge-wrapper">
          <BridgeCard item={item} onContinue={onClose} />
        </div>
      )}
    </article>
  );
}

