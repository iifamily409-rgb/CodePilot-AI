"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("codepilot-theme", next);
    } catch {
      // storage may be unavailable
    }
    setTheme(next);
  }

  return (
    <button type="button" onClick={toggle} className="cp-btn cp-btn-ghost !px-2.5" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
      {theme === "dark" ? "\u2600" : "\u263e"}
    </button>
  );
}
