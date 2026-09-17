import wmMark from '../../assets/wmorgan-mark.png';
import './login-animations.css';

// Desktop-only branding half of the split login layout — the persistent
// panel shown once LogoIntro's full-screen splash has finished. Same
// brand palette as the splash (near-black stage, dark green wordmark, red
// TECHNOLOGIES/tagline — see logo-intro.css); the mark itself is the
// original artwork, completely unmodified. The mark reveal here is its
// own shorter ~1.2s reuse of the same reveal technique (rapid zoom-in
// with overshoot, two rings expanding outward, then the wordmark fading
// in underneath), not a replay of the fuller splash sequence.
export default function BrandingPanel() {
  return (
    <div className="relative hidden w-[42%] max-w-xl shrink-0 items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#0c0d10_0%,#050506_60%,#000_100%)] px-10 py-16 lg:flex">
      {/* Ambient red/green glows + faint light streaks — decorative only, no motion */}
      <div aria-hidden="true" className="pointer-events-none absolute left-[10%] top-[60%] size-[24rem] -translate-y-1/2 rounded-full bg-[#c81e2c]/25 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-[18%] size-[20rem] rounded-full bg-[#0f5132]/30 blur-[100px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[12%] h-px bg-gradient-to-r from-transparent via-[#c81e2c]/40 to-transparent"
      />

      <div className="relative flex flex-col items-center text-center">
        {/* Unclipped stage — holds the expanding rings and the clipped
            mark circle together, both sized identically, so the rings
            visibly radiate outward from the mark's own edge. */}
        <div className="relative flex size-28 items-center justify-center">
          <span className="wm-ring wm-ring-1" aria-hidden="true" />
          <span className="wm-ring wm-ring-2" aria-hidden="true" />
          <div
            className="wm-mark-zoom relative size-28 overflow-hidden rounded-full"
            style={{ boxShadow: '0 0 0 2px rgba(200,30,44,0.55), 0 18px 40px -8px rgba(0,0,0,0.8), 0 0 50px rgba(200,30,44,0.35)' }}
          >
            {/* Unmodified artwork — no filter/recolor of any kind. The ring/
                shadow above and the sweep below frame it without touching
                the image itself. */}
            <img
              src={wmMark}
              alt="W Morgan Technologies"
              className="absolute inset-0 h-full w-full scale-110 object-cover"
            />
            <span className="wm-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
          </div>
        </div>

        <h1
          className="wm-text-reveal mt-6 text-2xl font-extrabold uppercase tracking-wide text-[#34d399]"
          style={{ animationDelay: '1s', textShadow: '0 0 22px rgba(52,211,153,0.4)' }}
        >
          W Morgan
        </h1>
        <p
          className="wm-text-reveal mt-0.5 text-base font-bold uppercase tracking-[0.18em] text-[#ff5252]"
          style={{ animationDelay: '1.15s', textShadow: '0 0 18px rgba(255,82,82,0.35)' }}
        >
          Technologies
        </p>
        <p
          className="wm-text-reveal mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#c81e2c]"
          style={{ animationDelay: '1.3s' }}
        >
          Empowered by Innovation
        </p>
      </div>
    </div>
  );
}
