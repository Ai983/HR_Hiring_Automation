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

export function parseResumeInfo(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : "";

  const phoneMatch = text.match(/(?:\+91[\s\-]?|91[\s\-]?)?[6-9]\d{9}/);
  let phone = phoneMatch ? phoneMatch[0].replace(/[\s\-]/g, "") : "";
  if (phone && !phone.startsWith("+")) {
    if (phone.startsWith("91") && phone.length === 12) phone = "+" + phone;
    else if (phone.length === 10) phone = "+91" + phone;
  }

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
