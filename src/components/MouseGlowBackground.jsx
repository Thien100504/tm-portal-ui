import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';

import { useTheme } from "@/contexts/useTheme";

export default function MouseGlowBackground({ children, fullScreen = false }) {
  const { mouseGlow, bgGrid } = useTheme();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animation for the glow effect
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className={`relative w-full bg-background overflow-hidden text-foreground ${fullScreen ? 'h-screen' : 'min-h-screen'}`}>
      {/* Background base */}
      <AnimatePresence>
        {bgGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
          />
        )}
      </AnimatePresence>

      {/* Mouse tracking glow & Ambient glows */}
      <AnimatePresence>
        {mouseGlow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-0 z-0"
          >
            <motion.div
              className="fixed z-0 opacity-[0.2] pointer-events-none"
              style={{ 
                width: 600,
                height: 600,
                left: -300,
                top: -300,
                x: springX,
                y: springY,
                backgroundImage: 'radial-gradient(600px circle at center, var(--color-ai), transparent 40%)'
              }}
            />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[color:var(--color-primary)]/10 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[color:var(--color-ai)]/10 blur-[120px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className={`relative z-10 w-full ${fullScreen ? 'h-screen' : 'min-h-screen flex items-center justify-center p-4'}`}>
        {children}
      </div>
    </div>
  );
}
