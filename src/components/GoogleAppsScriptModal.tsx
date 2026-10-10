import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Layers,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * ANWAR TRADERS & HASHIR TRADERS — ENTERPRISE BILLING GOOGLE APPS SCRIPT
 * File: Code.gs
 * Target: Google Sheets Container-Bound Apps Script / Web App
 * =========================================================================
 * 
 * Features Supported:
 *  1. bootstrap: Loads Settings, Multi-Firm profiles, Clients, Documents, Items
 *  2. saveDoc: Records Bill / Quotation header & line items, updates sequence counters
 *  3. deleteDoc: LIFO Deletion synced with Google Sheet — deletes Document row & Items,
 *                and rolls back nextBillNo / nextQuoteNo counter
 *  4. saveClient: Synced client registration & updates directly to Clients sheet
 *  5. deleteClient: Removes client from Clients sheet
 *  6. saveSettings: Updates multi-firm settings and margins
 *  7. setupSheets: Automatic sheet creation with headers and initial schema
 */

// 1. WEB APP ENTRY POINT: POST REQUEST HANDLER
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 second concurrency lock
  } catch (err) {
    return createJsonResponse({ ok: false, error: 'Server busy. Please retry.' }, 429);
  }

  try {
    var rawPostData = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var requestData = {};
    try {
      requestData = JSON.parse(rawPostData);
    } catch (parseErr) {
      requestData = {};
    }

    // Optional API Key Verification (matches Script Properties API_KEY if set)
    var scriptProps = PropertiesService.getScriptProperties();
    var expectedApiKey = scriptProps.getProperty('API_KEY');
    if (expectedApiKey) {
      var providedKey = requestData.key || (e && e.parameter && e.parameter.key);
      if (!providedKey || String(providedKey).trim() !== String(expectedApiKey).trim()) {
        return createJsonResponse({ ok: false, error: 'Invalid or missing API_KEY.' }, 401);
      }
    }

    var action = requestData.action || (e && e.parameter && e.parameter.action) || 'bootstrap';
    var payload = requestData.payload || {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureRequiredSheets(ss);

    switch (action) {
      case 'ping':
      case 'checkConfig':
        return createJsonResponse({ ok: true, message: 'Google Apps Script backend connected successfully.' });

      case 'bootstrap':
        var bootstrapData = handleBootstrap(ss);
        return createJsonResponse({ ok: true, data: bootstrapData });

      case 'saveDoc':
        var saveResult = handleSaveDoc(ss, payload);
        return createJsonResponse({ ok: true, data: saveResult });

      case 'deleteDoc':
        var deleteResult = handleDeleteDoc(ss, payload);
        return createJsonResponse({ ok: true, data: deleteResult });

      case 'discardDraft':
        var discardResult = handleDiscardDraft(ss, payload);
        return createJsonResponse({ ok: true, data: discardResult });

      case 'logVisit':
        var visitResult = handleLogVisit(ss, payload);
        return createJsonResponse({ ok: true, data: visitResult });

      case 'getVisits':
        return createJsonResponse({ ok: true, data: handleGetVisits(ss, payload) });

      case 'cancelDoc':
        var cancelResult = handleCancelDoc(ss, payload);
        return createJsonResponse({ ok: true, data: cancelResult });

      case 'saveClient':
        var clientResult = handleSaveClient(ss, payload);
        return createJsonResponse({ ok: true, data: clientResult });

      case 'deleteClient':
        var delClientResult = handleDeleteClient(ss, payload);
        return createJsonResponse({ ok: true, data: delClientResult });

      case 'saveSettings':
        var settingsResult = handleSaveSettings(ss, payload);
        return createJsonResponse({ ok: true, data: settingsResult });

      default:
        return createJsonResponse({ ok: false, error: 'Unrecognized action: ' + action }, 400);
    }
  } catch (globalErr) {
    return createJsonResponse({ ok: false, error: globalErr.message || String(globalErr) }, 500);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// 2. WEB APP GET HANDLER (Diagnostics & Status Ping)
function doGet(e) {
  return createJsonResponse({
    ok: true,
    service: 'Anwar Traders & Hashir Traders Billing Engine',
    version: '2.6.7',
    timestamp: new Date().toISOString(),
    status: 'Ready'
  });
}

// -------------------------------------------------------------------------
// ACTION HANDLERS
// -------------------------------------------------------------------------

function handleBootstrap(ss) {
  var settings = loadSettings(ss);
  var clients = loadClients(ss);
  var allDocs = loadDocuments(ss);
  var docs = [];
  var drafts = [];
  for (var i = 0; i < allDocs.length; i++) {
    if (String(allDocs[i].status || 'Active').toUpperCase() === 'DRAFT') drafts.push(allDocs[i]);
    else docs.push(allDocs[i]);
  }
  // most recently touched draft first
  drafts.sort(function (a, b) { return String(b.updatedAt || '') < String(a.updatedAt || '') ? -1 : 1; });
  return {
    settings: settings,
    clients: clients,
    docs: docs,
    drafts: drafts
  };
}

/**
 * Finds a document currently using the given numeric document number
 * (same type + firm). Returns {docId, clientName, date} or null.
 */
function findDocByNumber(ss, firmId, docType, num) {
  var sheet = ss.getSheetByName('Documents');
  if (!sheet || sheet.getLastRow() < 2) return null;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 19).getValues();
  var wantType = String(docType || 'BILL').toUpperCase();
  var wantFirm = String(firmId || '').trim();
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][18] || 'Active').toUpperCase() === 'DRAFT') continue;
    var rType = String(data[i][2] || 'BILL').toUpperCase();
    if (rType !== wantType) continue;
    var rFirm = String(data[i][3] || '').trim();
    if (wantFirm && rFirm && rFirm !== wantFirm) continue;
    if (numPart(data[i][1]) === num) {
      return {
        docId: String(data[i][0] || ''),
        clientName: String(data[i][6] || ''),
        date: String(data[i][5] || '')
      };
    }
  }
  return null;
}

