import PDFDocument from "pdfkit";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface RedlineData {
  contractName: string;
  contractType: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  executiveSummary: string;
  flags: any[];
  missingClauses: any[];
  positives: any[];
}

// ─── Constants & Colors ────────────────────────────────────────────────────
const COLORS = {
  gold: "#B8952A",
  black: "#111111",
  darkGray: "#333333",
  gray: "#666666",
  lightGray: "#F4F4F5",
  white: "#FFFFFF",
  red: "#EF4444",
  orange: "#F97316",
  amber: "#F59E0B",
  green: "#22C55E",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: COLORS.red,
  HIGH: COLORS.orange,
  MEDIUM: COLORS.amber,
  LOW: COLORS.gray,
};

// ─── Main Generator ────────────────────────────────────────────────────────
export async function generateRedlinePdf(data: RedlineData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Initialize PDF document (A4 size)
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true, // Allows us to add page numbers at the end
    });

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // ─── PAGE 1: EXECUTIVE SUMMARY ───
    renderHeader(doc);
    
    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.black).text("Risk Analysis Report");
    doc.font("Helvetica").fontSize(12).fillColor(COLORS.gray).text(`Contract: ${data.contractName}`);
    doc.text(`Type: ${data.contractType.replace(/_/g, " ")}`);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    
    doc.moveDown(2);

    // FIX 1: Explicitly track the Box Y-coordinate so text doesn't overlap
    const boxY = doc.y;
    doc.rect(50, boxY, 495, 80).fillAndStroke(COLORS.lightGray, COLORS.lightGray);
    
    doc.fillColor(COLORS.black).font("Helvetica-Bold").fontSize(12).text("OVERALL RISK SCORE", 70, boxY + 15);
    
    const scoreColor = SEVERITY_COLORS[data.riskLevel] || COLORS.black;
    doc.fillColor(scoreColor).fontSize(32).text(`${data.riskScore.toFixed(1)}`, 70, boxY + 35);
    doc.fillColor(COLORS.gray).fontSize(12).text("/ 10", 125, boxY + 50); 
    
    doc.fillColor(scoreColor).fontSize(14).text(`${data.riskLevel} RISK`, 380, boxY + 40, { align: "right", width: 100 });
    
    // Manually push the document cursor below our custom box
    doc.x = 50;
    doc.y = boxY + 110;

    // Executive Summary Text
    doc.fillColor(COLORS.black).font("Helvetica-Bold").fontSize(14).text("Executive Summary");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11).fillColor(COLORS.darkGray).text(data.executiveSummary, { lineGap: 4 });

    doc.addPage();

    // ─── PAGES 2+: ISSUES & REDLINES ───
    renderHeader(doc);
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.black).text("Flagged Issues & Redlines");
    doc.moveDown(1);

    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    
    // We also add a fallback `?? 4` just in case a flag comes back with a weird severity
    const sortedFlags = [...data.flags].sort((a, b) => 
      (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    );
    for (const flag of sortedFlags) {
      // FIX 2: Generous page break check so boxes don't get cut in half
      if (doc.y > 550) {
        doc.addPage();
        renderHeader(doc);
        doc.moveDown(1);
      }

      const sevColor = SEVERITY_COLORS[flag.severity] || COLORS.gray;

      // Issue Title & Severity Badge
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.black).text(flag.title, { continued: true });
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.gray).text(`  |  ${flag.clauseRef}`);
      
      doc.rect(50, doc.y + 5, 80, 15).fillAndStroke(sevColor, sevColor);
      doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(8).text(flag.severity, 50, doc.y + 9, { align: "center", width: 80 });
      doc.moveDown(1.5);

      // Issue Description
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.darkGray).text("The Issue:");
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.darkGray).text(flag.issue, { lineGap: 2 });
      doc.moveDown(0.5);

      // Recommendation
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.gold).text("Recommendation:");
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.darkGray).text(flag.recommendation, { lineGap: 2 });
      doc.moveDown(0.5);

      // Suggested Text
      if (flag.suggestedText) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.black).text("Suggested Language:");
        doc.moveDown(0.5);
        
        doc.font("Helvetica").fontSize(10);
        const textHeight = doc.heightOfString(flag.suggestedText, { width: 455, lineGap: 2 });
        
        const suggestionY = doc.y;
        doc.rect(50, suggestionY, 495, textHeight + 20).fillAndStroke(COLORS.lightGray, COLORS.lightGray);
        doc.fillColor(COLORS.darkGray).text(flag.suggestedText, 70, suggestionY + 10, { width: 455, lineGap: 2 });
        
        doc.x = 50;
        doc.y = suggestionY + textHeight + 35;
      } else {
        doc.moveDown(1);
      }

      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor(COLORS.lightGray).stroke();
      doc.moveDown(1);
    }

    // ─── FINAL PAGE: MISSING CLAUSES ───
    if (data.missingClauses && data.missingClauses.length > 0) {
      doc.addPage();
      renderHeader(doc);
      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.black).text("Missing Clauses");
      doc.moveDown(1);

      for (const clause of data.missingClauses) {
        if (doc.y > 650) {
          doc.addPage();
          renderHeader(doc);
        }

        doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.black).text(clause.clauseType);
        doc.font("Helvetica-Oblique").fontSize(10).fillColor(COLORS.red).text(`Importance: ${clause.importance}`);
        doc.moveDown(0.5);
        
        doc.font("Helvetica").fontSize(10).fillColor(COLORS.darkGray).text(clause.whyItMatters, { lineGap: 2 });
        doc.moveDown(1);
      }
    }

    // ─── ADD PAGE NUMBERS ───
    // FIX 3: Temporarily remove the bottom margin so writing at Y=800 doesn't spawn blank pages!
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray);
      doc.text(
        `Page ${i + 1} of ${range.count}`,
        50,
        810,
        { align: "center", width: 495, lineBreak: false }
      );
    }
    
    // Restore margin just in case
    doc.page.margins.bottom = originalBottomMargin;

    // Finalize the PDF
    doc.end();
  });
}

// Helper to draw the header on new pages
function renderHeader(doc: PDFKit.PDFDocument) {
  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.gold).text("CONTRACTIQ", 50, 40, { align: "right" });
  doc.moveTo(50, 60).lineTo(545, 60).lineWidth(1).strokeColor(COLORS.gold).stroke();
  doc.x = 50; 
  doc.y = 80; 
}