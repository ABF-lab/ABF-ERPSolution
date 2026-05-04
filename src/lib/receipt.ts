import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

export type DonorCategory = "general" | "zakat" | "sadqa" | "interest";
export type FrequencyLabel = "monthly" | "quarterly" | "yearly";

const CATEGORY_LABEL: Record<DonorCategory, string> = {
  general: "General",
  zakat: "Zakat",
  sadqa: "Sadqa",
  interest: "Interest Money",
};

const FREQUENCY_LABEL: Record<FrequencyLabel, string> = {
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

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
  donorCategory?: DonorCategory;
  frequencyLabel?: FrequencyLabel;
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
const RULE = "#E5E5E5";

const LOGO_PATH = path.join(process.cwd(), "public", "images", "logo.png");
const LOGO_BUFFER: Buffer | null = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

const STAMP_PATH = path.join(process.cwd(), "public", "images", "signature-stamp.png");
const STAMP_BUFFER: Buffer | null = fs.existsSync(STAMP_PATH) ? fs.readFileSync(STAMP_PATH) : null;

export function fmtINR(n: number): string {
  return `₹ ${n.toLocaleString("en-IN")}`;
}

export function inrInWords(n: number): string {
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
    // bufferPages:false + autoFirstPage so we control layout strictly on one page.
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      autoFirstPage: true,
      bufferPages: false,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;   // 595
    const H = doc.page.height;  // 842
    const PAD = 40;
    const CONTENT_W = W - PAD * 2;

    // ===== HEADER (yellow band, h=88) =====
    doc.rect(0, 0, W, 88).fill(Y);
    if (LOGO_BUFFER) {
      // Logo aspect 1350:485 ≈ 2.78. At height 56 → width ~156.
      doc.image(LOGO_BUFFER, PAD, 16, { height: 56 });
    } else {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(ABF.legalName, PAD, 30);
    }
    // Right side: tagline + address
    const rightX = PAD + 180;
    const rightW = W - rightX - PAD;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11)
       .text("A People's Movement · Section 8 NPO", rightX, 24, { width: rightW });
    doc.font("Helvetica").fontSize(8.5).fillColor(INK)
       .text(ABF.address, rightX, 42, { width: rightW });

    // ===== TITLE STRIP (red, h=28) =====
    doc.rect(0, 88, W, 28).fill(R);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(11)
       .text("DONATION RECEIPT — Eligible for deduction U/S 80G of the Income Tax Act, 1961",
             PAD, 96, { width: CONTENT_W, align: "center" });

    let cursor = 132;

    // ===== RECEIPT META (3 rows compact) =====
    const meta: [string, string][] = [
      ["Receipt No.", data.receiptNumber],
      ["Date", fmtDate(data.donatedAt)],
      ["Payment ID", data.paymentId],
    ];
    doc.fontSize(10);
    meta.forEach(([k, v]) => {
      doc.font("Helvetica").fillColor(MUTED).text(k, PAD, cursor, { width: 100 });
      doc.font("Helvetica-Bold").fillColor(INK).text(v, PAD + 110, cursor);
      cursor += 15;
    });

    cursor += 6;
    rule(doc, PAD, cursor, W - PAD);
    cursor += 12;

    // ===== DONOR DETAILS (height-aware) =====
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK)
       .text("Received with thanks from:", PAD, cursor);
    cursor += 16;

    const donorRows: [string, string][] = [
      ["Name", data.donor.name],
      ["Email", data.donor.email],
    ];
    if (data.donor.phone)   donorRows.push(["Phone", data.donor.phone]);
    if (data.donor.pan)     donorRows.push(["PAN", data.donor.pan.toUpperCase()]);
    if (data.donor.address) donorRows.push(["Address", data.donor.address]);

    const VAL_X = PAD + 110;
    const VAL_W = W - VAL_X - PAD;
    doc.fontSize(10);
    donorRows.forEach(([k, v]) => {
      doc.font("Helvetica").fillColor(MUTED).text(k, PAD, cursor, { width: 100 });
      doc.font("Helvetica-Bold").fillColor(INK).text(v, VAL_X, cursor, { width: VAL_W });
      const h = doc.heightOfString(v, { width: VAL_W });
      cursor += Math.max(14, h + 3);
    });

    cursor += 6;
    rule(doc, PAD, cursor, W - PAD);
    cursor += 12;

    // ===== AMOUNT BLOCK (yellow card, height-aware for words) =====
    const wordsText = `(Rupees in words: ${inrInWords(data.amountInr)})`;
    const wordsH = doc.font("Helvetica-Oblique").fontSize(9.5)
      .heightOfString(wordsText, { width: CONTENT_W - 30 });
    const amtCardH = 14 + 28 + 6 + wordsH + 12; // top pad + amount + gap + words + bottom pad

    doc.rect(PAD, cursor, CONTENT_W, amtCardH).fillAndStroke(Y, "#E5C200");
    doc.font("Helvetica").fontSize(9.5).fillColor(INK)
       .text("AMOUNT DONATED", PAD + 15, cursor + 10, { characterSpacing: 1.2 });
    doc.font("Helvetica-Bold").fontSize(26).fillColor(INK)
       .text(fmtINR(data.amountInr), PAD + 15, cursor + 24);
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(INK)
       .text(wordsText, PAD + 15, cursor + 24 + 28 + 4, { width: CONTENT_W - 30 });
    cursor += amtCardH + 12;

    // ===== PURPOSE (height-aware) =====
    const purpose = "Purpose: Voluntary contribution towards the charitable activities of " +
      ABF.legalName + " — healthcare access, education, drug de-addiction, water relief, " +
      "scheme awareness, and community welfare programmes across Karnataka.";
    doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    const purposeH = doc.heightOfString(purpose, { width: CONTENT_W });
    doc.text(purpose, PAD, cursor, { width: CONTENT_W });
    cursor += purposeH + 6;

    // Category line — only render when the donor explicitly chose a non-general category.
    const cat = data.donorCategory || "general";
    if (cat !== "general") {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK)
         .text(`Category: ${CATEGORY_LABEL[cat]}`, PAD, cursor, { width: CONTENT_W });
      cursor += 14;
    } else {
      cursor += 4;
    }

    // Recurring marker — only present when this charge belongs to a subscription.
    if (data.frequencyLabel) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED)
         .text(`Recurring donation · charged ${FREQUENCY_LABEL[data.frequencyLabel]}`,
               PAD, cursor, { width: CONTENT_W });
      cursor += 12;
    }

    rule(doc, PAD, cursor, W - PAD);
    cursor += 10;

    // ===== TAX EXEMPTION =====
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
       .text("Tax exemption details", PAD, cursor);
    cursor += 14;
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    const legal = [
      `PAN of ${ABF.legalName}: ${ABF.pan}`,
      `12A Registration: ${ABF.reg12a}`,
      `80G Registration: ${ABF.reg80g}`,
      `CIN: ${ABF.cin}`,
      "This donation is eligible for deduction under Section 80G of the Income Tax Act, 1961.",
    ];
    legal.forEach((line) => {
      const lh = doc.heightOfString(line, { width: CONTENT_W });
      doc.text(line, PAD, cursor, { width: CONTENT_W });
      cursor += Math.max(12, lh + 1);
    });

    // ===== SIGNATURE (bottom-right, fixed Y so it doesn't drift) =====
    // Reserve a fixed sig zone so layout stays stable even if content above varies.
    // Pushed higher so the title doesn't collide with the footer rule (footer at H-32, rule at H-42).
    const sigBaseY = Math.max(cursor + 24, H - 180);
    const sigW = 200;
    const sigX = W - PAD - sigW;
    doc.font("Helvetica").fontSize(9.5).fillColor(INK)
       .text(`For ${ABF.legalName}`, sigX, sigBaseY, { width: sigW, align: "right" });

    // Embed the authorised-signatory stamp image if available; otherwise fall back to a plain underline.
    if (STAMP_BUFFER) {
      // Stamp at h=64 (slightly smaller) so it tucks neatly between "For ABF" and the underline.
      const stampH = 64;
      const stampW = 64;
      doc.image(STAMP_BUFFER, sigX + sigW - stampW, sigBaseY + 12, { fit: [stampW, stampH] });
    }

    const lineY = sigBaseY + 84;
    doc.moveTo(sigX, lineY).lineTo(sigX + sigW, lineY).strokeColor(INK).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
       .text(ABF.signatoryName, sigX, lineY + 4, { width: sigW, align: "right" });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
       .text(ABF.signatoryTitle, sigX, lineY + 18, { width: sigW, align: "right" });

    // ===== FOOTER (pinned absolute bottom, single line) =====
    const footY = H - 32;
    rule(doc, PAD, footY - 10, W - PAD);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
       .text("System-generated receipt · activebengaluru@gmail.com · +91 93640 24365 · www.activebengaluru.org",
             PAD, footY, { width: CONTENT_W, align: "center", lineBreak: false });

    // Hard guard: if we drifted past the footer rule, that's a bug.
    if (cursor > footY - 140) {
      console.warn(`[receipt] content cursor=${cursor} is encroaching on signature/footer zone (footY=${footY}). Layout may overlap.`);
    }

    doc.end();
  });
}

function rule(doc: PDFKit.PDFDocument, x1: number, y: number, x2: number) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(RULE).lineWidth(0.5).stroke();
}
