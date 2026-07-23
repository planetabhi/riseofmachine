import { useEffect, useRef } from 'react';
import './ParticleBackground.css';

interface Particle {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    baseOpacity: number;
    depth: number;
    phase: number;
    twinkleSpeed: number;
}

interface Mouse {
    x: number | null;
    y: number | null;
    radius: number;
}

function readAccent(): [number, number, number] {
    if (typeof window === 'undefined') return [255, 255, 255];
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim();
    const m = raw.match(/^#?([0-9a-f]{6})$/i);
    if (m && m[1]) {
        const int = parseInt(m[1], 16);
        return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    }
    const rgb = raw.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb && rgb[1] && rgb[2] && rgb[3]) {
        return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    }
    return [255, 255, 255];
}

export default function ParticleBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const reduceMotion =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;

        let animationFrameId: number | null = null;
        let isVisible = true;
        let isOnScreen = true;
        let particles: Particle[] = [];
        let width = 0;
        let height = 0;
        let accent = readAccent();
        const mouse: Mouse = { x: null, y: null, radius: 160 };

        const resizeCanvas = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            accent = readAccent();
            initParticles();
        };

        const createParticle = (): Particle => {
            const depth = Math.random();
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                size: depth * 1.6 + 0.4,
                speedX: (Math.random() - 0.5) * (0.12 + depth * 0.32),
                speedY: (Math.random() - 0.5) * (0.12 + depth * 0.32),
                baseOpacity: depth * 0.4 + 0.12,
                depth,
                phase: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * 1.2 + 0.4,
            };
        };

        const updateParticle = (p: Particle) => {
            p.x += p.speedX;
            p.y += p.speedY;

            if (mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    const angle = Math.atan2(dy, dx);
                    const push = force * (1 + p.depth * 2);
                    p.x -= Math.cos(angle) * push;
                    p.y -= Math.sin(angle) * push;
                }
            }

            if (p.x > width) p.x = 0;
            if (p.x < 0) p.x = width;
            if (p.y > height) p.y = 0;
            if (p.y < 0) p.y = height;
        };

        const drawParticle = (p: Particle, opacity: number) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.shadowColor = `rgba(255, 255, 255, ${opacity})`;
            ctx.shadowBlur = p.size * 2.5;
            ctx.fill();
        };

        const initParticles = () => {
            particles = [];
            const numberOfParticles = Math.floor((width * height) / 10000);
            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(createParticle());
            }
        };

        const animate = () => {
            const t = performance.now() / 1000;
            ctx.clearRect(0, 0, width, height);

            const opacities = particles.map(
                (p) => p.baseOpacity * (0.7 + 0.3 * Math.sin(t * p.twinkleSpeed + p.phase))
            );

            particles.forEach((particle, i) => {
                updateParticle(particle);
                drawParticle(particle, opacities[i] ?? particle.baseOpacity);
            });

            ctx.shadowBlur = 0;
            particles.forEach((a, i) => {
                particles.slice(i + 1).forEach((b) => {
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 120) {
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - distance / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                });
            });

            if (mouse.x !== null && mouse.y !== null) {
                const [r, g, bl] = accent;
                particles.forEach((p) => {
                    const dx = (mouse.x as number) - p.x;
                    const dy = (mouse.y as number) - p.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouse.radius) {
                        ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${0.18 * (1 - distance / mouse.radius)})`;
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(mouse.x as number, mouse.y as number);
                        ctx.lineTo(p.x, p.y);
                        ctx.stroke();
                    }
                });
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        const startAnimation = () => {
            if (animationFrameId === null && isVisible && isOnScreen) {
                animate();
            }
        };

        const stopAnimation = () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };

        const handleVisibility = () => {
            isVisible = !document.hidden;
            if (isVisible) startAnimation();
            else stopAnimation();
        };

        const intersectionObserver = new IntersectionObserver(
            (entries) => {
                isOnScreen = entries[0]?.isIntersecting ?? true;
                if (isOnScreen) startAnimation();
                else stopAnimation();
            },
            { threshold: 0 }
        );
        intersectionObserver.observe(canvas);

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };

        const handleMouseLeave = () => {
            mouse.x = null;
            mouse.y = null;
        };

        resizeCanvas();
        startAnimation();

        window.addEventListener('resize', resizeCanvas);
        document.addEventListener('visibilitychange', handleVisibility);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            stopAnimation();
            intersectionObserver.disconnect();
            window.removeEventListener('resize', resizeCanvas);
            document.removeEventListener('visibilitychange', handleVisibility);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    return <canvas ref={canvasRef} className="particle-background" />;
}
