import type { DocumentRecord, DocType } from '../types/billing';

/**
 * Extracts the integer numeric sequence from a document number string.
 * e.g. "105" -> 105, "Q-203" -> 203, "BILL-009" -> 9
 */
export function extractDocNumber(docNoStr: string | undefined | null): number {
  if (!docNoStr) return 0;
  const match = String(docNoStr).match(/\d+/g);
  if (!match) return 0;
  const num = parseInt(match.join(''), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Returns whether a document is the LAST recorded entry (LIFO - Last In, First Out)
 * of its type (BILL or QUOTATION) for its firm.
 * 
 * In accounting and serial numbering, ONLY the single latest recorded entry may be deleted
 * to maintain strict sequence integrity and prevent numbering gaps.
 */
export function isLastDocLIFO(
  doc: DocumentRecord,
  allDocs: DocumentRecord[],
  targetFirmId?: string
): boolean {
  if (!doc || !allDocs || allDocs.length === 0) return false;
  const docType = String(doc.type || doc.Type || 'BILL').toUpperCase() as DocType;

  // Derive authoritative firm ID for this document if targetFirmId is not supplied
  const effectiveFirmId = targetFirmId || doc.firmId || 
    (String(doc.firmName || '').toLowerCase().includes('hashir') ? 'firm-hashir-traders' : 'firm-anwar-traders');

  // Single authoritative source of truth for the LIFO candidate
  const lastCandidate = getLastDocLIFO(allDocs, docType, effectiveFirmId);
  if (!lastCandidate) return false;

  const targetId = String(doc.docId || doc.DocID || '').trim();
  const candidateId = String(lastCandidate.docId || lastCandidate.DocID || '').trim();

  // If IDs match, it's the exact same record
  if (targetId && candidateId && targetId === candidateId) {
    return true;
  }

  // Fallback: match by document number ONLY for legacy records that carry no
  // document ID at all. Bill numbers can repeat across history, so number
  // matching on ID'd records would wrongly badge several documents "latest".
  if (!targetId) {
    const targetNo = String(doc.docNo || doc.DocNo || '').trim();
    const candidateNo = String(lastCandidate.docNo || lastCandidate.DocNo || '').trim();
    if (targetNo && candidateNo && targetNo === candidateNo) {
      const candidateType = String(lastCandidate.type || lastCandidate.Type || 'BILL').toUpperCase();
      if (docType === candidateType) {
        const docFirm = String(doc.firmId || '').trim();
        const candFirm = String(lastCandidate.firmId || '').trim();
        if (!docFirm || !candFirm || docFirm === candFirm) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Retrieves the current last recorded document (LIFO top candidate)
 * for a specific docType (BILL or QUOTATION) and firm.
 * 
 * STRICT UNAMBIGUOUS DEFINITION:
 * 1. Checks matching document type and firm.
 * 2. Selects the single document with the highest serial sequence number for that firm.
 * 3. In case of identical sequence numbers, uses latest creation date, then ID.
 * Exactly ONE document per firm is ever returned. Never falls back to other firms.
 */
export function getLastDocLIFO(
  allDocs: DocumentRecord[],
  docType: DocType,
  targetFirmId?: string
): DocumentRecord | null {
  if (!allDocs || allDocs.length === 0) return null;

  const targetType = String(docType).toUpperCase();
  const firmId = targetFirmId ? String(targetFirmId).trim() : '';

  // Filter documents matching docType (and firm if provided)
  const matching = allDocs.filter((d) => {
    const t = String(d.type || d.Type || 'BILL').toUpperCase();
    if (t !== targetType) return false;
    
    if (firmId) {
      const dFirmId = String(d.firmId || '').trim();
      const dFirmName = String(d.firmName || '').toLowerCase().trim();
      const isHashirTarget = firmId.includes('hashir');
      const isAnwarTarget = firmId.includes('anwar');

      if (dFirmId) {
        if (dFirmId !== firmId) return false;
      } else {
        // Untagged firmId: disambiguate via firmName
        if (isHashirTarget && !dFirmName.includes('hashir')) return false;
        if (isAnwarTarget && dFirmName.includes('hashir')) return false;
      }
    }
    return true;
  });

  if (matching.length === 0) return null;

  // Find the single winner with highest numeric document number
  let best = matching[0];
  let bestNum = extractDocNumber(best.docNo || best.DocNo);

  for (let i = 1; i < matching.length; i++) {
    const candidate = matching[i];
    const candidateNum = extractDocNumber(candidate.docNo || candidate.DocNo);

    if (candidateNum > bestNum) {
      best = candidate;
      bestNum = candidateNum;
    } else if (candidateNum === bestNum && candidateNum > 0) {
      // Tie breaker: compare dates (latest first)
      const dateBest = new Date(best.date || best.Date || 0).getTime();
      const dateCandidate = new Date(candidate.date || candidate.Date || 0).getTime();
      if (!isNaN(dateCandidate) && !isNaN(dateBest) && dateCandidate > dateBest) {
        best = candidate;
      }
    }
  }

  return best;
}

/**
 * Computes what the next document number (nextBillNo or nextQuoteNo) should be
 * after the last entry has been deleted under LIFO.
 * 
 * Ensures continuous sequence rollback without leaving numbering holes.
 */
export function calculateRolledBackNextDocNo(
  remainingDocs: DocumentRecord[],
  docType: DocType,
  firmId?: string,
  currentNextNo: string = ''
): string {
  const matching = remainingDocs.filter((d) => {
    const t = String(d.type || d.Type || 'BILL').toUpperCase();
    if (t !== docType) return false;
    if (firmId && d.firmId && String(d.firmId).trim() !== String(firmId).trim()) return false;
    return true;
  });

  const numbers = matching
    .map((d) => extractDocNumber(d.docNo || d.DocNo))
    .filter((n) => n > 0);

  if (numbers.length === 0) {
    // Reset to sensible initial default
    return docType === 'BILL' ? '101' : 'Q-201';
  }

  const maxRemaining = Math.max(...numbers);
  const nextNum = maxRemaining + 1;

  if (docType === 'BILL') {
    return String(nextNum);
  } else {
    // Retain alphanumeric prefix, e.g. "Q-" from "Q-201"
    const prefix = currentNextNo.replace(/\d/g, '') || 'Q-';
    return `${prefix}${nextNum}`;
  }
}

/**
 * Suggests the document number to USE for a new bill/quote of a firm + type.
 * Guaranteed unique: max(the firm's running counter, highest existing number + 1).
 *
 * The running counter is the next-to-use number, so it is compared against
 * (highest existing + 1) — never blindly incremented. This heals numbering
 * even when history contains duplicates (for example from the old pre-fix
 * client) or when a LIFO delete rolled the stored counter back onto a number
 * that still exists.
 */
export function getSuggestedNextNo(
  allDocs: DocumentRecord[] | undefined | null,
  firmCounterNo: string | undefined | null,
  firmId: string | undefined,
  docType: DocType
): string {
  const type = String(docType).toUpperCase();
  const isBill = type === 'BILL';
  const stored = String(firmCounterNo || '').trim();
  let prefix = stored.replace(/\d/g, '');
  if (!prefix && !isBill) prefix = 'Q-';
  const storedNum = extractDocNumber(stored);
  let maxExisting = 0;
  const wantFirm = String(firmId || '').trim();
  for (const d of allDocs || []) {
    const t = String(d.type || d.Type || 'BILL').toUpperCase();
    if (t !== type) continue;
    const dFirm = String(d.firmId || '').trim();
    if (wantFirm && dFirm && dFirm !== wantFirm) continue;
    const n = extractDocNumber(d.docNo || d.DocNo);
    if (n > maxExisting) maxExisting = n;
  }
  return prefix + Math.max(storedNum, maxExisting + 1);
}
