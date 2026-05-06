/**
 * ============================================================
 *  Google Apps Script — Products JSON API
 *  Paste this in: Extensions → Apps Script → Code.gs
 *
 *  Sheet name must be: "Products"
 *  Deploy as: Web App | Execute as: Me | Access: Anyone
 * ============================================================
 *
 *  Column layout (Row 1 = headers, Row 2+ = products):
 *
 *  A: id          B: title        C: price        D: priceOld
 *  E: currency    F: category     G: stock        H: code
 *  I: whatsapp    J: pays         K: bundle       L: offres
 *  M: countdown   N: animated     O: isLandingPage P: modeBlack
 *  Q: showQuantity R: couleur     S: taille       T: remisePopup
 *  U: reviews     V: featuredImage W: gallery      X: description
 *
 *  offres format  (pipe-separated offers):
 *    1,19900,29900,1 Exemplaire (Offre Découverte)|2,34900,59800,2 Exemplaires (Offre Duo)
 *
 *  gallery format (pipe-separated URLs):
 *    https://img1.jpg|https://img2.jpg|https://img3.jpg
 * ============================================================
 */

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Sheet "Products" not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = rows[0].map(h => String(h).trim());

  const products = rows.slice(1)
    .filter(row => row[0]) // skip empty rows (no id)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });

      // ── Numeric fields ──────────────────────────────────────
      obj.price    = Number(obj.price)    || 0;
      obj.priceOld = Number(obj.priceOld) || null;

      // ── String fields ───────────────────────────────────────
      obj.stock    = String(obj.stock    || '25');
      obj.reviews  = String(obj.reviews  || '0');
      obj.id       = String(obj.id).trim();

      // ── Boolean-like string fields ──────────────────────────
      // (keep as strings: "yes" / "no" / "NO" — matches frontend expectations)

      // ── Gallery: pipe-separated URLs → array ────────────────
      obj.gallery = obj.gallery
        ? String(obj.gallery).split('|').map(u => u.trim()).filter(Boolean)
        : [];

      // ── Offres: pipe-separated entries → array of objects ───
      // Format per entry: qty,price,oldPrice,title
      obj.offres = obj.offres
        ? String(obj.offres).split('|').map(entry => {
            const parts = entry.split(',');
            return {
              qty:      parseInt(parts[0])             || 1,
              price:    parseInt(parts[1])             || 0,
              oldPrice: parseInt(parts[2])             || 0,
              title:    parts.slice(3).join(',').trim()
            };
          }).filter(o => o.title)
        : [];

      return obj;
    });

  // Add CORS header so GitHub Pages can fetch it
  const output = ContentService
    .createTextOutput(JSON.stringify(products))
    .setMimeType(ContentService.MimeType.JSON);

  return output;
}
