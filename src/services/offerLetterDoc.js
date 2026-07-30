// Builds the actual offer-letter .docx.
//
// The AI writes ONLY the welcome paragraph (generate-offer-letter Edge Function).
// Every number in this document comes from computeCtcBreakup() — salary is never
// AI-generated, which is the rule the Offer Letters panel states on screen.

// docx is ~330 kB — loaded on demand (Questionnaire.jsx imports it the same way)
// so it never lands in the main bundle.

const INR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const longDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

function makeHelpers(d) {
  const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = d;
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const cell = (text, { bold = false, align = AlignmentType.LEFT, width = 50 } = {}) =>
    new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold, size: 20 })] })],
    });

  const row = (label, value, bold = false) =>
    new TableRow({ children: [cell(label, { bold }), cell(value, { bold, align: AlignmentType.RIGHT })] });

  const noBorders = {
    top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E8E2D9" }, insideVertical: NO_BORDER,
  };
  return { cell, row, noBorders };
}

/**
 * @param {object} o    offer row (ctc_gross_annual, ctc_breakup, joining_date, probation_months)
 * @param {object} meta { candidateName, roleTitle, welcomeParagraph, reportingManager, joiningLocation }
 * @returns {Promise<Blob>}
 */
export async function buildOfferLetterDocx(o, meta) {
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, WidthType } = d;
  const { cell, row, noBorders } = makeHelpers(d);
  const b = o.ctc_breakup || {};
  const monthly = (n) => INR((Number(n) || 0) / 12);

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HAGERSTONE", bold: true, size: 40 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
          children: [new TextRun({ text: "Interior Design & Construction", size: 18, color: "666666" })] }),

        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Date: ${longDate(new Date())}`, size: 20 })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { after: 200 },
          children: [new TextRun({ text: "Letter of Offer", bold: true })] }),

        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Dear ${meta.candidateName},`, bold: true })] }),

        new Paragraph({ spacing: { after: 240 }, alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: meta.welcomeParagraph || "" })] }),

        new Paragraph({ spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: "Position Details", bold: true, size: 24 })] }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            row("Designation", meta.roleTitle || "—"),
            row("Joining date", longDate(o.joining_date)),
            row("Location", meta.joiningLocation || "As advised"),
            row("Reporting to", meta.reportingManager || "As advised"),
            row("Probation", `${o.probation_months ?? 6} months`),
          ],
        }),

        new Paragraph({ spacing: { before: 300, after: 120 },
          children: [new TextRun({ text: "Compensation", bold: true, size: 24 })] }),
        new Paragraph({ spacing: { after: 120 },
          children: [new TextRun({ text: `Gross annual CTC: ${INR(o.ctc_gross_annual)}`, bold: true })] }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            new TableRow({ children: [cell("Component", { bold: true }), cell("Per annum", { bold: true, align: AlignmentType.RIGHT })] }),
            row("Basic (40%)", INR(b.basic)),
            row("HRA (20%)", INR(b.hra)),
            row("Special allowance (30%)", INR(b.special_allowance)),
            row("Provident Fund — employee (12% of basic)", INR(b.pf_employee)),
            row("Provident Fund — employer (12% of basic)", INR(b.pf_employer)),
            row("Gratuity", INR(b.gratuity)),
            row("Indicative take-home (per month)", INR(b.take_home_monthly), true),
          ],
        }),

        new Paragraph({ spacing: { before: 160, after: 300 },
          children: [new TextRun({ text: `Monthly gross: ${monthly(o.ctc_gross_annual)}. Take-home is indicative and will vary with income tax, statutory deductions and declarations.`, size: 18, color: "666666", italics: true })] }),

        new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: "This offer is subject to satisfactory verification of the documents and references you provide. Please sign and return a copy of this letter to confirm your acceptance." })] }),

        new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: "For Hagerstone", bold: true })] }),
        new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: "_______________________" })] }),
        new Paragraph({ children: [new TextRun({ text: "Authorised Signatory", size: 18, color: "666666" })] }),

        new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Accepted by the candidate", bold: true })] }),
        new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "_______________________        Date: ______________" })] }),
        new Paragraph({ children: [new TextRun({ text: meta.candidateName || "", size: 18, color: "666666" })] }),
      ],
    }],
  });

  return Packer.toBlob(doc);
}
