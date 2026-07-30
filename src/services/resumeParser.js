export async function extractResumeText(file) {
  const type = file.type || "";
  if (type.includes("pdf") || file.name?.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
    const arr = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arr).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text.trim();
  }
  if (type.includes("wordprocessingml") || type.includes("msword") || file.name?.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const arr = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: arr });
    return (value || "").trim();
  }
  return "";
}

// Indian resumes write mobiles every which way: "+91 98765 43210",
// "98765-43210", "(+91) 9876543210", "0 9876543210". Matching 10 CONSECUTIVE
// digits missed most of them and left the phone blank, so HR had no number to
// call. Instead: collect anything phone-shaped, then validate on digits alone.
function extractPhone(text) {
  const candidates = text.match(/\+?\d[\d\s.\-()]{7,}\d/g) || [];
  for (const raw of candidates) {
    let d = raw.replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("091")) d = d.slice(3);   // 0091…
    if (d.length === 12 && d.startsWith("91"))  d = d.slice(2);   // 91…
    if (d.length === 11 && d.startsWith("0"))   d = d.slice(1);   // 0…
    if (d.length === 10 && /^[6-9]/.test(d)) return "+91" + d;    // valid mobile
  }
  return "";
}

export function parseResumeInfo(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : "";

  const phone = extractPhone(text);

  const skipRe = /@|^\+?[\d\s\-]{8,}|https?:\/\/|linkedin\.com|github\.com/i;
  const headerRe = /^(RESUME|CV|CURRICULUM VITAE|PROFILE|OBJECTIVE|SUMMARY|EDUCATION|EXPERIENCE|SKILLS|CONTACT|PERSONAL|DETAILS)$/i;

  let name = "";
  for (const line of lines.slice(0, 10)) {
    if (line.length < 3 || line.length > 60) continue;
    if (skipRe.test(line) || headerRe.test(line)) continue;
    if (/^[A-Za-z][A-Za-z\s'.]{2,49}$/.test(line) && line.split(/\s+/).length >= 2) {
      name = line.trim();
      break;
    }
  }

  return { name, email, phone };
}
