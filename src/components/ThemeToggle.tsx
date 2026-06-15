"use client";
import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  if (!mounted) {
    // Avoid layout shifting by rendering a spacer button of same dimensions
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-bg-tertiary hover:bg-border-color/80 text-text-secondary hover:text-text-primary border border-border-color transition-all cursor-pointer shadow-sm flex items-center justify-center"
      title={isDark ? "Ativar Tema Claro" : "Ativar Tema Escuro"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-500" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600" />
      )}
    </button>
  );
}
