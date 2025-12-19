"use client";

import { useEffect, useState, memo } from "react";

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
}

const colors = ["#e5a00d", "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9"];

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3,
      rotation: Math.random() * 360,
    });
  }
  return particles;
}

const Confetti = memo(function Confetti({ active, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Handle activation and cleanup - using microtask to avoid synchronous setState warning
  useEffect(() => {
    if (active) {
      // Use queueMicrotask to defer state update
      queueMicrotask(() => {
        setParticles(generateParticles());
      });

      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 confetti-particle"
          style={{
            left: `${particle.x}%`,
            top: "-10px",
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            transform: `rotate(${particle.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
});

export default Confetti;
