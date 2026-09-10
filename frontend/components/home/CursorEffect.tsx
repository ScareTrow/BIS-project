'use client';

import { useEffect, useRef, useState } from 'react';

interface CursorEffectProps {
  children: React.ReactNode;
}

export default function CursorEffect({ children }: CursorEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleMouseEnter = () => {
      setIsHovering(true);
    };

    const handleMouseLeave = () => {
      setIsHovering(false);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {children}
      {isHovering && (
        <>
          {/* Основной эффект - градиентный круг */}
          <div
            className="pointer-events-none absolute rounded-full opacity-30 transition-all duration-300 ease-out"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
              width: '400px',
              height: '400px',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 40%, transparent 70%)',
              filter: 'blur(20px)',
              zIndex: 0
            }}
          />
          {/* Дополнительный эффект - меньший круг для более четкого слежения */}
          <div
            className="pointer-events-none absolute rounded-full opacity-50 transition-all duration-200 ease-out"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
              width: '200px',
              height: '200px',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.2) 50%, transparent 80%)',
              filter: 'blur(10px)',
              zIndex: 0
            }}
          />
          {/* Маленький яркий центр */}
          <div
            className="pointer-events-none absolute rounded-full opacity-70 transition-all duration-100 ease-out"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
              width: '80px',
              height: '80px',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.3) 100%)',
              filter: 'blur(5px)',
              zIndex: 0
            }}
          />
        </>
      )}
    </div>
  );
}

