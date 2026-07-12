import { useEffect, useRef } from "react";

export function EnergyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Wave parameters (flowing waves representing green solar power and cyan grid currents)
    const waves = [
      {
        y: height * 0.45,
        length: 0.0012,
        amplitude: 55,
        frequency: 0.002,
        color: "rgba(34, 197, 94, 0.03)", // Subtle neon green
        speed: 0.008,
      },
      {
        y: height * 0.5,
        length: 0.0008,
        amplitude: 70,
        frequency: 0.0015,
        color: "rgba(6, 182, 212, 0.025)", // Subtle neon cyan
        speed: 0.006,
      },
      {
        y: height * 0.55,
        length: 0.0015,
        amplitude: 45,
        frequency: 0.003,
        color: "rgba(34, 197, 94, 0.02)",
        speed: 0.01,
      },
      {
        y: height * 0.48,
        length: 0.0006,
        amplitude: 80,
        frequency: 0.001,
        color: "rgba(6, 182, 212, 0.015)",
        speed: 0.005,
      }
    ];

    let increment = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw flowing waves
      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.moveTo(0, wave.y);

        for (let i = 0; i < width; i++) {
          // Combine primary sine with a slower modulating cosine to create an organic, pulsing flow
          const yOffset = Math.sin(i * wave.length + increment * wave.speed) * 
                          Math.cos(i * 0.00025 + increment * 0.001) * 
                          wave.amplitude;
          ctx.lineTo(i, wave.y + yOffset);
        }

        ctx.strokeStyle = wave.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });

      increment += 1;
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
