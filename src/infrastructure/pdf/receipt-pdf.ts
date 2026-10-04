import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { DecodedLogo } from "@/core/domain/school/logo";

export interface ReceiptPdfData {
  schoolName: string;
  logo?: DecodedLogo | null;
  studentName: string;
  label: string;
  amount: string;
  method: string;
  paidAt: Date;
  reference: string;
  hash: string;
  verifyUrl: string;
}

/** Standard PDF fonts only cover WinAnsi; replace anything else. */
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

export async function buildReceiptPdf(d: ReceiptPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.13, 0.18);
  const muted = rgb(0.4, 0.4, 0.46);

  page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: rgb(0.89, 0.86, 0.99) });
  page.drawText("RECU DE PAIEMENT", { x: 48, y: 785, size: 24, font: bold, color: ink });
  page.drawText(safe(d.schoolName), { x: 48, y: 760, size: 12, font, color: muted });
  if (d.logo) {
    const image = d.logo.mime === "image/png" ? await pdf.embedPng(d.logo.bytes) : await pdf.embedJpg(d.logo.bytes);
    const scaled = image.scaleToFit(64, 64);
    page.drawImage(image, { x: 595 - 48 - scaled.width, y: 792 - scaled.height / 2, width: scaled.width, height: scaled.height });
  }

  const rows: [string, string][] = [
    ["Eleve", d.studentName],
    ["Objet", d.label],
    ["Montant regle", d.amount],
    ["Mode de reglement", d.method],
    ["Date de paiement", d.paidAt.toLocaleDateString("fr-FR")],
    ["Reference", d.reference],
  ];
  let y = 690;
  for (const [k, v] of rows) {
    page.drawText(k, { x: 48, y, size: 10, font, color: muted });
    page.drawText(safe(v), { x: 48, y: y - 18, size: 14, font: bold, color: ink });
    y -= 52;
  }

  const qr = await pdf.embedPng(await QRCode.toBuffer(d.verifyUrl, { margin: 1, width: 240 }));
  page.drawImage(qr, { x: 48, y: 200, width: 120, height: 120 });
  page.drawText("Scannez pour verifier l'authenticite", { x: 180, y: 290, size: 11, font: bold, color: ink });
  page.drawText("Empreinte SHA-256 :", { x: 180, y: 262, size: 9, font, color: muted });
  page.drawText(d.hash.slice(0, 32), { x: 180, y: 248, size: 9, font, color: ink });
  page.drawText(d.hash.slice(32), { x: 180, y: 236, size: 9, font, color: ink });

  return pdf.save();
}
