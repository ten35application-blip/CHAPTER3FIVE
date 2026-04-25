export function Orb({ size = 360 }: { size?: number }) {
  return (
    <div
      className="relative pointer-events-none select-none"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="absolute inset-0 rounded-full animate-orb-breathe"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255, 220, 170, 0.95) 0%, rgba(255, 180, 110, 0.7) 28%, rgba(180, 110, 60, 0.35) 55%, rgba(120, 70, 40, 0.1) 75%, transparent 90%)",
          filter: "blur(6px)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full animate-orb-breathe-slow"
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
        @keyframes orb-breathe-slow {
          0%, 100% { transform: scale(1.5); opacity: 1; }
          50% { transform: scale(1.58); opacity: 0.85; }
        }
        .animate-orb-breathe { animation: orb-breathe 6s ease-in-out infinite; }
        .animate-orb-breathe-slow { animation: orb-breathe-slow 8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-orb-breathe, .animate-orb-breathe-slow { animation: none; }
        }
      `}</style>
    </div>
  );
}
