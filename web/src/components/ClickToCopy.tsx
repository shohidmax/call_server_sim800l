'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface ClickToCopyProps {
  text: string;
  display?: React.ReactNode;
  className?: string;
  badge?: boolean;
  mono?: boolean;
  title?: string;
  iconClassName?: string;
}

export default function ClickToCopy({
  text,
  display,
  className = '',
  badge = false,
  mono = true,
  title,
  iconClassName = 'w-3 h-3'
}: ClickToCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      // Fallback for older browsers or non-secure contexts
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch (e) {
        console.error('Failed to copy text: ', e);
      }
    }
  };

  const badgeClass = badge
    ? 'badge badge-outline badge-xs py-2 px-2 hover:bg-base-200 cursor-pointer transition-all'
    : 'cursor-pointer hover:opacity-80 transition-opacity';

  return (
    <span
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard!' : (title || `Click to copy "${text}"`)}
      className={`inline-flex items-center gap-1.5 group select-none ${mono ? 'font-mono' : ''} ${badgeClass} ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCopy(e as any);
        }
      }}
    >
      <span>{display || text}</span>
      {copied ? (
        <Check className={`${iconClassName} text-success animate-in zoom-in-50 duration-200 shrink-0`} />
      ) : (
        <Copy className={`${iconClassName} opacity-30 group-hover:opacity-100 transition-opacity shrink-0`} />
      )}
    </span>
  );
}