function handleSaveDoc(ss, payload) {
  // Accept every payload shape the clients send: { docData }, { doc }, or the doc itself.
  var docData = payload.docData || payload.doc || payload;
  var docId = docData.docId || docData.DocID || ('doc-' + Date.now());
  var isDraft = String(docData.status || 'Active').toUpperCase() === 'DRAFT';
  var rawDocNo = String(docData.docNo != null ? docData.docNo : (docData.DocNo != null ? docData.DocNo : '')).trim();
  var docNo = isDraft ? rawDocNo : (rawDocNo || '101');
  var docType = String(docData.type || docData.Type || 'BILL').toUpperCase();
  var firmId = String(docData.firmId || 'firm-anwar-traders').trim();
  var firmName = String(docData.firmName || 'Anwar Traders').trim();

  var docsSheet = ss.getSheetByName('Documents');
  var itemsSheet = ss.getSheetByName('Items');

  var docHeaders = docsSheet.getRange(1, 1, 1, docsSheet.getLastColumn() || 1).getValues()[0];
  var docRowData = [
    docId,
    docNo,
    docType,
    firmId,
    firmName,
    docData.date || new Date().toISOString().slice(0, 10),
    docData.clientName || 'Client',
    docData.clientAddress || '',
    docData.clientNTN || '',
    docData.clientSTRN || '',
    docData.refText || '',
    Number(docData.goodsSub || 0),
    Number(docData.gst || 0),
    Number(docData.gstRate || 0.18),
    Number(docData.serviceSub || 0),
    Number(docData.pst || 0),
    Number(docData.otherSub || 0),
    Number(docData.grandTotal || 0),
    docData.status || 'Active',
    new Date().toISOString()
  ];

  // Upsert in Documents sheet
  var data = docsSheet.getDataRange().getValues();
  var rowIndexToUpdate = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === docId) {
      rowIndexToUpdate = i + 1;
      break;
    }
  }

  // INVARIANT: a draft autosave must NEVER downgrade an already-issued document.
  // Race: the 8s draft timer can fire while the final save is still in flight
  // (Apps Script calls take seconds); last-write-wins would otherwise flip the
  // issued bill back to Draft. The frontend cancels its timer on save, but a
  // request already in flight cannot be recalled - so the backend is the arbiter.
  if (rowIndexToUpdate > 0 && isDraft) {
    var existingStatus = String(data[rowIndexToUpdate - 1][18] || 'Active').toUpperCase();
    if (existingStatus !== 'DRAFT') {
      return { ok: true, docId: docId, docNo: String(data[rowIndexToUpdate - 1][1] || ''), draftSuperseded: true };
    }
  }

  // BACKEND-AUTHORITATIVE NUMBERING (duplicate-proof):
  // The frontend suggests a number from possibly stale state (stale tab, race),
  // so for NEW documents the backend assigns the final number itself:
  //   assigned = max(incoming number, highest existing number + 1).
  // An incoming number that is already taken (or below the register's max) is
  // bumped to the next free number; a fresh higher number is kept as-is.
  // Edits (rowIndexToUpdate > 0) never renumber.
  // A draft being converted to a real document must go through numbering too.
  var convertingDraft = false;
  if (rowIndexToUpdate > 0 && !isDraft) {
    var existingStatus = String(data[rowIndexToUpdate - 1][18] || 'Active').toUpperCase();
    if (existingStatus === 'DRAFT') convertingDraft = true;
  }

  var docNoWasCorrected = false;
  // Drafts never consume or disturb numbering; the number is assigned on final save.
  if ((rowIndexToUpdate <= 0 || convertingDraft) && !isDraft) {
    var incomingNum = numPart(docNo);
    var maxExistingNo = getMaxDocNo(ss, firmId, docType);
    var minFreeNo = maxExistingNo + 1;
    var noPrefix = String(docNo).replace(/[0-9]/g, '');
    if (!noPrefix && docType !== 'BILL') noPrefix = 'Q-';
    if (incomingNum <= 0) {
      docNo = noPrefix + minFreeNo;
      docNoWasCorrected = true;
    }
    var clash = docNoWasCorrected ? null : findDocByNumber(ss, firmId, docType, incomingNum);
    if (clash) {
      if (docData.docNoManual === true) {
        // Explicit user intent: never silently change it. Reject with context.
        var kindLabel = docType === 'BILL' ? 'Bill' : 'Quotation';
        throw new Error(
          kindLabel + ' #' + docNo + ' is already used by ' +
          (clash.clientName || 'another entry') +
          (clash.date ? ' (' + clash.date + ')' : '') +
          '. Next free number is ' + noPrefix + minFreeNo + '.'
        );
      }
      // Stale system suggestion: no explicit intent, so take the next free number.
      docNo = noPrefix + minFreeNo;
      docNoWasCorrected = true;
    }
  }

  if (rowIndexToUpdate > 0) {
    docsSheet.getRange(rowIndexToUpdate, 1, 1, docRowData.length).setValues([docRowData]);
  } else {
    docsSheet.appendRow(docRowData);
  }

  // Clear previous items for this docId in Items sheet
  var itemsData = itemsSheet.getDataRange().getValues();
  for (var r = itemsData.length - 1; r >= 1; r--) {
    if (String(itemsData[r][0]).trim() === docId) {
      itemsSheet.deleteRow(r + 1);
    }
  }

  // Insert line items
  var items = docData.items || [];
  if (items && items.length > 0) {
    var itemsRows = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      itemsRows.push([
        docId,
        j + 1,
        it.description || '',
        it.unit || 'Nos',
        Number(it.qty || 1),
        Number(it.rate || 0),
        it.tax || 'GST',
        Number(it.taxRate || 0.18),
        Number(it.amount || 0)
      ]);
    }
    itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, itemsRows.length, itemsRows[0].length).setValues(itemsRows);
  }

  // Auto-record Client in Clients tab
  if (docData.clientName && String(docData.clientName).trim()) {
    handleSaveClient(ss, {
      client: {
        name: docData.clientName,
        address: docData.clientAddress || '',
        ntn: docData.clientNTN || '',
        strn: docData.clientSTRN || ''
      }
    });
  }

  // Auto-advance sequence counter in Settings (drafts don't consume numbers)
  if (!isDraft) updateSequenceCounter(ss, firmId, docType, docNo, false);

  return { ok: true, docId: docId, docNo: docNo, docNoCorrected: docNoWasCorrected };
}

