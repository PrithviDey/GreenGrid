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
        color: "rgba(34, 197, 94, 0.09)", // Vibrant neon green
        shadowColor: "rgba(34, 197, 94, 0.35)",
        speed: 0.008,
      },
      {
        y: height * 0.5,
        length: 0.0008,
        amplitude: 70,
        color: "rgba(6, 182, 212, 0.08)", // Vibrant neon cyan
        shadowColor: "rgba(6, 182, 212, 0.35)",
        speed: 0.006,
      },
      {
        y: height * 0.55,
        length: 0.0015,
        amplitude: 45,
        color: "rgba(34, 197, 94, 0.07)",
        shadowColor: "rgba(34, 197, 94, 0.3)",
        speed: 0.01,
      },
      {
        y: height * 0.48,
        length: 0.0006,
        amplitude: 80,
        color: "rgba(6, 182, 212, 0.06)",
        shadowColor: "rgba(6, 182, 212, 0.25)",
        speed: 0.005,
      }
    ];

    let increment = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw flowing waves with glow shadows
      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.moveTo(0, wave.y);

        for (let i = 0; i < width; i++) {
          const yOffset = Math.sin(i * wave.length + increment * wave.speed) * 
                          Math.cos(i * 0.00025 + increment * 0.001) * 
                          wave.amplitude;
          ctx.lineTo(i, wave.y + yOffset);
        }

        ctx.strokeStyle = wave.color;
        ctx.lineWidth = 3.6;
        ctx.shadowColor = wave.shadowColor;
        ctx.shadowBlur = 15;
        ctx.stroke();
      });

      // Reset shadows for standard canvas state hygiene
      ctx.shadowBlur = 0;

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
