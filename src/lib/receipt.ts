import PDFDocument from "pdfkit";

export interface ReceiptData {
  receiptNumber: string;
  donatedAt: Date;
  donor: {
    name: string;
    email: string;
    phone?: string;
    pan?: string;
    address?: string;
  };
  amountInr: number;
  paymentId: string;
}

const ABF = {
  legalName: process.env.ORG_LEGAL_NAME || "Active Bengaluru Foundation",
  address: process.env.ORG_ADDRESS || "No 12, 1st Floor, Lazar Road, Fraser Town, Bangalore 560005, Karnataka, India",
  pan: process.env.ORG_PAN || "[ABF PAN]",
  cin: process.env.ORG_CIN || "U85500KA2024NPL184982",
  reg80g: process.env.ORG_80G_NUMBER || "[80G certificate number]",
  reg12a: process.env.ORG_12A_NUMBER || "[12A certificate number]",
  signatoryName: process.env.ORG_SIGNATORY_NAME || "Authorised Signatory",
  signatoryTitle: process.env.ORG_SIGNATORY_TITLE || "Director, Active Bengaluru Foundation",
};

const Y = "#FFD23F";
const R = "#EF4136";
const INK = "#1A1A1A";
const MUTED = "#666666";

export function fmtINR(n: number): string {
  return `₹ ${n.toLocaleString("en-IN")}`;
}

export function inrInWords(n: number): string {
  // Indian numbering system, integer rupees
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function below100(x: number): string {
    if (x < 20) return ones[x];
    return (tens[Math.floor(x/10)] + (x%10 ? " " + ones[x%10] : "")).trim();
  }
  function below1000(x: number): string {
    if (x < 100) return below100(x);
    return (ones[Math.floor(x/100)] + " Hundred" + (x%100 ? " " + below100(x%100) : "")).trim();
  }
  if (n === 0) return "Zero Rupees Only";
  let out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh  = Math.floor(n / 100000);   n %= 100000;
  const thou  = Math.floor(n / 1000);     n %= 1000;
  if (crore) out += below1000(crore) + " Crore ";
  if (lakh)  out += below1000(lakh)  + " Lakh ";
  if (thou)  out += below1000(thou)  + " Thousand ";
  if (n)     out += below1000(n);
  return (out.trim() + " Rupees Only");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;

    // ===== HEADER =====
    doc.rect(0, 0, W, 90).fill(Y);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(ABF.legalName, 50, 28);
    doc.font("Helvetica").fontSize(9).fillColor(INK).text("A people's movement · Section 8 NGO", 50, 58);
    doc.fontSize(8).text(ABF.address, 50, 72, { width: W - 100 });

    // Title bar
    doc.fillColor(R).rect(0, 100, W, 32).fill();
    doc.fillColor("white").font("Helvetica-Bold").fontSize(14)
       .text("DONATION RECEIPT — Eligible for deduction U/S 80G of the Income Tax Act, 1961",
             50, 110, { width: W - 100, align: "center" });

    let cursor = 160;

    // ===== RECEIPT META =====
    const metaRows = [
      ["Receipt No.", data.receiptNumber],
      ["Date", fmtDate(data.donatedAt)],
      ["Payment ID", data.paymentId],
    ];
    doc.fontSize(10).fillColor(INK);
    metaRows.forEach(([k, v]) => {
      doc.font("Helvetica").fillColor(MUTED).text(k, 50, cursor, { width: 110 });
      doc.font("Helvetica-Bold").fillColor(INK).text(v, 160, cursor);
      cursor += 16;
    });

    cursor += 8;
    doc.moveTo(50, cursor).lineTo(W - 50, cursor).strokeColor("#E5E5E5").stroke();
    cursor += 14;

    // ===== DONOR DETAILS =====
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Received with thanks from:", 50, cursor);
    cursor += 18;

    const donorRows: [string, string][] = [
      ["Name", data.donor.name],
      ["Email", data.donor.email],
    ];
    if (data.donor.phone)   donorRows.push(["Phone", data.donor.phone]);
    if (data.donor.pan)     donorRows.push(["PAN", data.donor.pan.toUpperCase()]);
    if (data.donor.address) donorRows.push(["Address", data.donor.address]);

    doc.fontSize(10);
    donorRows.forEach(([k, v]) => {
      doc.font("Helvetica").fillColor(MUTED).text(k, 50, cursor, { width: 110 });
      doc.font("Helvetica-Bold").fillColor(INK).text(v, 160, cursor, { width: W - 200 });
      const h = doc.heightOfString(v, { width: W - 200 });
      cursor += Math.max(16, h + 4);
    });

    cursor += 8;
    doc.moveTo(50, cursor).lineTo(W - 50, cursor).strokeColor("#E5E5E5").stroke();
    cursor += 16;

    // ===== AMOUNT BLOCK =====
    doc.rect(50, cursor, W - 100, 70).fillAndStroke(Y, "#E5C200");
    doc.font("Helvetica").fontSize(10).fillColor(INK).text("Amount donated", 65, cursor + 12);
    doc.font("Helvetica-Bold").fontSize(28).fillColor(INK).text(fmtINR(data.amountInr), 65, cursor + 26);
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(INK)
       .text(`(Rupees in words: ${inrInWords(data.amountInr)})`, 65, cursor + 56, { width: W - 130 });
    cursor += 90;

    // ===== PURPOSE =====
    doc.font("Helvetica").fontSize(10).fillColor(INK)
       .text("Purpose: Voluntary contribution towards the charitable activities of " + ABF.legalName +
             " — including healthcare access, education, drug de-addiction, water relief, " +
             "scheme awareness, and community welfare programmes across Karnataka.",
             50, cursor, { width: W - 100, align: "left" });
    cursor += 50;

    // ===== LEGAL =====
    doc.moveTo(50, cursor).lineTo(W - 50, cursor).strokeColor("#E5E5E5").stroke();
    cursor += 12;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Tax exemption details", 50, cursor);
    cursor += 16;
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    const legal = [
      `PAN of ${ABF.legalName}: ${ABF.pan}`,
      `12A Registration: ${ABF.reg12a}`,
      `80G Registration: ${ABF.reg80g}`,
      `CIN: ${ABF.cin}`,
      "This donation is eligible for deduction under Section 80G of the Income Tax Act, 1961.",
    ];
    legal.forEach((line) => {
      doc.text(line, 50, cursor, { width: W - 100 });
      cursor += 13;
    });

    // ===== SIGNATURE =====
    cursor += 30;
    doc.font("Helvetica").fontSize(10).fillColor(INK)
       .text("For " + ABF.legalName, W - 230, cursor, { width: 180, align: "right" });
    cursor += 40;
    doc.moveTo(W - 230, cursor).lineTo(W - 50, cursor).strokeColor(INK).stroke();
    cursor += 5;
    doc.font("Helvetica-Bold").fontSize(10).text(ABF.signatoryName, W - 230, cursor, { width: 180, align: "right" });
    cursor += 13;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(ABF.signatoryTitle, W - 230, cursor, { width: 180, align: "right" });

    // ===== FOOTER =====
    doc.fontSize(8).fillColor(MUTED)
       .text("This is a system-generated receipt. For queries: activebengaluru@gmail.com · +91 93640 24365 · www.activebengaluru.org",
             50, doc.page.height - 50, { width: W - 100, align: "center" });

    doc.end();
  });
}
