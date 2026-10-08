import React from 'react';
import type { SupplierSettings } from '../../types/billing';

interface Props {
  settings: SupplierSettings;
}

export const MarginTestPrintLayout: React.FC<Props> = ({ settings }) => {
  return (
    <div className="font-sans text-black p-4 bg-white min-h-[10in] flex flex-col justify-between">
      {/* Top Margin Indication Box */}
      <div className="border-2 border-dashed border-red-500 rounded p-4 text-center bg-red-50/40">
        <p className="font-bold text-red-700 text-base uppercase tracking-wide">
          ↑ Top Letterhead Reserved Area: {settings.letterheadTop} inches ↑
        </p>
        <p className="text-xs text-red-600 mt-1">
          Your pre-printed supplier letterhead header must fit completely inside this top area.
        </p>
      </div>

      {/* Printable Body Content Box */}
      <div className="border-2 border-solid border-green-600 rounded p-6 my-auto text-center bg-green-50/30">
        <h2 className="text-xl font-bold text-green-900 mb-2">
          Anwar Traders — Margin Test Page
        </h2>
        <p className="text-sm text-green-800 mb-4">
          This printable area is where your Bill, GST Invoice, or Quotation content will appear.
        </p>
        <div className="max-w-md mx-auto text-left text-xs text-gray-700 space-y-1.5 border border-gray-300 p-3 bg-white rounded">
          <div><strong>Configured Top Margin:</strong> {settings.letterheadTop} in</div>
          <div><strong>Configured Bottom Margin:</strong> {settings.letterheadBottom} in</div>
          <div><strong>Left / Right Margins:</strong> 0.6 in</div>
          <div><strong>Paper Size:</strong> A4 Portrait (8.27 × 11.69 inches)</div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Inspect the printout against your physical letterhead. If text overlaps your header, increase the top margin in Settings.
        </p>
      </div>

      {/* Bottom Margin Indication Box */}
      <div className="border-2 border-dashed border-red-500 rounded p-4 text-center bg-red-50/40">
        <p className="font-bold text-red-700 text-base uppercase tracking-wide">
          ↓ Bottom Letterhead Reserved Area: {settings.letterheadBottom} inches ↓
        </p>
        <p className="text-xs text-red-600 mt-1">
          Your pre-printed letterhead footer (addresses, bank details, stamp area) fits here.
        </p>
      </div>
    </div>
  );
};