/**
 * Discards an unfinished draft. Drafts never consumed a number, so there is
 * no counter rollback - the row and its items are simply removed.
 * Refuses to touch non-draft documents (safety).
 */
function handleDiscardDraft(ss, payload) {
  var docId = String((payload && (payload.docId || payload.DocID)) || '').trim();
  if (!docId) throw new Error('Missing docId.');
  var docsSheet = ss.getSheetByName('Documents');
  var data = docsSheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === docId) {
      if (String(data[i][18] || 'Active').toUpperCase() !== 'DRAFT') {
        throw new Error('Only drafts can be discarded.');
      }
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex > 0) docsSheet.deleteRow(rowIndex);
  var itemsSheet = ss.getSheetByName('Items');
  var itemsData = itemsSheet.getDataRange().getValues();
  for (var r = itemsData.length - 1; r >= 1; r--) {
    if (String(itemsData[r][0]).trim() === docId) itemsSheet.deleteRow(r + 1);
  }
  return { ok: true, docId: docId, discarded: rowIndex > 0 };
}

/**
 * Login audit log. Called by the Vercel proxy (after a successful bootstrap
 * = one row per PIN login). Records when, from where (country/city from
 * Vercel edge headers) and on what device — so the owner can see if anyone
 * besides the expected people is opening the app. The Visits tab is created
 * on first use and trimmed to the last 500 rows. Only the first three IP
 * octets are stored (privacy: enough to tell devices apart).
 */
