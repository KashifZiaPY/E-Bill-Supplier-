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
 * In accounting and serial numbering, ONLY the latest recorded entry may be deleted
 * to maintain strict sequence integrity and prevent numbering gaps.
 */
export function isLastDocLIFO(
  doc: DocumentRecord,
  allDocs: DocumentRecord[],
  targetFirmId?: string
): boolean {
  if (!doc) return false;
  const targetId = String(doc.docId || doc.DocID || '').trim();
  if (!targetId && !doc.docNo && !doc.DocNo) return false;

  const docType = String(doc.type || doc.Type || 'BILL').toUpperCase() as DocType;
  const firmId = targetFirmId || String(doc.firmId || '').trim();

  // Find all documents of the same type (and firm if available)
  const sameTypeDocs = allDocs.filter((d) => {
    const t = String(d.type || d.Type || 'BILL').toUpperCase();
    if (t !== docType) return false;
    if (firmId && d.firmId && String(d.firmId).trim() !== firmId) return false;
    return true;
  });

  if (sameTypeDocs.length === 0) return false;

  // 1. In this system, new entries are inserted at index 0 (via unshift).
  // The first item is therefore the latest created entry in chronological order.
  const topDoc = sameTypeDocs[0];
  const topDocId = String(topDoc.docId || topDoc.DocID || '').trim();
  if (targetId && topDocId && targetId === topDocId) {
    return true;
  }

  // 2. Also check if this document holds the maximum numeric serial sequence.
  const thisNum = extractDocNumber(doc.docNo || doc.DocNo);
  if (thisNum > 0) {
    const maxNum = Math.max(...sameTypeDocs.map((d) => extractDocNumber(d.docNo || d.DocNo)));
    if (thisNum === maxNum) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves the current last recorded document (LIFO top candidate)
 * for a specific docType (BILL or QUOTATION) and firm.
 */
export function getLastDocLIFO(
  allDocs: DocumentRecord[],
  docType: DocType,
  targetFirmId?: string
): DocumentRecord | null {
  const matching = allDocs.filter((d) => {
    const t = String(d.type || d.Type || 'BILL').toUpperCase();
    if (t !== docType) return false;
    if (targetFirmId && d.firmId && String(d.firmId).trim() !== String(targetFirmId).trim()) return false;
    return true;
  });

  if (matching.length === 0) return null;

  // Look for max number or the first item
  let candidate = matching[0];
  let maxNum = extractDocNumber(candidate.docNo || candidate.DocNo);

  for (let i = 1; i < matching.length; i++) {
    const num = extractDocNumber(matching[i].docNo || matching[i].DocNo);
    if (num > maxNum) {
      maxNum = num;
      candidate = matching[i];
    }
  }

  return candidate;
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
