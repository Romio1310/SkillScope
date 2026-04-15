import { useRef, useEffect } from 'react';

/* Lightweight Canvas Particle System - no Three.js dependency */
export function ParticleCanvas({ className = '', particleCount = 80, color = '#6366F1' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.offsetWidth;
        this.y = Math.random() * canvas.offsetHeight;
        this.z = Math.random() * 1000;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.vz = -Math.random() * 0.5 - 0.2;
        this.size = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;
        if (this.z < 0 || this.x < -50 || this.x > canvas.offsetWidth + 50 || this.y < -50 || this.y > canvas.offsetHeight + 50) {
          this.reset();
          this.z = 1000;
        }
        const scale = 500 / (500 + this.z);
        this.screenX = this.x * scale + (canvas.offsetWidth * (1 - scale)) / 2;
        this.screenY = this.y * scale + (canvas.offsetHeight * (1 - scale)) / 2;
        this.screenSize = this.size * scale;
        this.screenOpacity = this.opacity * scale;
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.screenX, this.screenY, this.screenSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = this.screenOpacity;
        ctx.fill();
      }
    }

    particles = Array.from({ length: particleCount }, () => new Particle());

    // Connection lines
    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].screenX - particles[j].screenX;
          const dy = particles[i].screenY - particles[j].screenY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].screenX, particles[i].screenY);
            ctx.lineTo(particles[j].screenX, particles[j].screenY);
            ctx.strokeStyle = color;
            ctx.globalAlpha = (1 - dist / 100) * 0.12;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach(p => { p.update(); p.draw(ctx); });
      drawConnections();
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [particleCount, color]);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%' }} />;
}

/* Animated Score Orb - pure CSS/SVG */
export function ScoreOrb({ score, size = 200 }) {
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const glowColor = score >= 75 ? 'rgba(16,185,129,0.3)' : score >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow rings */}
      <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`, animationDuration: '3s' }} />
      <div className="absolute inset-2 rounded-full" style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 60%)`, animation: 'pulse 2s ease-in-out infinite' }} />

      {/* Rotating ring */}
      <svg className="absolute inset-0" viewBox="0 0 200 200" style={{ animation: 'spin 20s linear infinite', width: size, height: size }}>
        <circle cx="100" cy="100" r="90" fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" strokeDasharray="4 8" />
        <circle cx="100" cy="100" r="80" fill="none" stroke={color} strokeWidth="0.3" opacity="0.15" strokeDasharray="2 12" />
      </svg>

      {/* Grid sphere effect */}
      <svg className="absolute inset-0" viewBox="0 0 200 200" style={{ width: size, height: size }}>
        {/* Horizontal arcs */}
        {[-30, 0, 30].map(offset => (
          <ellipse key={`h${offset}`} cx="100" cy={100 + offset} rx={Math.cos(offset * Math.PI / 180) * 60} ry="8"
            fill="none" stroke={color} strokeWidth="0.4" opacity="0.15" style={{ animation: `spin 15s linear infinite` }} />
        ))}
        {/* Vertical arcs */}
        {[-30, 0, 30].map(offset => (
          <ellipse key={`v${offset}`} cx={100 + offset} cy="100" rx="8" ry={Math.cos(offset * Math.PI / 180) * 60}
            fill="none" stroke={color} strokeWidth="0.4" opacity="0.15" style={{ animation: `spin 20s linear infinite reverse` }} />
        ))}
      </svg>
    </div>
  );
}

/* Floating geometric shapes */
export function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Rotating hexagons */}
      {[
        { x: '15%', y: '20%', size: 40, delay: 0, duration: 25, color: '#6366F1' },
        { x: '80%', y: '30%', size: 30, delay: 2, duration: 30, color: '#10B981' },
        { x: '60%', y: '70%', size: 50, delay: 4, duration: 20, color: '#6366F1' },
        { x: '25%', y: '75%', size: 25, delay: 1, duration: 35, color: '#F59E0B' },
        { x: '90%', y: '60%', size: 35, delay: 3, duration: 28, color: '#EC4899' },
      ].map((shape, i) => (
        <div key={i} className="absolute" style={{
          left: shape.x, top: shape.y,
          width: shape.size, height: shape.size,
          border: `1px solid ${shape.color}`,
          borderRadius: '30%',
          opacity: 0.1,
          animation: `spin ${shape.duration}s linear infinite`,
          animationDelay: `${shape.delay}s`,
          transform: 'rotate(45deg)',
        }} />
      ))}
    </div>
  );
}