function handleLogVisit(ss, payload) {
  var sheet = ss.getSheetByName('Visits');
  if (!sheet) {
    sheet = ss.insertSheet('Visits');
    sheet.appendRow(['Timestamp', 'Event', 'Country', 'Region', 'City', 'IP', 'Device']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date().toISOString(),
    String((payload && payload.event) || 'login'),
    String((payload && payload.country) || ''),
    String((payload && payload.region) || ''),
    String((payload && payload.city) || ''),
    String((payload && payload.ip) || ''),
    String((payload && payload.device) || '')
  ]);
  // Trim to the most recent 500 visits so the tab stays light.
  var lastRow = sheet.getLastRow();
  if (lastRow > 501) sheet.deleteRows(2, lastRow - 501);
  return { ok: true };
}

/**
 * Returns the most recent visit rows (newest first) for the in-app
 * Visitors tab. Limit defaults to 50.
 */
function handleGetVisits(ss, payload) {
  var limit = Math.min(Math.max(Number((payload && payload.limit) || 50, 1), 1), 200);
  var sheet = ss.getSheetByName('Visits');
  if (!sheet || sheet.getLastRow() < 2) return { visits: [] };
  var lastRow = sheet.getLastRow();
  var startRow = Math.max(2, lastRow - limit + 1);
  var values = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getValues();
  var visits = [];
  for (var i = values.length - 1; i >= 0; i--) {
    visits.push({
      timestamp: String(values[i][0] || ''),
      event: String(values[i][1] || ''),
      country: String(values[i][2] || ''),
      region: String(values[i][3] || ''),
      city: String(values[i][4] || ''),
      ip: String(values[i][5] || ''),
      device: String(values[i][6] || '')
    });
  }
  return { visits: visits };
}

/**
 * Permanently deletes a document from Google Sheets (LIFO Protocol)
 * Removes row from Documents, removes items from Items, and rolls back sequence number.
 */
/**
 * Soft-void: marks a document Cancelled in the register (audit trail kept).
 * Unlike LIFO delete, numbering is NOT rolled back.
 */
function handleCancelDoc(ss, payload) {
  var targetDocId = String(payload.docId || '').trim();
  if (!targetDocId) throw new Error('docId is required to cancel a document.');
  var docsSheet = ss.getSheetByName('Documents');
  if (!docsSheet) throw new Error('Documents sheet not found.');
  var docsData = docsSheet.getDataRange().getValues();
  for (var i = docsData.length - 1; i >= 1; i--) {
    if (String(docsData[i][0] || '').trim() === targetDocId) {
      docsSheet.getRange(i + 1, 19).setValue('Cancelled'); // Status column
      return { ok: true, docId: targetDocId };
    }
  }
  throw new Error('Document not found in register: ' + targetDocId);
}

function handleDeleteDoc(ss, payload) {
  var targetDocId = String(payload.docId || '').trim();
  var targetDocNo = String(payload.docNo || '').trim();
  var targetDocType = String(payload.docType || 'BILL').toUpperCase();
  var targetFirmId = String(payload.firmId || '').trim();

  var docsSheet = ss.getSheetByName('Documents');
  var itemsSheet = ss.getSheetByName('Items');

  var docsData = docsSheet.getDataRange().getValues();
  var deletedRowFound = false;
  var resolvedDocId = targetDocId;

  // Search from bottom up
  for (var i = docsData.length - 1; i >= 1; i--) {
    var rowDocId = String(docsData[i][0] || '').trim();
    var rowDocNo = String(docsData[i][1] || '').trim();
    var rowDocType = String(docsData[i][2] || 'BILL').toUpperCase();
    var rowFirmId = String(docsData[i][3] || '').trim();

    var match = false;
    if (targetDocId && rowDocId === targetDocId) match = true;
    if (!match && targetDocNo && rowDocNo === targetDocNo && targetDocType === rowDocType) {
      if (!targetFirmId || !rowFirmId || rowFirmId === targetFirmId) {
        match = true;
      }
    }

    if (match) {
      resolvedDocId = rowDocId;
      docsSheet.deleteRow(i + 1);
      deletedRowFound = true;
      break;
    }
  }

  // Delete matching items from Items sheet
  if (resolvedDocId) {
    var itemsData = itemsSheet.getDataRange().getValues();
    for (var r = itemsData.length - 1; r >= 1; r--) {
      if (String(itemsData[r][0] || '').trim() === resolvedDocId) {
        itemsSheet.deleteRow(r + 1);
      }
    }
  }

  // Roll back sequence counter (LIFO Rollback)
  var updatedSettings = null;
  if (targetDocNo) {
    updatedSettings = updateSequenceCounter(ss, targetFirmId, targetDocType, targetDocNo, true);
  }

  return {
    ok: true,
    deleted: deletedRowFound,
    docId: resolvedDocId,
    rolledBackNo: targetDocNo,
    settings: updatedSettings
  };
}

