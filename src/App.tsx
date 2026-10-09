/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  CatalogItem,
  DocumentRecord,
  DocType,
  SavedClient,
  SupplierSettings,
} from './types/billing';
import { DEFAULT_SETTINGS, gasApi, DeletePinRequiredError } from './api/gasClient';
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
import { WifiOff, RefreshCw } from 'lucide-react';

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
  const [connectionError, setConnectionError] = useState<string>('');
  const [drafts, setDrafts] = useState<DocumentRecord[]>([]);
  const [resumeCandidates, setResumeCandidates] = useState<DocumentRecord[] | null>(null);
  const [deletePinRequired, setDeletePinRequired] = useState<boolean>(false);


  // Navigation & Active state
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null);
  const [formDocType, setFormDocType] = useState<DocType>('BILL');
  const [editingDoc, setEditingDoc] = useState<Partial<DocumentRecord> | null>(null);
  // Server-draft autosave refs (no re-render on keystroke)
  const draftPayloadRef = useRef<any>(null);
  const draftTimerRef = useRef<number | null>(null);
  const isAuthenticatedRef = useRef<boolean>(false);

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

  // Bootstrap data loading — pure sheet sync. Either the live sheet answers
  // or the failure is shown loudly; stale cached data is never presented.
  const loadBootstrapData = useCallback(async () => {
    try {
      setIsLoading(true);
      setConnectionError('');
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
        setDrafts((data as any).drafts || []);
      }
      return data;
    } catch (err: any) {
      console.error('Failed to load data:', err);
      if (err.message && /incorrect pin/i.test(err.message)) {
        isAuthenticatedRef.current = false;
        setIsAuthenticated(false);
        setPinError(err.message);
      } else {
        // No local cache to fall back to by design: show the failure plainly.
        setConnectionError(err.message || 'Could not reach the billing server.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Draft autosave: the entry form reports its in-progress document here on
  // every change (ref only, no re-render); we persist it to the sheet as a
  // Draft after 8s of quiet, and flush it on page hide/close.
  const persistDraft = useCallback(async () => {
    const doc = draftPayloadRef.current;
    if (!doc || !isAuthenticatedRef.current || !gasApi.getPin()) return;
    try {
      await gasApi.saveDraft(doc);
    } catch {
      // Silent: the next change (or page-hide flush) retries.
    }
  }, []);

  const handleDraftChange = useCallback((doc: any | null) => {
    draftPayloadRef.current = doc;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    if (!doc) return;
    draftTimerRef.current = window.setTimeout(() => { void persistDraft(); }, 8000);
  }, [persistDraft]);

  useEffect(() => {
    const flush = () => {
      const doc = draftPayloadRef.current;
      if (!doc || !gasApi.getPin()) return;
      void gasApi.flushDraft(doc); // keepalive: survives refresh/close
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const clearDraftState = useCallback(() => {
    draftPayloadRef.current = null;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
  }, []);

  // Every page load starts at the PIN screen: the PIN lives in memory only,
  // so a refresh always re-locks the portal. Unfinished work is recovered from
  // server-side drafts after login (see resumeCandidates).
  useEffect(() => {
    setIsLoading(false);
  }, []);

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
        isAuthenticatedRef.current = true;
        setIsAuthenticated(true);
        showToast(`Welcome to ${settings.ownerName || 'MIAN FARHAN ANWAR'} Enterprise Portal`, 'success');
        const bootData: any = await loadBootstrapData();
        try {
          const status = await gasApi.checkBackendStatus();
          setDeletePinRequired(!!status.deletePinConfigured);
        } catch { /* non-fatal */ }
        // Offer to resume unfinished work recovered from server-side drafts.
        const freshDrafts = (bootData?.drafts || []) as DocumentRecord[];
        if (freshDrafts.length > 0) setResumeCandidates(freshDrafts);
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
    clearDraftState();
    isAuthenticatedRef.current = false;
    setIsAuthenticated(false);
    setResumeCandidates(null);
    setDrafts([]);
    setCurrentScreen('HOME');
    showToast('App locked successfully', 'info');
  };

  // Navigation handlers
  const handleNewBill = () => {
    clearDraftState();
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
    clearDraftState();
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

  const handleCancelDoc = async (docId: string, authorityPin?: string) => {
    try {
      if (deletePinRequired && authorityPin) gasApi.setDeletePin(authorityPin);
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
      if (err instanceof DeletePinRequiredError) throw err; // keep PIN modal open for retry
      showToast(err.message || 'Failed to cancel document', 'error');
    }
  };

  const handleDeleteDoc = async (doc: DocumentRecord, authorityPin?: string) => {
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
      if (deletePinRequired && authorityPin) gasApi.setDeletePin(authorityPin);
      const res = await gasApi.deleteDoc(docId, docType, docNo, firmId);
      if (res && res.settings) {
        setSettings(res.settings);
      }
      showToast(`${docType} #${docNo} deleted successfully. Numbering rolled back (LIFO).`, 'success');
    } catch (err: any) {
      console.error('Error during deleteDoc sync with Google Sheet:', err);
      if (err instanceof DeletePinRequiredError) {
        throw err; // keep the LIFO modal open so the PIN can be retried
      } else {
        showToast(err.message || `Could not delete ${docType} #${docNo}.`, 'error');
      }
      await loadBootstrapData(); // restore the truthful register state
    }
  };

  // Resume an unfinished server-side draft in the entry form
  const handleResumeDraft = (draft: DocumentRecord) => {
    const docType = (String(draft.type || draft.Type || 'BILL').toUpperCase() as DocType) || 'BILL';
    const freshNo = docType === 'BILL' ? currentFirm.nextBillNo : currentFirm.nextQuoteNo;
    setFormDocType(docType);
    setEditingDoc({
      ...(draft as any),
      docId: draft.docId || (draft as any).DocID,
      status: 'Draft',
      docNo: freshNo, // re-suggest: the draft held no number
      DocNo: freshNo,
    } as any);
    setResumeCandidates(null);
    setCurrentScreen('ENTRY_FORM');
    showToast('Draft restored — review and save when ready.', 'info');
  };

  // Discard an unfinished server-side draft
  const handleDiscardDraft = async (draft: DocumentRecord) => {
    const docId = String(draft.docId || (draft as any).DocID || '').trim();
    if (!docId) return;
    try {
      await gasApi.discardDraft(docId);
      showToast('Draft discarded.', 'info');
      await loadBootstrapData();
      setResumeCandidates((prev) => (prev || []).filter((d) => String(d.docId || (d as any).DocID) !== docId));
    } catch (err: any) {
      showToast(err.message || 'Could not discard the draft.', 'error');
    }
  };

  const handleSaveDoc = async (docData: any, previewAfter: boolean) => {
    setIsSaving(true);
    try {
      const res = await gasApi.saveDoc(docData);
      if (res && res.ok) {
        const corrected = (res as any).docNoCorrected || String(res.docNo) !== String(docData.docNo || docData.DocNo);
        showToast(
          corrected
            ? `Bill number was already in use — saved as #${res.docNo} instead.`
            : `Document #${res.docNo} saved successfully!`,
          corrected ? 'info' : 'success'
        );
        clearDraftState(); // the draft row just became the real document
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
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (client: SavedClient) => {
    setClientToEdit(client);
    setIsClientModalOpen(true);
  };

  const handleSaveClient = async (client: SavedClient) => {
    await gasApi.saveClient(client);
    await loadBootstrapData();
    showToast(`Client "${client.name}" saved successfully`, 'success');
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
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
          onRetryConnection={() => { void loadBootstrapData(); }}
          deletePinRequired={deletePinRequired}
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
          onDraftChange={handleDraftChange}
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
          deletePinRequired={deletePinRequired}
          onRefreshData={async () => { await loadBootstrapData(); }}
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

      {/* Fatal connection state: pure sheet sync means no cached data to show.
          The register is either live or it says so plainly. */}
      {connectionError && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-paper">
          <div className="corp-card max-w-sm w-full p-6 text-center">
            <span className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-3 mx-auto">
              <WifiOff className="w-5 h-5 text-[#b3372f]" />
            </span>
            <h3 className="text-[15px] font-extrabold text-ink-900 tracking-tight mb-1.5">
              Can't reach your Google Sheet
            </h3>
            <p className="text-xs text-ink-500 mb-1.5 leading-relaxed">
              {connectionError}
            </p>
            <p className="text-[11px] text-ink-400 mb-4 leading-relaxed">
              Nothing is stored in this browser, so there's no stale copy to show. Reconnect to continue.
            </p>
            <button onClick={() => { loadBootstrapData(); }} className="corp-btn-primary w-full text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Resume unfinished work recovered from server-side drafts */}
      {resumeCandidates && resumeCandidates.length > 0 && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-[2px]">
          <div className="corp-card max-w-md w-full p-6">
            <h3 className="text-[15px] font-extrabold text-ink-900 tracking-tight mb-1">
              Unfinished work found
            </h3>
            <p className="text-xs text-ink-500 mb-4 leading-relaxed">
              These drafts were auto-saved to your Google Sheet. Resume one, or discard it.
            </p>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {resumeCandidates.map((d: any) => {
                const dId = String(d.docId || d.DocID || '');
                const dType = String(d.type || d.Type || 'BILL');
                const dClient = String(d.clientName || d.ClientName || 'No client yet');
                const dItems = Array.isArray(d.items || d.Items) ? (d.items || d.Items).length : 0;
                const dWhen = d.updatedAt ? new Date(d.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div key={dId} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-line bg-paper/60">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-ink-900 truncate">{dType === 'BILL' ? 'Bill' : 'Quotation'} draft · {dClient}</div>
                      <div className="text-[11px] text-ink-400">{dItems} item{dItems === 1 ? '' : 's'}{dWhen ? ` · ${dWhen}` : ''}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => handleResumeDraft(d)} className="corp-btn-primary !py-1.5 text-[11px]">Resume</button>
                      <button onClick={() => handleDiscardDraft(d)} className="corp-btn-ghost !py-1.5 text-[11px]">Discard</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setResumeCandidates(null)} className="corp-btn-ghost w-full text-xs">
              Start fresh instead
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
