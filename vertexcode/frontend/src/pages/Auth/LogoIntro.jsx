import { useEffect, useState } from 'react';
import wmMark from '../../assets/wmorgan-mark.png';
import './logo-intro.css';

// Full-screen, one-shot splash that gates the Login page — nothing behind
// it (the login form, BrandingPanel, everything) is visible until this
// finishes, per the fixed z-100 overlay below. Pure CSS keyframes (no
// animation library needed for a linear, non-interactive timeline);
// `onComplete` fires once the exit fade finishes, so the caller can safely
// unmount this and reveal the real page. Timeline: 0-1.0s converging shard
// fragments, 1.0-1.5s the WM badge settles with a slight 3D tilt, 1.5-3.0s
// the wordmark/tagline reveal line by line, 3.0-3.7s a light sweep across
// the lockup, then a brief hold and a 0.5s fade into the login page.
const HOLD_UNTIL_MS = 3800;
const EXIT_DURATION_MS = 500;

export default function LogoIntro({ onComplete }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), HOLD_UNTIL_MS);
    const completeTimer = setTimeout(() => onComplete?.(), HOLD_UNTIL_MS + EXIT_DURATION_MS);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`wm-intro${exiting ? ' wm-intro-exit' : ''}`} role="presentation" aria-hidden="true">
      <span className="wm-intro-glow wm-intro-glow-red" />
      <span className="wm-intro-glow wm-intro-glow-green" />

      <span className="wm-shard wm-shard-1" />
      <span className="wm-shard wm-shard-2" />
      <span className="wm-shard wm-shard-3" />
      <span className="wm-shard wm-shard-4" />
      <span className="wm-shard wm-shard-5" />

      <div className="wm-intro-stage">
        <div className="wm-intro-badge">
          <img src={wmMark} alt="" className="wm-intro-badge-img" />
          <span className="wm-intro-badge-sweep" />
        </div>
        <div className="wm-intro-wordmark">
          <span className="wm-intro-line wm-intro-w-morgan">W Morgan</span>
          <span className="wm-intro-line wm-intro-technologies">Technologies</span>
          <span className="wm-intro-line wm-intro-tagline">Empowered by Innovation</span>
        </div>
      </div>
    </div>
  );
}