/**
 * Saves or updates a client record directly into the Clients sheet
 */
function handleSaveClient(ss, payload) {
  var client = payload.client || payload;
  var name = String(client.name || client.Name || '').trim();
  if (!name) return { ok: false, error: 'Client name is required.' };

  var clientsSheet = ss.getSheetByName('Clients');
  var data = clientsSheet.getDataRange().getValues();
  var existingRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').toLowerCase().trim() === name.toLowerCase()) {
      existingRow = i + 1;
      break;
    }
  }

  var clientId = client.id || ('client-' + Date.now());
  var address = client.address || client.Address || '';
  var ntn = client.ntn || client.NTN || '';
  var strn = client.strn || client.STRN || '';
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (existingRow > 0) {
    // Update existing row
    clientsSheet.getRange(existingRow, 3).setValue(address || clientsSheet.getRange(existingRow, 3).getValue());
    clientsSheet.getRange(existingRow, 4).setValue(ntn || clientsSheet.getRange(existingRow, 4).getValue());
    clientsSheet.getRange(existingRow, 5).setValue(strn || clientsSheet.getRange(existingRow, 5).getValue());
    clientsSheet.getRange(existingRow, 6).setValue(now);
  } else {
    clientsSheet.appendRow([clientId, name, address, ntn, strn, now]);
  }

  return { ok: true, client: { id: clientId, name: name, address: address, ntn: ntn, strn: strn, lastUsed: now } };
}

function handleDeleteClient(ss, payload) {
  var clientId = String(payload.clientId || '').trim();
  var clientName = String(payload.clientName || '').toLowerCase().trim();

  var clientsSheet = ss.getSheetByName('Clients');
  var data = clientsSheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    var cId = String(data[i][0] || '').trim();
    var cName = String(data[i][1] || '').toLowerCase().trim();

    if ((clientId && cId === clientId) || (clientName && cName === clientName)) {
      clientsSheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: true };
}

function handleSaveSettings(ss, payload) {
  var settings = payload.settings || payload;
  var settingsSheet = ss.getSheetByName('Settings');
  settingsSheet.clear();

  var headers = [
    'OwnerName', 'ActiveFirmId', 'SupplierName', 'SupplierTagline', 'SupplierAddress',
    'SupplierPhone', 'SupplierNTN', 'SupplierGST', 'VendorNo', 'GSTRate', 'PSTRate',
    'LetterheadTop', 'LetterheadBottom', 'NextBillNo', 'NextQuoteNo', 'FirmsJSON'
  ];

  var row = [
    settings.ownerName || 'MIAN FARHAN ANWAR',
    settings.activeFirmId || 'firm-anwar-traders',
    settings.supplierName || 'Anwar Traders',
    settings.supplierTagline || 'Govt. Contractor & General Order Supplier',
    settings.supplierAddress || '',
    settings.supplierPhone || '',
    settings.supplierNTN || '',
    settings.supplierGST || '',
    settings.vendorNo || '',
    Number(settings.gstRate || 0.18),
    Number(settings.pstRate || 0.16),
    Number(settings.letterheadTop || 2.5),
    Number(settings.letterheadBottom || 1.5),
    String(settings.nextBillNo || '101'),
    String(settings.nextQuoteNo || 'Q-201'),
    JSON.stringify(settings.firms || [])
  ];

  settingsSheet.appendRow(headers);
  settingsSheet.appendRow(row);
  return { ok: true };
}

// -------------------------------------------------------------------------
// DATA LOADERS & SEQUENCE ROLLBACK
// -------------------------------------------------------------------------

function loadSettings(ss) {
  var sheet = ss.getSheetByName('Settings');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var row = data[1];
  var firms = [];
  try {
    firms = JSON.parse(row[15] || '[]');
  } catch (e) {
    firms = [];
  }

  return {
    ownerName: row[0] || 'MIAN FARHAN ANWAR',
    activeFirmId: row[1] || 'firm-anwar-traders',
    supplierName: row[2] || 'Anwar Traders',
    supplierTagline: row[3] || 'Govt. Contractor & General Order Supplier',
    supplierAddress: row[4] || '',
    supplierPhone: row[5] || '',
    supplierNTN: row[6] || '',
    supplierGST: row[7] || '',
    vendorNo: row[8] || '',
    gstRate: Number(row[9] || 0.18),
    pstRate: Number(row[10] || 0.16),
    letterheadTop: Number(row[11] || 2.5),
    letterheadBottom: Number(row[12] || 1.5),
    nextBillNo: String(row[13] || '101'),
    nextQuoteNo: String(row[14] || 'Q-201'),
    firms: firms
  };
}

