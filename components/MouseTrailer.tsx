import React, { useRef, useEffect } from 'react';

const MouseTrailer: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          cursorRef.current.style.setProperty('--x', e.clientX + 'px');
          cursorRef.current.style.setProperty('--y', e.clientY + 'px');
        });
        
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('a, button, input, label[for], select, textarea, [role="button"]');
        if (isInteractive) {
            cursorRef.current.classList.add('hover');
        } else {
            cursorRef.current.classList.remove('hover');
        }
      }
    };
    
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  return <div ref={cursorRef} className="mouse-trailer hidden md:block"></div>;
};

export default MouseTrailer;
