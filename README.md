# Anwar Traders — Supplier Billing & GST Invoice App

A mobile-friendly billing, GST Sales Tax invoicing, and quotation web app designed for **Anwar Traders** (Government-Order Supplier in Pakistan). Built with React, TypeScript, Tailwind CSS, and Google Apps Script (`Code.gs`) backend for pre-printed letterhead printing.

---

## Features

- **Simple 4-Screen Workflow**:
  1. **PIN Screen**: Quick touch-friendly PIN lock (default: `1234`), remembered on device.
  2. **Home Screen**: Big tactile buttons for *New Bill*, *New Quotation*, and *Settings*, with a searchable recent documents register.
  3. **Entry Form**: Modelled on handwritten supplier bills. Typeahead client search, catalog auto-fill, goods vs services tax separation (GST 18% & PST 16%), live totals panel.
  4. **Preview & Print**:
     - **Bill**: Section A (Goods @ 18% GST), Section B (Services @ 16% PST), shaded Grand Total row, double underlines, and Pakistani number-to-words.
     - **GST Sales Tax Invoice**: Standard Federal Sales Tax invoice layout with single summarized bill line, empty rows, sales tax payable, and signature stamps.
     - **Quotation**: Quotation number, validity date (+7 days default), standard government terms.
     - **Pre-printed Letterhead Switch**: When **ON**, reserves top and bottom margin zones (default 2.5in and 1.5in) to preserve existing letterhead header and footer; when **OFF**, prints supplier business header block.

---

## 15-Minute Setup Order

### 1. Sheet + Backend (`Code.gs`)
1. Create a new blank Google Sheet.
2. Open **Extensions > Apps Script** and paste `Code.gs`.
3. In Apps Script, set a Script Property named `API_KEY` (e.g. `your-secret-key-123`).
4. Run `setupSheets` (or *Admin > Setup sheets*) to create the 4 tabs:
   - **Settings** (supplier details, tax rates, margins, next numbers)
   - **Clients** (saved buyers, address, NTN)
   - **Documents** (summary records and grand totals)
   - **Items** (individual line items linked by DocID)
5. Click **Deploy > New deployment > Web App**:
   - Execute as: *Me*
   - Who has access: *Anyone*
6. Copy the Web App `/exec` URL (`GAS_URL`).

### 2. Environment Variables (.env)
Set the following environment variables:
```bash
# Security PIN to access the app (e.g. 1234)
APP_PIN="1234"

# Google Apps Script Web App exec URL
GAS_URL="https://script.google.com/macros/s/AKfycbx.../exec"

# Secret key matching the API_KEY script property in Google Sheet
GAS_API_KEY="your-secret-key-123"
```

### 3. Deploying to Vercel
1. Push this repository to GitHub.
2. Import the project in Vercel.
3. In Vercel Project Settings > **Environment Variables**, add:
   - `APP_PIN`
   - `GAS_URL`
   - `GAS_API_KEY`
4. Deploy! Vercel automatically routes `/api/gas` to `api/gas.ts` serverless function.

### 4. Verification Test (Petty-187365)
Enter the sample Anwar Traders PO to verify calculation parity:
- **Reference**: `PO # Petty-187365 dated 06-Oct-2026 - Supply of Official Vehicles parts repair and maintenance`
- **Goods**: Rs. 64,550.00 + 18% GST (Rs. 11,619.00) = Rs. 76,169.00
- **Services**: Rs. 20,344.22 + 16% PST (Rs. 3,255.08) = Rs. 23,599.30
- **Grand Total**: **Rs. 99,768.30** (Exactly matching the Excel target).
- **In Words**: *"Rupees Ninety Nine Thousand Seven Hundred Sixty Eight and Thirty Paisa Only"*.

---
Developed by MKZ