function loadClients(ss) {
  var sheet = ss.getSheetByName('Clients');
  var data = sheet.getDataRange().getValues();
  var clients = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r) continue;
    var col0 = String(r[0] || '').trim();
    var col1 = String(r[1] || '').trim();
    if (!col0 && !col1) continue;

    var clientId = '';
    var clientName = '';
    var address = '';
    var ntn = '';
    var strn = '';
    var lastUsed = '';

    if (col0.toLowerCase().startsWith('client-')) {
      clientId = col0;
      clientName = col1;
      address = String(r[2] || '').trim();
      ntn = String(r[3] || '').trim();
      strn = String(r[4] || '').trim();
      lastUsed = String(r[5] || '').trim();
    } else {
      // Formats where Col A is institution/client name and Col B is city/station
      clientName = col0 || col1;
      address = col0 ? col1 : String(r[2] || '').trim();
      ntn = String(r[2] || r[3] || '').trim();
      strn = String(r[3] || r[4] || '').trim();
      lastUsed = String(r[4] || r[5] || '').trim();
      clientId = 'client-' + clientName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    }

    if (clientName) {
      clients.push({
        id: clientId,
        name: clientName,
        address: address,
        ntn: ntn,
        strn: strn,
        lastUsed: lastUsed
      });
    }
  }
  return clients;
}

function loadDocuments(ss) {
  var docsSheet = ss.getSheetByName('Documents');
  var itemsSheet = ss.getSheetByName('Items');

  var docsData = docsSheet.getDataRange().getValues();
  var itemsData = itemsSheet.getDataRange().getValues();

  // Group line items by docId
  var itemsMap = {};
  for (var j = 1; j < itemsData.length; j++) {
    var itRow = itemsData[j];
    var docId = String(itRow[0] || '').trim();
    if (!docId) continue;
    if (!itemsMap[docId]) itemsMap[docId] = [];

    itemsMap[docId].push({
      sr: Number(itRow[1] || 1),
      description: String(itRow[2] || ''),
      unit: String(itRow[3] || 'Nos'),
      qty: Number(itRow[4] || 1),
      rate: Number(itRow[5] || 0),
      tax: String(itRow[6] || 'GST'),
      taxRate: Number(itRow[7] || 0.18),
      amount: Number(itRow[8] || 0)
    });
  }

  var docs = [];
  for (var i = 1; i < docsData.length; i++) {
    var r = docsData[i];
    var dId = String(r[0] || '').trim();
    if (!dId) continue;

    docs.push({
      docId: dId,
      docNo: String(r[1] || ''),
      type: String(r[2] || 'BILL'),
      firmId: String(r[3] || ''),
      firmName: String(r[4] || ''),
      date: String(r[5] || ''),
      clientName: String(r[6] || ''),
      clientAddress: String(r[7] || ''),
      clientNTN: String(r[8] || ''),
      clientSTRN: String(r[9] || ''),
      refText: String(r[10] || ''),
      goodsSub: Number(r[11] || 0),
      gst: Number(r[12] || 0),
      gstRate: Number(r[13] || 0.18),
      serviceSub: Number(r[14] || 0),
      pst: Number(r[15] || 0),
      otherSub: Number(r[16] || 0),
      grandTotal: Number(r[17] || 0),
      status: String(r[18] || 'Active'),
      updatedAt: String(r[19] || ''),
      items: itemsMap[dId] || []
    });
  }
  return docs;
}

/**
 * Numeric part of a document number string ('Q-201' -> 201, '102' -> 102).
 */
function numPart(s) {
  var n = parseInt(String(s == null ? '' : s).replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Highest numeric document number currently stored for a firm + type.
 * Used to keep numbering unique even when the history contains duplicates
 * (e.g. written by an older client) or deletions.
 */
function getMaxDocNo(ss, firmId, docType) {
  var sheet = ss.getSheetByName('Documents');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 19).getValues();
  var wantType = String(docType || 'BILL').toUpperCase();
  var wantFirm = String(firmId || '').trim();
  var max = 0;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][18] || 'Active').toUpperCase() === 'DRAFT') continue; // drafts hold no number
    var rType = String(data[i][2] || 'BILL').toUpperCase();
    if (rType !== wantType) continue;
    var rFirm = String(data[i][3] || '').trim();
    if (wantFirm && rFirm && rFirm !== wantFirm) continue;
    var n = numPart(data[i][1]);
    if (n > max) max = n;
  }
  return max;
}

