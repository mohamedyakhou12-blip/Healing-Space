"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf } from "lucide-react";
import { useTheme } from "next-themes";

const SPLASH_STORAGE_KEY = "healing-space-splash-seen";

// useSyncExternalStore for reading sessionStorage without an effect
function subscribeToSplash() {
  // No-op: sessionStorage doesn't emit events for same-tab changes
  return () => {};
}

function getSnapshot() {
  return sessionStorage.getItem(SPLASH_STORAGE_KEY) !== null;
}

function getServerSnapshot() {
  // On server, assume splash was already seen to avoid flash
  return true;
}

export function SplashScreen() {
  const hasSeenSplash = useSyncExternalStore(
    subscribeToSplash,
    getSnapshot,
    getServerSnapshot
  );
  const { theme } = useTheme();
  const [phase, setPhase] = useState<"idle" | "showing" | "fading-out" | "done">("idle");

  // Show the splash on first visit, manage lifecycle via timers
  useEffect(() => {
    if (hasSeenSplash) {
      // Already seen — immediately mark done (deferred to avoid synchronous setState)
      const t = setTimeout(() => setPhase("done"), 0);
      return () => clearTimeout(t);
    }

    // Initialize splash (deferred to avoid synchronous setState)
    const initTimer = setTimeout(() => setPhase("showing"), 0);

    // Begin fade-out after 2.5 seconds
    const fadeTimer = setTimeout(() => setPhase("fading-out"), 2500);

    // Unmount after 3 seconds (500ms fade-out window)
    const unmountTimer = setTimeout(() => {
      sessionStorage.setItem(SPLASH_STORAGE_KEY, "true");
      setPhase("done");
    }, 3000);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [hasSeenSplash]);

  if (phase === "idle" || phase === "done") return null;

  const isFadingOut = phase === "fading-out";

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          key="splash-screen"
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                theme === "dark"
                  ? "linear-gradient(135deg, hsl(160, 40%, 6%) 0%, hsl(170, 50%, 10%) 50%, hsl(180, 40%, 8%) 100%)"
                  : "linear-gradient(135deg, hsl(160, 60%, 96%) 0%, hsl(170, 55%, 95%) 50%, hsl(180, 50%, 96%) 100%)",
            }}
          />

          {/* Subtle decorative radial glow */}
          <div
            className="absolute inset-0"
            style={{
              background:
                theme === "dark"
                  ? "radial-gradient(circle at 50% 45%, hsla(173, 70%, 42%, 0.15) 0%, transparent 60%)"
                  : "radial-gradient(circle at 50% 45%, hsla(173, 80%, 50%, 0.12) 0%, transparent 60%)",
            }}
          />

          {/* Floating decorative leaves (background) */}
          <motion.div
            className="absolute top-[15%] left-[12%] opacity-[0.07] dark:opacity-[0.05]"
            animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Leaf className="size-20 text-emerald-600" />
          </motion.div>
          <motion.div
            className="absolute bottom-[20%] right-[10%] opacity-[0.06] dark:opacity-[0.04]"
            animate={{ y: [0, -12, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Leaf className="size-16 text-teal-600" />
          </motion.div>
          <motion.div
            className="absolute top-[25%] right-[18%] opacity-[0.05] dark:opacity-[0.03]"
            animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <Leaf className="size-12 text-emerald-500" />
          </motion.div>

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center gap-5">
            {/* Leaf icon with breathing animation */}
            <motion.div
              className="relative flex size-24 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{
                scale: [1, 1.08, 1],
                opacity: 1,
              }}
              transition={{
                scale: {
                  delay: 0.1,
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
                opacity: { duration: 0.5, ease: "easeOut" },
              }}
            >
              {/* Inner glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-200/50 dark:bg-emerald-800/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <Leaf className="relative z-10 size-12 text-emerald-600 dark:text-emerald-400" />
            </motion.div>

            {/* Title: "Healing Space" */}
            <motion.h1
              className="text-3xl font-bold tracking-wide text-emerald-800 dark:text-emerald-100 sm:text-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            >
              Healing Space
            </motion.h1>

            {/* Subtitle: "By Doc Nessrine" */}
            <motion.p
              className="text-sm font-medium tracking-wider text-emerald-600/70 dark:text-emerald-300/60 sm:text-base"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
            >
              By Doc Nessrine
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
