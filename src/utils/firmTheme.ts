import type { FirmProfile } from '../types/billing';

/**
 * Per-firm dashboard identity.
 *
 * Both firms used to share the exact same navy/gold dashboard, so it was
 * easy to start a bill under the wrong firm without noticing. Each firm's
 * styleTheme now drives a distinct header/card accent across the dashboard
 * AND the entry form, making the active firm obvious at a glance.
 *
 * - CLASSIC_GOVT (Anwar Traders): navy + gold (the original look)
 * - MODERN_CORPORATE (Hashir Traders): deep emerald
 */
export interface FirmDashboardTheme {
  header: string;
  accentBar: string;
  logoTile: string;
  enterpriseChip: string;
  selectRing: string;
  createBill: string;
  createBillChip: string;
  createBillIcon: string;
  createBillSub: string;
  entityTile: string;
  firmDot: string;
  firmChip: string;
}

const CLASSIC_GOVT_THEME: FirmDashboardTheme = {
  header: 'bg-navy-950',
  accentBar: 'bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700',
  logoTile: 'border-gold-500/50 text-gold-400',
  enterpriseChip: 'bg-gold-500/15 text-gold-400 border-gold-500/40',
  selectRing: 'focus:ring-gold-400/60',
  createBill: 'bg-navy-900 hover:bg-navy-950 shadow-[0_8px_20px_-8px_rgba(12,28,51,0.5)]',
  createBillChip: 'bg-gold-500 text-navy-950',
  createBillIcon: 'text-gold-400',
  createBillSub: 'text-navy-200',
  entityTile: 'bg-navy-900 text-gold-400',
  firmDot: 'bg-gold-400',
  firmChip: 'bg-gold-500/15 text-gold-300 border-gold-500/40',
};

const MODERN_CORPORATE_THEME: FirmDashboardTheme = {
  header: 'bg-emerald-950',
  accentBar: 'bg-gradient-to-r from-emerald-700 via-emerald-400 to-emerald-700',
  logoTile: 'border-emerald-500/50 text-emerald-300',
  enterpriseChip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  selectRing: 'focus:ring-emerald-400/60',
  createBill: 'bg-emerald-900 hover:bg-emerald-950 shadow-[0_8px_20px_-8px_rgba(4,47,36,0.55)]',
  createBillChip: 'bg-emerald-400 text-emerald-950',
  createBillIcon: 'text-emerald-300',
  createBillSub: 'text-emerald-200',
  entityTile: 'bg-emerald-900 text-emerald-300',
  firmDot: 'bg-emerald-400',
  firmChip: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
};

export function getFirmDashboardTheme(firm?: FirmProfile | null): FirmDashboardTheme {
  return firm?.styleTheme === 'MODERN_CORPORATE' ? MODERN_CORPORATE_THEME : CLASSIC_GOVT_THEME;
}
