/**
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
    version: '2.5.0',
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
  var docs = loadDocuments(ss);
  return {
    settings: settings,
    clients: clients,
    docs: docs
  };
}

function handleSaveDoc(ss, payload) {
  var docData = payload.docData || payload;
  var docId = docData.docId || docData.DocID || ('doc-' + Date.now());
  var docNo = String(docData.docNo || docData.DocNo || '101').trim();
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

  // Auto-advance sequence counter in Settings
  updateSequenceCounter(ss, firmId, docType, docNo, false);

  return { ok: true, docId: docId, docNo: docNo };
}

/**
 * Permanently deletes a document from Google Sheets (LIFO Protocol)
 * Removes row from Documents, removes items from Items, and rolls back sequence number.
 */
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
    settings.supplierTagline || 'General Order Suppliers & Govt Contractors',
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
    supplierTagline: row[3] || 'General Order Suppliers & Govt Contractors',
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
    if (r[1]) {
      clients.push({
        id: String(r[0] || ('client-' + i)),
        name: String(r[1]),
        address: String(r[2] || ''),
        ntn: String(r[3] || ''),
        strn: String(r[4] || ''),
        lastUsed: String(r[5] || '')
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
      items: itemsMap[dId] || []
    });
  }
  return docs;
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

  var nextNoToSet = docNo;
  if (!isRollback) {
    // Advance next number
    var numericPart = parseInt(docNo.replace(/\D/g, ''), 10);
    if (!isNaN(numericPart)) {
      var prefix = docNo.replace(/[0-9]/g, '');
      nextNoToSet = prefix + (numericPart + 1);
    }
  }

  if (targetFirm) {
    if (docType === 'BILL') {
      targetFirm.nextBillNo = nextNoToSet;
    } else {
      targetFirm.nextQuoteNo = nextNoToSet;
    }
  }

  if (settings.activeFirmId === firmId || currentFirms.length === 0) {
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
        tagline: 'General Order Suppliers & Govt Contractors',
        address: 'Suit # 14, 2nd Floor, Al-Rehman Centre, Bank Road, Rawalpindi',
        phone: '0300-5123456 / 051-5551234',
        ntn: '1428392-7',
        gst: '07-01-9876-543-21',
        vendorNo: 'V-40892',
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
        tagline: 'Govt Order Suppliers & Mechanical/Civil Contractors',
        address: 'Office # 08, Commercial Complex, Rawalpindi',
        phone: '0300-9876543 / 051-5558899',
        ntn: '2948172-5',
        gst: '07-02-4567-890-12',
        vendorNo: 'V-51290',
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
      'General Order Suppliers & Govt Contractors',
      'Suit # 14, 2nd Floor, Al-Rehman Centre, Bank Road, Rawalpindi',
      '0300-5123456 / 051-5551234', '1428392-7', '07-01-9876-543-21',
      'V-40892', 0.18, 0.16, 2.5, 1.5, '101', 'Q-201',
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
      '07-01-9876-543-21',
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
