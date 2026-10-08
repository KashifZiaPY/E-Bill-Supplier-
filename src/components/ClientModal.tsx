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
  const [name, setName] = useState(clientToEdit?.name || '');
  const [address, setAddress] = useState(clientToEdit?.address || '');
  const [ntn, setNtn] = useState(clientToEdit?.ntn || '');
  const [phone, setPhone] = useState(clientToEdit?.phone || '');
  const [contactPerson, setContactPerson] = useState(clientToEdit?.contactPerson || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      await onSave({
        id: clientToEdit?.id || 'client-' + Date.now(),
        name: name.trim(),
        address: address.trim(),
        ntn: ntn.trim(),
        phone: phone.trim(),
        contactPerson: contactPerson.trim(),
        totalOrders: clientToEdit?.totalOrders || 0,
        totalBilled: clientToEdit?.totalBilled || 0,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F2544] to-[#1E3A8A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {clientToEdit ? 'Edit Client Record' : 'Register New Client'}
              </h3>
              <p className="text-xs text-blue-200">
                Government departments, authorities & corporate buyers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Client / Department Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Director General Health Services Punjab"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F2544] focus:outline-none font-semibold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                National Tax Number (NTN)
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ntn}
                  onChange={(e) => setNtn(e.target.value)}
                  placeholder="e.g. 9010203-4"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F2544] focus:outline-none font-mono text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Phone / Landline
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 042-99201139"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F2544] focus:outline-none text-slate-900"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Contact Person / Designation
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Section Officer (Procurement)"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F2544] focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Office / Department Address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="e.g. 24-Cooper Road, Lahore"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F2544] focus:outline-none text-slate-900"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0F2544] hover:bg-[#1E3A8A] rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{clientToEdit ? 'Save Changes' : 'Save Client'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