function updateSequenceCounter(ss, firmId, docType, docNo, isRollback) {
  var settings = loadSettings(ss);
  if (!settings) return;

  var currentFirms = settings.firms || [];
  var targetFirm = null;
  for (var i = 0; i < currentFirms.length; i++) {
    if (currentFirms[i].id === firmId) {
      targetFirm = currentFirms[i];
      break;
    }
  }

  var isBill = String(docType).toUpperCase() === 'BILL';
  // Highest stored counter (top-level and firm-level should agree; trust the higher).
  var storedNo = isBill ? String(settings.nextBillNo || '101') : String(settings.nextQuoteNo || 'Q-201');
  if (targetFirm) {
    var firmNo = isBill ? String(targetFirm.nextBillNo || '') : String(targetFirm.nextQuoteNo || '');
    if (numPart(firmNo) > numPart(storedNo)) storedNo = firmNo;
  }
  var prefix = storedNo.replace(/[0-9]/g, '');
  if (!prefix && !isBill) prefix = 'Q-';

  // Uniqueness rule: the next number is always one past the highest of the
  // stored counter, the saved number, and every number still in the register.
  // A delete therefore rolls back to (highest REMAINING + 1), reusing the
  // deleted number only when it leaves no duplicate behind.
  var maxExisting = getMaxDocNo(ss, firmId, docType);
  var nextNum;
  if (isRollback) {
    nextNum = maxExisting > 0 ? maxExisting + 1 : numPart(docNo);
    if (!nextNum) nextNum = isBill ? 101 : 201;
  } else {
    nextNum = Math.max(numPart(storedNo), maxExisting, numPart(docNo)) + 1;
  }
  var nextNoToSet = prefix + nextNum;

  if (targetFirm) {
    if (docType === 'BILL') {
      targetFirm.nextBillNo = nextNoToSet;
    } else {
      targetFirm.nextQuoteNo = nextNoToSet;
    }
  }

  if (!settings.activeFirmId || settings.activeFirmId === firmId || currentFirms.length === 0) {
    if (docType === 'BILL') {
      settings.nextBillNo = nextNoToSet;
    } else {
      settings.nextQuoteNo = nextNoToSet;
    }
  }

  settings.firms = currentFirms;
  handleSaveSettings(ss, settings);
  return settings;
}

// -------------------------------------------------------------------------
// INITIAL SCHEMA & SHEET SETUP (Run Once or via Web App)
// -------------------------------------------------------------------------

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRequiredSheets(ss);
  SpreadsheetApp.getUi().alert('Sheets setup completed successfully with all 4 required tabs: Settings, Clients, Documents, Items.');
}

