'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`btn btn-ghost btn-circle btn-sm relative transition-all duration-200 hover:bg-base-300/50 ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-warning transition-transform duration-300 rotate-0 hover:rotate-90" />
      ) : (
        <Moon className="w-4 h-4 text-primary transition-transform duration-300 rotate-0 hover:-rotate-45" />
      )}
      {showLabel && (
        <span className="ml-2 text-xs font-semibold capitalize hidden sm:inline">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}

