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
import { ToastContainer, type ToastMessage } from './components/Toast';
import { generateUUID } from './utils/formatters';

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

  // Current active firm helper
  const currentFirm = useMemo(() => {
    const list = settings.firms || [];
    return list.find((f) => f.id === activeFirmId) || list[0] || {
      id: 'firm-anwar-traders',
      name: 'Anwar Traders',
      nextBillNo: '101',
      nextQuoteNo: 'Q-201',
    };
  }, [settings.firms, activeFirmId]);

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
    const docId = doc.docId || doc.DocID;
    if (doc.items && doc.items.length > 0) {
      setActiveDoc(doc);
      setCurrentScreen('PREVIEW');
      return;
    }

    if (docId) {
      try {
        const full = await gasApi.getDoc(docId);
        const mergedDoc = { ...doc, items: full.items || doc.items || [] };
        setActiveDoc(mergedDoc);
      } catch {
        setActiveDoc(doc);
      }
    } else {
      setActiveDoc(doc);
    }
    setCurrentScreen('PREVIEW');
  };

  const handleEditDoc = async (doc: DocumentRecord) => {
    const docId = doc.docId || doc.DocID;
    let fullDoc = doc;
    if (docId && (!doc.items || doc.items.length === 0)) {
      try {
        const full = await gasApi.getDoc(docId);
        fullDoc = { ...doc, items: full.items || [] };
      } catch {
        // use doc
      }
    }
    setFormDocType(doc.type || doc.Type || 'BILL');
    setEditingDoc(fullDoc);
    setCurrentScreen('ENTRY_FORM');
  };

  const handleDuplicateDoc = async (doc: DocumentRecord) => {
    const docId = doc.docId || doc.DocID;
    let fullDoc = doc;
    if (docId && (!doc.items || doc.items.length === 0)) {
      try {
        const full = await gasApi.getDoc(docId);
        fullDoc = { ...doc, items: full.items || [] };
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
    const docId = quotationDoc.docId || quotationDoc.DocID;
    let fullDoc = quotationDoc;
    if (docId && (!quotationDoc.items || quotationDoc.items.length === 0)) {
      try {
        const full = await gasApi.getDoc(docId);
        fullDoc = { ...quotationDoc, items: full.items || [] };
      } catch {
        // use quotationDoc
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

  const handleSaveDoc = async (docData: any, previewAfter: boolean) => {
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
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <PinScreen
          onSuccess={handlePinSubmit}
          isLoading={isVerifyingPin}
          errorMessage={pinError}
        />
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Screen 2: HOME */}
      {currentScreen === 'HOME' && (
        <HomeScreen
          docs={docs}
          settings={settings}
          clients={clients}
          isOfflineMode={isOfflineMode}
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
          initialDoc={editingDoc}
          docType={formDocType}
          settings={settings}
          clients={clients}
          catalog={catalog}
          onBack={() => setCurrentScreen('HOME')}
          onSave={handleSaveDoc}
          isSaving={isSaving}
        />
      )}

      {/* Screen 4: PREVIEW / PRINT */}
      {currentScreen === 'PREVIEW' && activeDoc && (
        <PreviewScreen
          doc={activeDoc}
          settings={settings}
          onBack={() => setCurrentScreen('HOME')}
          onEdit={() => handleEditDoc(activeDoc)}
        />
      )}

      {/* SETTINGS SCREEN */}
      {currentScreen === 'SETTINGS' && (
        <SettingsScreen
          settings={settings}
          onBack={() => setCurrentScreen('HOME')}
          onSave={handleSaveSettings}
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
    </>
  );
}