function ensureRequiredSheets(ss) {
  var required = ['Settings', 'Clients', 'Documents', 'Items'];
  for (var i = 0; i < required.length; i++) {
    var name = required[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    if (sheet.getLastRow() === 0) {
      initSheetHeaders(sheet, name);
    }
  }
}

function initSheetHeaders(sheet, name) {
  sheet.setTabColor(name === 'Documents' ? '#1D4ED8' : name === 'Clients' ? '#059669' : '#D97706');
  var headers = [];

  if (name === 'Settings') {
    headers = [
      'OwnerName', 'ActiveFirmId', 'SupplierName', 'SupplierTagline', 'SupplierAddress',
      'SupplierPhone', 'SupplierNTN', 'SupplierGST', 'VendorNo', 'GSTRate', 'PSTRate',
      'LetterheadTop', 'LetterheadBottom', 'NextBillNo', 'NextQuoteNo', 'FirmsJSON'
    ];
    sheet.appendRow(headers);
    var defaultFirms = [
      {
        id: 'firm-anwar-traders',
        name: 'Anwar Traders',
        tagline: 'Govt. Contractor & General Order Supplier',
        address: 'Mohalla Punj Peer, Khawaja Street, Jhang Road, Faisalabad.',
        phone: '0300-6642775',
        ntn: '4821279-6',
        gst: '3277876217254',
        vendorNo: '31086205',
        gstRate: 0.18,
        pstRate: 0.16,
        letterheadTop: 2.5,
        letterheadBottom: 1.5,
        nextBillNo: '101',
        nextQuoteNo: 'Q-201',
        styleTheme: 'CLASSIC_GOVT'
      },
      {
        id: 'firm-hashir-traders',
        name: 'Hashir Traders',
        tagline: 'Govt. Contractor & General Order Supplier',
        address: 'Kabaar Market, Jhang Road, Faisalabad',
        phone: '0345-7759459',
        ntn: '8637356-3',
        gst: '3277876326317',
        vendorNo: '31241288',
        gstRate: 0.18,
        pstRate: 0.16,
        letterheadTop: 2.5,
        letterheadBottom: 1.5,
        nextBillNo: '201',
        nextQuoteNo: 'HQ-101',
        styleTheme: 'MODERN_CORPORATE'
      }
    ];
    sheet.appendRow([
      'MIAN FARHAN ANWAR', 'firm-anwar-traders', 'Anwar Traders',
      'Govt. Contractor & General Order Supplier',
      'Mohalla Punj Peer, Khawaja Street, Jhang Road, Faisalabad.',
      '0300-6642775', '4821279-6', '3277876217254',
      '31086205', 0.18, 0.16, 2.5, 1.5, '101', 'Q-201',
      JSON.stringify(defaultFirms)
    ]);
  } else if (name === 'Clients') {
    headers = ['ClientID', 'ClientName', 'Address', 'NTN', 'STRN', 'LastUsed'];
    sheet.appendRow(headers);
    sheet.appendRow([
      'client-dg-health',
      'Director General Health Services Punjab',
      '24-Cooper Road, Lahore',
      '9010203-4',
      '3277876217254',
      new Date().toISOString()
    ]);
  } else if (name === 'Documents') {
    headers = [
      'DocID', 'DocNo', 'Type', 'FirmID', 'FirmName', 'Date', 'ClientName',
      'ClientAddress', 'ClientNTN', 'ClientSTRN', 'RefText', 'GoodsSub',
      'GST', 'GSTRate', 'ServiceSub', 'PST', 'OtherSub', 'GrandTotal',
      'Status', 'CreatedAt'
    ];
    sheet.appendRow(headers);
  } else if (name === 'Items') {
    headers = ['DocID', 'Sr', 'Description', 'Unit', 'Qty', 'Rate', 'Tax', 'TaxRate', 'Amount'];
    sheet.appendRow(headers);
  }

  // Format header row
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#F1F5F9');
  sheet.setFrozenRows(1);
}

function createJsonResponse(dataObj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(dataObj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

`;

export const GoogleAppsScriptModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-navy-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/5 border border-gold-500/40 flex items-center justify-center">
              <FileCode className="w-5 h-5 text-gold-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Google Apps Script Backend (Code.gs)
                </h2>
                <span className="corp-chip bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">v2.6.7 · Current</span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                Container-bound Apps Script for Google Sheets · Syncs LIFO Deletion, Clients &amp; Billing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-900 hover:bg-slate-100'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-700" />
                  <span>Copy Complete Script</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Deployment Steps Guide */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 text-xs text-slate-700 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Terminal className="w-4 h-4 text-[#0F2544]" />
            <span>How to Deploy or Update in Your Google Sheet:</span>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 pl-1 text-[11px] leading-relaxed">
            <li>Open your Google Sheet &gt; Click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
            <li>Replace all existing code in <strong>Code.gs</strong> with the code below &gt; Click <strong>Save (Disk Icon)</strong>.</li>
            <li>(First-time only): In Apps Script toolbar, select function <code>setupSheets</code> &gt; Click <strong>Run</strong> to auto-create tabs.</li>
            <li>Click <strong>Deploy</strong> &gt; <strong>New deployment</strong> &gt; Select type: <strong>Web app</strong>.</li>
            <li>Set <em>Execute as:</em> <strong>Me</strong> &amp; <em>Who has access:</em> <strong>Anyone</strong> (crucial so Vercel can reach it) &gt; Click <strong>Deploy</strong>.</li>
            <li>Copy the <strong>Web app URL</strong> into Vercel Project Settings as <strong>two</strong> environment variables: <code>GAS_URL</code> (for the server) and <code>VITE_GAS_URL</code> (for the app itself) — then <strong>Redeploy</strong>. This connects the sheet on every browser and device with zero manual setup.</li>
          </ol>
        </div>

        {/* Code Content Viewer */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#0B132B] text-slate-200 font-mono text-xs leading-relaxed select-text">
          <pre className="whitespace-pre">{GOOGLE_APPS_SCRIPT_CODE}</pre>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 text-[11px]">
            Includes <code>deleteDoc</code> (LIFO sequence rollback), <code>saveClient</code>, <code>deleteClient</code>, and multi-firm support.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
