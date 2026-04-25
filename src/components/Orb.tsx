type Intensity = "rest" | "thinking";

export function Orb({
  size = 360,
  intensity = "rest",
}: {
  size?: number;
  intensity?: Intensity;
}) {
  const breatheClass =
    intensity === "thinking" ? "orb-breathe-fast" : "orb-breathe";
  const glowClass =
    intensity === "thinking" ? "orb-glow-fast" : "orb-glow-slow";

  return (
    <div
      className="relative pointer-events-none select-none"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className={`absolute inset-0 rounded-full ${breatheClass}`}
        style={{
          background:
            intensity === "thinking"
              ? "radial-gradient(circle at 50% 45%, rgba(255, 230, 180, 1) 0%, rgba(255, 195, 130, 0.8) 28%, rgba(200, 130, 70, 0.4) 55%, rgba(140, 80, 50, 0.12) 75%, transparent 90%)"
              : "radial-gradient(circle at 50% 45%, rgba(255, 220, 170, 0.95) 0%, rgba(255, 180, 110, 0.7) 28%, rgba(180, 110, 60, 0.35) 55%, rgba(120, 70, 40, 0.1) 75%, transparent 90%)",
          filter: "blur(6px)",
        }}
      />
      <div
        className={`absolute inset-0 rounded-full ${glowClass}`}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 200, 140, 0.55) 0%, rgba(220, 140, 80, 0.22) 40%, transparent 70%)",
          filter: "blur(36px)",
          transform: "scale(1.5)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 200, 140, 0.16) 0%, transparent 60%)",
          filter: "blur(80px)",
          transform: "scale(2.6)",
        }}
      />
      <style>{`
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.92; }
        }
        @keyframes orb-breathe-fast {
          0%, 100% { transform: scale(1.02); opacity: 1; }
          50% { transform: scale(1.10); opacity: 0.96; }
        }
        @keyframes orb-glow-slow {
          0%, 100% { transform: scale(1.5); opacity: 1; }
          50% { transform: scale(1.58); opacity: 0.85; }
        }
        @keyframes orb-glow-fast {
          0%, 100% { transform: scale(1.55); opacity: 1; }
          50% { transform: scale(1.72); opacity: 0.9; }
        }
        .orb-breathe { animation: orb-breathe 6s ease-in-out infinite; }
        .orb-breathe-fast { animation: orb-breathe-fast 1.6s ease-in-out infinite; }
        .orb-glow-slow { animation: orb-glow-slow 8s ease-in-out infinite; }
        .orb-glow-fast { animation: orb-glow-fast 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .orb-breathe, .orb-breathe-fast, .orb-glow-slow, .orb-glow-fast { animation: none; }
        }
      `}</style>
    </div>
  );
}
