import React, { useState } from 'react';
import { X, UserPlus, Building, Phone, Hash, MapPin, Check } from 'lucide-react';
import type { SavedClient } from '../types/billing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: SavedClient) => Promise<void>;
  clientToEdit?: SavedClient | null;
}

export const ClientModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  clientToEdit,
}) => {
  const [name, setName] = useState(clientToEdit?.name || (clientToEdit as any)?.Name || '');
  const [address, setAddress] = useState(clientToEdit?.address || (clientToEdit as any)?.Address || '');
  const [ntn, setNtn] = useState(clientToEdit?.ntn || (clientToEdit as any)?.NTN || '');
  const [strn, setStrn] = useState(clientToEdit?.strn || (clientToEdit as any)?.STRN || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setName(String(clientToEdit?.name || (clientToEdit as any)?.Name || ''));
      setAddress(String(clientToEdit?.address || (clientToEdit as any)?.Address || ''));
      setNtn(String(clientToEdit?.ntn || (clientToEdit as any)?.NTN || ''));
      setStrn(String(clientToEdit?.strn || (clientToEdit as any)?.STRN || ''));
      setError('');

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, clientToEdit, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Client Name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await onSave({
        id: clientToEdit?.id || 'client-' + Date.now(),
        name: name.trim(),
        Name: name.trim(),
        address: address.trim(),
        Address: address.trim(),
        ntn: ntn.trim(),
        NTN: ntn.trim(),
        strn: strn.trim(),
        STRN: strn.trim(),
        lastUsed: clientToEdit?.lastUsed || (clientToEdit as any)?.LastUsed || now,
        LastUsed: clientToEdit?.lastUsed || (clientToEdit as any)?.LastUsed || now,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-[2px]">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-line overflow-hidden">
        <div className="px-5 py-4 bg-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/5 border border-gold-500/40 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-gold-400" />
            </span>
            <div>
              <h3 className="font-extrabold text-[15px] tracking-tight">{clientToEdit ? 'Edit Client' : 'Register New Client'}</h3>
              <p className="text-xs text-navy-200">Synced with the Google Sheet client registry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[#96291f] text-xs font-semibold">{error}</div>
          )}

          <div>
            <label className="corp-label">Client / department name <span className="text-[#b3372f]">*</span></label>
            <div className="relative">
              <Building className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Director General Health Services Punjab"
                required
                className="corp-input !pl-10 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="corp-label">NTN</label>
              <div className="relative">
                <Hash className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={ntn}
                  onChange={(e) => setNtn(e.target.value)}
                  placeholder="e.g. 9010203-4"
                  className="corp-input !pl-10 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="corp-label">STRN</label>
              <div className="relative">
                <Hash className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={strn}
                  onChange={(e) => setStrn(e.target.value)}
                  placeholder="e.g. 07-01-9876-543-21"
                  className="corp-input !pl-10 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="corp-label">Office address</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-ink-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="e.g. 24-Cooper Road, Lahore"
                className="corp-input !pl-10 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
            <button type="button" onClick={onClose} className="corp-btn-ghost !py-2 text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="corp-btn-primary !py-2 text-xs">
              {isSubmitting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Check className="w-3.5 h-3.5" />
              <span>{clientToEdit ? 'Save Changes' : 'Save Client'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
