import wmMark from '../../assets/wmorgan-mark.png';
import './login-animations.css';

// Desktop-only branding half of the split login layout. Purely
// presentational — a one-shot ~2s logo reveal built with plain CSS
// animations (see login-animations.css), no animation library: the mark
// starts tiny/invisible, rapidly zooms in with a brief overshoot before
// settling, two concentric rings expand outward from it in sync, then the
// wordmark/tagline fade + slide in underneath. Everything uses
// animation-fill-mode: forwards, so once it plays it stays put — no
// looping, no motion after it settles.
export default function BrandingPanel() {
  return (
    <div className="relative hidden w-[42%] max-w-xl shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#4f46e5] via-[#6d28d9] to-[#7c3aed] px-10 py-16 lg:flex">
      {/* Static, subtle glow behind the mark — decorative only, no motion */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center text-center">
        {/* Unclipped stage — holds the expanding rings and the clipped
            mark circle together, both sized identically, so the rings
            visibly radiate outward from the mark's own edge. */}
        <div className="relative flex size-28 items-center justify-center">
          <span className="wm-ring wm-ring-1" aria-hidden="true" />
          <span className="wm-ring wm-ring-2" aria-hidden="true" />
          <div className="wm-mark-zoom relative size-28 overflow-hidden rounded-full shadow-[0_0_0_6px_rgba(255,255,255,0.12)]">
            <img
              src={wmMark}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover"
            />
            <span className="wm-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
          </div>
        </div>

        <h1
          className="wm-text-reveal mt-6 text-2xl font-bold uppercase tracking-tight text-white"
          style={{ animationDelay: '1s' }}
        >
          W Morgan Technologies
        </h1>
        <p
          className="wm-text-reveal mt-1 text-sm font-semibold uppercase tracking-wide text-white/75"
          style={{ animationDelay: '1.2s' }}
        >
          Empowered by Innovation
        </p>
      </div>
    </div>
  );
}
