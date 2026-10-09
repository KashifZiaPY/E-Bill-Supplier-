/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  CatalogItem,
  DocumentRecord,
  DocType,
  SavedClient,
  SupplierSettings,
} from './types/billing';
import { DEFAULT_SETTINGS, gasApi } from './api/gasClient';
import { PinScreen } from './components/PinScreen';
import { HomeScreen } from './components/HomeScreen';
import { EntryFormScreen } from './components/EntryFormScreen';
import { PreviewScreen } from './components/PreviewScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ClientModal } from './components/ClientModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { generateUUID, safeNormalizeItems } from './utils/formatters';
import { getSuggestedNextNo } from './utils/lifoHelper';
import { WifiOff, RefreshCw, Settings as SettingsIcon, X } from 'lucide-react';

type Screen = 'HOME' | 'ENTRY_FORM' | 'PREVIEW' | 'SETTINGS';

export default function App() {
  // Authentication & bootstrap state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // App data
  const [settings, setSettings] = useState<SupplierSettings>(DEFAULT_SETTINGS);
  const [activeFirmId, setActiveFirmId] = useState<string>(DEFAULT_SETTINGS.activeFirmId || 'firm-anwar-traders');
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineBlockAction, setOfflineBlockAction] = useState<string | null>(null);

  // Navigation & Active state
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null);
  const [formDocType, setFormDocType] = useState<DocType>('BILL');
  const [editingDoc, setEditingDoc] = useState<Partial<DocumentRecord> | null>(null);

  // Client Modal state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<SavedClient | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Bootstrap data loading
  const loadBootstrapData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await gasApi.bootstrap();
      if (data) {
        if (data.settings) {
          setSettings(data.settings);
          if (data.settings.activeFirmId) {
            setActiveFirmId(data.settings.activeFirmId);
          }
        }
        if (data.docs) setDocs(data.docs);
        if (data.clients) setClients(data.clients);
        if (data.catalog) setCatalog(data.catalog);
      }
      setIsOfflineMode(gasApi.getIsOfflineMode());
    } catch (err: any) {
      console.error('Failed to load data:', err);
      if (err.message && err.message.includes('PIN')) {
        setIsAuthenticated(false);
        setPinError(err.message);
      } else {
        showToast('Running with local storage cache', 'info');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Initial authentication check
  useEffect(() => {
    const savedPin = gasApi.getPin();
    if (savedPin) {
      setIsAuthenticated(true);
      loadBootstrapData();
    } else {
      setIsLoading(false);
    }
  }, [loadBootstrapData]);

  // Human label for when the offline cache was last written
  const formatCacheLabel = (ts: number | null): string | null => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      const now = Date.now();
      const mins = Math.round((now - ts) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} min ago`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return `${hrs} hr ago`;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };

  /**
   * Offline mode is read-only: creating, editing, deleting or cancelling records
   * while the sheet is disconnected would strand them in this browser's cache,
   * where the next live sync would silently overwrite them. Block with a clear dialog.
   */
  const requireOnline = (actionLabel: string): boolean => {
    if (gasApi.getIsOfflineMode()) {
      setOfflineBlockAction(actionLabel);
      return false;
    }
    return true;
  };

  // Current active firm helper
  const currentFirm = useMemo(() => {
    const list = settings.firms || [];
    const found = list.find((f) => f.id === activeFirmId) || list[0] || {
      id: 'firm-anwar-traders',
      name: 'Anwar Traders',
      nextBillNo: '101',
      nextQuoteNo: 'Q-201',
    };
    // The backend keeps the authoritative running counters at the top level of
    // settings for the ACTIVE firm (see updateSequenceCounter in Code.gs).
    // Suggest one past the highest existing number as well, so a new bill/quote
    // can never duplicate a number already in the register (heals numbering
    // even when history contains duplicates from the old pre-fix client).
    if (found && found.id === (settings.activeFirmId || list[0]?.id)) {
      return {
        ...found,
        nextBillNo: getSuggestedNextNo(docs, settings.nextBillNo || (found as any).nextBillNo || '101', found.id, 'BILL'),
        nextQuoteNo: getSuggestedNextNo(docs, settings.nextQuoteNo || (found as any).nextQuoteNo || 'Q-201', found.id, 'QUOTATION'),
      };
    }
    return found;
  }, [settings.firms, settings.activeFirmId, settings.nextBillNo, settings.nextQuoteNo, activeFirmId, docs]);

  // Handle PIN verification
  const handlePinSubmit = async (pin: string) => {
    setIsVerifyingPin(true);
    setPinError('');
    try {
      const ok = await gasApi.verifyPin(pin);
      if (ok) {
        setIsAuthenticated(true);
        showToast(`Welcome to ${settings.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Portal`, 'success');
        await loadBootstrapData();
      } else {
        setPinError('Incorrect PIN. Please enter the valid 4-digit PIN.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLock = () => {
    gasApi.clearPin();
    setIsAuthenticated(false);
    setCurrentScreen('HOME');
    showToast('App locked successfully', 'info');
  };

  // Navigation handlers
  const handleNewBill = () => {
    if (!requireOnline('create a new bill')) return;
    setFormDocType('BILL');
    setEditingDoc({
      type: 'BILL',
      firmId: currentFirm.id,
      firmName: currentFirm.name,
      docNo: currentFirm.nextBillNo || '101',
      requestId: generateUUID(),
      items: [],
    });
    setCurrentScreen('ENTRY_FORM');
  };

  const handleNewQuotation = () => {
    if (!requireOnline('create a new quotation')) return;
    setFormDocType('QUOTATION');
    setEditingDoc({
      type: 'QUOTATION',
      firmId: currentFirm.id,
      firmName: currentFirm.name,
      docNo: currentFirm.nextQuoteNo || 'Q-201',
      requestId: generateUUID(),
      items: [],
    });
    setCurrentScreen('ENTRY_FORM');
  };

  const handleOpenSettings = () => {
    setCurrentScreen('SETTINGS');
  };

  const handleSelectDoc = async (doc: DocumentRecord) => {
    const existingItems = safeNormalizeItems(doc.items || doc.Items);
    const baseDoc = { ...doc, items: existingItems, Items: existingItems };
    setActiveDoc(baseDoc);
    setCurrentScreen('PREVIEW');

    const docId = doc.docId || doc.DocID;
    if (existingItems.length === 0 && docId) {
      try {
        const full: any = await gasApi.getDoc(docId);
        const fetchedItems = safeNormalizeItems(full?.items || full?.Items || full?.doc?.items);
        if (fetchedItems.length > 0) {
          setActiveDoc((prev) => (prev ? { ...prev, items: fetchedItems, Items: fetchedItems } : baseDoc));
        }
      } catch {
        // baseDoc already displayed safely
      }
    }
  };

  const handleEditDoc = async (doc: DocumentRecord) => {
    if (!requireOnline('edit this document')) return;
    const existingItems = safeNormalizeItems(doc.items || doc.Items);
    let fullDoc: DocumentRecord = { ...doc, items: existingItems, Items: existingItems };
    const docId = doc.docId || doc.DocID;
    if (existingItems.length === 0 && docId) {
      try {
        const full: any = await gasApi.getDoc(docId);
        const fetchedItems = safeNormalizeItems(full?.items || full?.Items || full?.doc?.items);
        if (fetchedItems.length > 0) {
          fullDoc = { ...doc, items: fetchedItems, Items: fetchedItems };
        }
      } catch {
        // fallback to base fullDoc
      }
    }
    setFormDocType(doc.type || doc.Type || 'BILL');
    setEditingDoc(fullDoc);
    setCurrentScreen('ENTRY_FORM');
  };

  const handleDuplicateDoc = async (doc: DocumentRecord) => {
    if (!requireOnline('duplicate this document')) return;
    const existingItems = safeNormalizeItems(doc.items || doc.Items);
    let fullDoc: DocumentRecord = { ...doc, items: existingItems, Items: existingItems };
    const docId = doc.docId || doc.DocID;
    if (existingItems.length === 0 && docId) {
      try {
        const full: any = await gasApi.getDoc(docId);
        const fetchedItems = safeNormalizeItems(full?.items || full?.Items || full?.doc?.items);
        if (fetchedItems.length > 0) {
          fullDoc = { ...doc, items: fetchedItems, Items: fetchedItems };
        }
      } catch {
        // use doc
      }
    }

    const docType = doc.type || doc.Type || 'BILL';
    const nextNo = docType === 'BILL' ? currentFirm.nextBillNo : currentFirm.nextQuoteNo;

    setFormDocType(docType);
    setEditingDoc({
      ...fullDoc,
      docId: undefined,
      DocID: undefined,
      docNo: nextNo,
      DocNo: nextNo,
      date: new Date().toISOString().split('T')[0],
      Date: new Date().toISOString().split('T')[0],
      requestId: generateUUID(),
    });
    setCurrentScreen('ENTRY_FORM');
    showToast(`Duplicated ${docType} #${doc.docNo || doc.DocNo}`, 'info');
  };

  const handleMakeBillFromQuotation = async (quotationDoc: DocumentRecord) => {
    if (!requireOnline('convert this quotation to a bill')) return;
    const existingItems = safeNormalizeItems(quotationDoc.items || quotationDoc.Items);
    let fullDoc: DocumentRecord = { ...quotationDoc, items: existingItems, Items: existingItems };
    const docId = quotationDoc.docId || quotationDoc.DocID;
    if (existingItems.length === 0 && docId) {
      try {
        const full: any = await gasApi.getDoc(docId);
        const fetchedItems = safeNormalizeItems(full?.items || full?.Items || full?.doc?.items);
        if (fetchedItems.length > 0) {
          fullDoc = { ...quotationDoc, items: fetchedItems, Items: fetchedItems };
        }
      } catch {
        // use doc
      }
    }

    setFormDocType('BILL');
    setEditingDoc({
      ...fullDoc,
      type: 'BILL',
      Type: 'BILL',
      docId: undefined,
      DocID: undefined,
      docNo: currentFirm.nextBillNo || '101',
      DocNo: currentFirm.nextBillNo || '101',
      date: new Date().toISOString().split('T')[0],
      Date: new Date().toISOString().split('T')[0],
      validUntil: undefined,
      requestId: generateUUID(),
    });
    setCurrentScreen('ENTRY_FORM');
    showToast(`Created Bill from Quotation #${quotationDoc.docNo || quotationDoc.DocNo}`, 'info');
  };

  const handleCancelDoc = async (docId: string) => {
    if (!requireOnline('cancel this document')) return;
    try {
      await gasApi.cancelDoc(docId);
      setDocs((prev) =>
        prev.map((d) =>
          (d.docId || d.DocID) === docId
            ? { ...d, status: 'Cancelled', Status: 'Cancelled' }
            : d
        )
      );
      showToast('Document marked as Cancelled', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel document', 'error');
    }
  };

  const handleDeleteDoc = async (doc: DocumentRecord) => {
    if (!requireOnline('delete this document')) return;
    const docId = String(doc.docId || doc.DocID || '').trim();
    const docType = String(doc.type || doc.Type || 'BILL').toUpperCase();
    const docNo = String(doc.docNo || doc.DocNo || '').trim();
    const firmId = doc.firmId || currentFirm.id;

    // 1. Immediately and synchronously remove from local React state so it vanishes from the UI instantaneously.
    // Remove ONLY the exact document by ID. Never match by document number alone:
    // numbers can repeat across history and must not cause collateral removal.
    setDocs((prevDocs) =>
      prevDocs.filter((d) => {
        const dId = String(d.docId || d.DocID || '').trim();
        if (docId && dId) return dId !== docId;
        return true;
      })
    );

    // 2. If the active previewed document is the deleted document, clear it
    setActiveDoc((prev) => {
      if (!prev) return null;
      const prevId = String(prev.docId || prev.DocID || '').trim();
      if (docId && prevId && prevId === docId) return null;
      return prev;
    });

    try {
      const res = await gasApi.deleteDoc(docId, docType, docNo, firmId);
      if (res && res.settings) {
        setSettings(res.settings);
      }
      showToast(`${docType} #${docNo} deleted successfully. Numbering rolled back (LIFO).`, 'success');
    } catch (err: any) {
      console.error('Error during deleteDoc sync with Google Sheet:', err);
      // Keep document removed locally and notify user if Google Sheet sync had a temporary issue
      showToast(`${docType} #${docNo} deleted locally. Note: Google Sheet sync offline.`, 'info');
    }
  };

  const handleSaveDoc = async (docData: any, previewAfter: boolean) => {
    if (!requireOnline('save this document')) return;
    setIsSaving(true);
    try {
      const res = await gasApi.saveDoc(docData);
      if (res && res.ok) {
        showToast(`Document #${res.docNo} saved successfully!`, 'success');
        await loadBootstrapData();

        if (previewAfter) {
          const savedDoc: DocumentRecord = {
            ...docData,
            docId: res.docId,
            DocID: res.docId,
            docNo: res.docNo,
            DocNo: res.docNo,
          };
          setActiveDoc(savedDoc);
          setCurrentScreen('PREVIEW');
        } else {
          setCurrentScreen('HOME');
        }
      } else {
        throw new Error('Save failed');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error saving document. Please retry.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (newSettings: SupplierSettings) => {
    if (!requireOnline('save settings')) return;
    setIsSaving(true);
    try {
      const res = await gasApi.saveSettings(newSettings);
      if (res && res.ok) {
        setSettings(newSettings);
        showToast('Settings & Firm configurations saved successfully!', 'success');
        setCurrentScreen('HOME');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Client Management Handlers
  const handleOpenAddClient = () => {
    if (!requireOnline('add a client')) return;
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (client: SavedClient) => {
    if (!requireOnline('edit this client')) return;
    setClientToEdit(client);
    setIsClientModalOpen(true);
  };

  const handleSaveClient = async (client: SavedClient) => {
    await gasApi.saveClient(client);
    await loadBootstrapData();
    showToast(`Client "${client.name}" saved successfully`, 'success');
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!requireOnline('delete this client')) return;
    await gasApi.deleteClient(clientId, clientName);
    await loadBootstrapData();
    showToast(`Client "${clientName}" removed`, 'info');
  };

  // If not authenticated, render PIN Screen
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <PinScreen
          onSuccess={handlePinSubmit}
          isLoading={isVerifyingPin}
          errorMessage={pinError}
        />
  
      {/* Offline read-only guard: blocks any mutation while the sheet is disconnected */}
      {offlineBlockAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-[2px]" onClick={() => setOfflineBlockAction(null)}>
          <div className="corp-card max-w-sm w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOfflineBlockAction(null)}
              className="absolute top-3.5 right-3.5 p-1.5 text-ink-400 hover:text-ink-700 hover:bg-paper rounded-lg transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="w-11 h-11 rounded-xl bg-gold-100 flex items-center justify-center mb-3">
              <WifiOff className="w-5 h-5 text-gold-700" />
            </span>
            <h3 className="text-[15px] font-extrabold text-ink-900 tracking-tight mb-1.5">
              You're offline — read-only mode
            </h3>
            <p className="text-xs text-ink-500 leading-relaxed mb-1.5">
              You tried to <strong>{offlineBlockAction}</strong>, but your Google Sheet isn't connected in this browser.
            </p>
            <p className="text-xs text-ink-500 leading-relaxed mb-5">
              Records changed offline would never reach your register, so editing is paused until you reconnect.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setOfflineBlockAction(null); loadBootstrapData(); }}
                className="corp-btn-primary w-full text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
              <button
                onClick={() => { setOfflineBlockAction(null); handleOpenSettings(); }}
                className="corp-btn-ghost w-full text-xs"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Connect Sheet in Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Screen 2: HOME */}
      {currentScreen === 'HOME' && (
        <HomeScreen
          docs={docs}
          settings={settings}
          clients={clients}
          isOfflineMode={isOfflineMode}
          offlineReason={gasApi.getOfflineReason()}
          cacheDateLabel={formatCacheLabel(gasApi.getCacheTimestamp())}
          onRetryConnection={loadBootstrapData}
          activeFirmId={activeFirmId}
          onSelectFirm={(id) => setActiveFirmId(id)}
          onNewBill={handleNewBill}
          onNewQuotation={handleNewQuotation}
          onOpenSettings={handleOpenSettings}
          onSelectDoc={handleSelectDoc}
          onEditDoc={handleEditDoc}
          onDuplicateDoc={handleDuplicateDoc}
          onMakeBillFromQuotation={handleMakeBillFromQuotation}
          onCancelDoc={handleCancelDoc}
          onDeleteDoc={handleDeleteDoc}
          onRefresh={loadBootstrapData}
          onLock={handleLock}
          onOpenAddClient={handleOpenAddClient}
          onEditClient={handleOpenEditClient}
          onDeleteClient={handleDeleteClient}
        />
      )}

      {/* Screen 3: ENTRY FORM */}
      {currentScreen === 'ENTRY_FORM' && (
        <EntryFormScreen
          key={editingDoc?.docId || editingDoc?.DocID || 'new-' + formDocType + '-' + (editingDoc?.requestId || 'new')}
          initialDoc={editingDoc}
          docType={formDocType}
          settings={settings}
          clients={clients}
          catalog={catalog}
          docs={docs}
          onBack={() => setCurrentScreen('HOME')}
          onSave={handleSaveDoc}
          isSaving={isSaving}
        />
      )}

      {/* Screen 4: PREVIEW / PRINT */}
      {currentScreen === 'PREVIEW' && (
        activeDoc ? (
          <PreviewScreen
            doc={activeDoc}
            settings={settings}
            onBack={() => setCurrentScreen('HOME')}
            onEdit={() => handleEditDoc(activeDoc)}
          />
        ) : (
          <div className="min-h-screen bg-paper flex items-center justify-center p-6">
            <div className="corp-card p-8 text-center max-w-sm">
              <p className="text-ink-900 font-bold mb-4">No document selected</p>
              <button
                onClick={() => setCurrentScreen('HOME')}
                className="corp-btn-primary text-xs"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )
      )}

      {/* SETTINGS SCREEN */}
      {currentScreen === 'SETTINGS' && (
        <SettingsScreen
          settings={settings}
          docs={docs}
          onBack={() => setCurrentScreen('HOME')}
          onSave={handleSaveSettings}
          onDeleteDoc={handleDeleteDoc}
          onRefreshData={loadBootstrapData}
          isSaving={isSaving}
        />
      )}

      {/* Client Add / Edit Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        clientToEdit={clientToEdit}
      />
    </ErrorBoundary>
  );
}
