import React from 'react';
import type { FirmDashboardTheme } from '../utils/firmTheme';

/**
 * Unmissable active-firm banner: "You are using FIRM NAME" with the firm
 * name blinking in the firm's accent color (yellow for Anwar, lime for
 * Hashir). Shown on the dashboard and the entry form so a wrong-firm entry
 * is impossible to miss. Blink respects prefers-reduced-motion (see CSS).
 */
export const FirmBanner: React.FC<{
  firmName: string;
  theme: FirmDashboardTheme;
  maxWidthClass?: string;
}> = ({ firmName, theme, maxWidthClass = 'max-w-6xl' }) => (
  <div className={`${theme.bannerBg} border-b border-white/10 print:hidden`}>
    <div className={`${maxWidthClass} mx-auto px-4 py-2 flex items-center justify-center gap-3 text-center`}>
      <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white border border-white/40 flex items-center justify-center overflow-hidden shrink-0">
        <img src={theme.logoSrc} alt="" className="w-full h-full object-contain p-[2px]" />
      </span>
      <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/70 shrink-0">
        You are using
      </span>
      <span className={`firm-blink text-xl sm:text-2xl font-black uppercase tracking-wide ${theme.bannerBlink}`}>
        {firmName}
      </span>
    </div>
  </div>
);
