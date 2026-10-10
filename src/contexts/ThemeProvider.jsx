import { useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { ThemeContext } from "./ThemeContext";

const LS = "tm-theme-v1";

const DEFAULTS = {
  mode: "dark",
  style: "standard",
  transparency: 55,
  blur: 60,
  motionLevel: 70,
  motion: true,
  mouseGlow: true,
  bgGrid: true,
  accent: "violet",
};

export function ThemeProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* Silently ignore */ }
    return DEFAULTS;
  });

  const theme = state.mode;
  const glassMode = state.style === "glass";

  useLayoutEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      root.classList.remove('light', 'dark');
      let actualMode = state.mode;
      if (actualMode === 'system') {
        actualMode = mediaQuery.matches ? 'dark' : 'light';
      }
      root.classList.add(actualMode);
      root.classList.toggle("theme-glass", state.style === "glass");
      root.classList.toggle("theme-sketch", state.style === "sketch");
      root.classList.toggle("motion-reduced", !state.motion);
      root.dataset.accent = state.accent;
      root.style.setProperty("--glass-transparency", String(state.transparency));
      root.style.setProperty("--glass-blur-level", String(state.blur));
      root.style.setProperty("--motion-level", String(state.motionLevel));
    };

    applyTheme();

    const listener = () => {
      if (state.mode === 'system') {
        if (document.startViewTransition && state.motion) {
          document.startViewTransition(() => flushSync(() => applyTheme()));
        } else {
          applyTheme();
        }
      }
    };
    mediaQuery.addEventListener('change', listener);
    
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* Silently ignore */ }

    return () => mediaQuery.removeEventListener('change', listener);
  }, [state]);

  const setWithTransition = (k, v) => {
    if (!document.startViewTransition || !state.motion) {
      setState((s) => ({ ...s, [k]: v }));
      return;
    }
    
    // Only animate visual layout/color changes
    if (['mode', 'style', 'accent'].includes(k)) {
      document.documentElement.classList.add('is-transitioning');
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setState((s) => ({ ...s, [k]: v }));
        });
      });
      transition.finished.finally(() => {
        document.documentElement.classList.remove('is-transitioning');
      });
    } else {
      setState((s) => ({ ...s, [k]: v }));
    }
  };

  const _set = (k, v) => setState((s) => ({ ...s, [k]: v }));

  return (
    <ThemeContext.Provider
      value={{
        ...state,
        setMode: (m) => setWithTransition("mode", m),
        setStyle: (s) => setWithTransition("style", s),
        setTransparency: (n) => setWithTransition("transparency", n),
        setBlur: (n) => setWithTransition("blur", n),
        setMotionLevel: (n) => setWithTransition("motionLevel", n),
        setMotion: (b) => setWithTransition("motion", b),
        setMouseGlow: (b) => setWithTransition("mouseGlow", b),
        setBgGrid: (b) => setWithTransition("bgGrid", b),
        setAccent: (a) => setWithTransition("accent", a),
        toggleTheme: () => setWithTransition("mode", state.mode === "dark" ? "light" : "dark"),
        toggleGlassMode: () => setWithTransition("style", state.style === "glass" ? "standard" : "glass"),
        theme,
        glassMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
