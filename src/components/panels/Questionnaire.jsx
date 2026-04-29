import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { generateQuestionnaire } from "../../services/aiService.js";
import { JOB_ROLES, SOURCE_META, STAGE_META } from "../../constants.js";
import { resolveJobIdForRole } from "../../services/jobService.js";
import CopyButton from "../shared/CopyButton.jsx";

async function extractTextFromFile(file) {
  const type = file.type || "";
  if (type.includes("pdf")) {
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

export default function Questionnaire() {
  const { jobs, setJobs, applicants, showToast } = useApp();

  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedJobId, setSelectedJobId]               = useState("");
  const [interviewType, setInterviewType]               = useState("hr");
  const [customTopics, setCustomTopics]                 = useState("");
  const [jdPaste, setJdPaste]                           = useState("");
  const [jdFile, setJdFile]                             = useState(null);
  const [data, setData]                                 = useState(null);
  const [generating, setGenerating]                     = useState(false);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Screened candidates: has AI score or screening notes, not rejected
  const screenedCandidates = applicants
    .filter((a) => (a.score > 0 || a.screening_notes) && a.stage !== "rejected")
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const selectedCandidate = applicants.find((a) => a.id === selectedCandidateId) || null;

  // When a candidate is selected, pre-fill job + JD
  useEffect(() => {
    if (!selectedCandidateId) return;
    const cand = applicants.find((a) => a.id === selectedCandidateId);
    if (!cand) return;
    if (cand.jobId) {
      setSelectedJobId(cand.jobId);
      const job = jobs.find((j) => j.id === cand.jobId);
      if (job?.jd) setJdPaste(job.jd);
    }
    // Seed custom topics from screening notes
    if (cand.screening_notes) {
      setCustomTopics(`Candidate context: ${cand.screening_notes}`);
    }
  }, [selectedCandidateId]);

  const handleJdFileChange = async (file) => {
    setJdFile(file || null);
    if (!file) return;
    try {
      const text = await extractTextFromFile(file);
      if (text) {
        setJdPaste(text);
        showToast("JD text extracted. You can edit below or generate.");
      } else {
        showToast("Could not read text from file. Paste JD or use a PDF/DOCX with selectable text.", false);
      }
    } catch (_) {
      showToast("Failed to read file. Paste the job description instead.", false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedJobId) return showToast("Select a job first.", false);
    setGenerating(true);
    setData(null);
    try {
      let jobId = selectedJobId;
      if (selectedJobId.startsWith("role:")) {
        const title = selectedJobId.slice(5);
        jobId = await resolveJobIdForRole(jobs, title, jdPaste, setJobs);
        if (!jobId) {
          showToast("Could not create job for this role. Try again.", false);
          setGenerating(false);
          return;
        }
        setSelectedJobId(jobId);
      }

      const jdText = jdPaste.trim() || selectedJob?.jd || "";
      const result = await generateQuestionnaire({
        jobId,
        interviewType,
        customTopics: customTopics.trim() || undefined,
        jdText: jdText || undefined,
      });
      setData(result);
      showToast("Questionnaire generated successfully.");
    } catch (e) {
      showToast(e.message || "Generation failed.", false);
    }
    setGenerating(false);
  };

  const getAllQuestionsText = () => {
    if (!data?.sections) return "";
    const jobTitle = selectedJob?.title || "Job";
    const typeLabel = interviewType === "hr" ? "HR Interview" : "Director / Technical Interview";
    let text = `Interview Questionnaire - ${jobTitle}\nType: ${typeLabel}\n${"=".repeat(50)}\n\n`;
    data.sections.forEach((section) => {
      text += `${section.title}\n${"-".repeat(40)}\n`;
      section.questions.forEach((q, i) => {
        text += `\n${i + 1}. ${q.question}\n`;
        if (q.purpose) text += `   Purpose: ${q.purpose}\n`;
        if (q.expectedAnswer) text += `   Expected: ${q.expectedAnswer}\n`;
      });
      text += "\n";
    });
    return text;
  };

  const handleDownloadDocx = async () => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const jobTitle = selectedJob?.title || "Job";
      const typeLabel = interviewType === "hr" ? "HR Interview" : "Director / Technical Interview";

      const children = [
        new Paragraph({
          text: `Interview Questionnaire - ${jobTitle}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Type: ${typeLabel}`, italics: true, size: 22 }),
            new TextRun({ text: `  |  Generated: ${new Date().toLocaleDateString()}`, italics: true, size: 22 }),
          ],
          spacing: { after: 400 },
        }),
      ];

      (data?.sections || []).forEach((section) => {
        children.push(
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );
        section.questions.forEach((q, i) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `${i + 1}. ${q.question}`, bold: true, size: 24 })],
              spacing: { before: 200, after: 100 },
            })
          );
          if (q.purpose) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "Purpose: ", bold: true, italics: true, size: 20, color: "666666" }),
                  new TextRun({ text: q.purpose, italics: true, size: 20, color: "666666" }),
                ],
                spacing: { after: 50 },
                indent: { left: 400 },
              })
            );
          }
          if (q.expectedAnswer) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "Expected indicators: ", bold: true, size: 20, color: "444444" }),
                  new TextRun({ text: q.expectedAnswer, size: 20, color: "444444" }),
                ],
                spacing: { after: 100 },
                indent: { left: 400 },
              })
            );
          }
        });
      });

      const doc = new Document({
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Questionnaire_${jobTitle.replace(/\s+/g, "_")}_${interviewType}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("DOCX downloaded.");
    } catch (e) {
      showToast("DOCX generation failed: " + e.message, false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-title">Interview Questionnaire</div>
      <div className="page-sub">AI-generated interview questions based on job description for HR and Director/Technical rounds.</div>

      <div className="two-col">
        {/* Left: Generated questionnaire */}
        <div>
          {!data && !generating && (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#8a7e72" }}>
              {screenedCandidates.length > 0 && !selectedCandidateId ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#5a5048", marginBottom: 12 }}>
                    {screenedCandidates.length} screened candidate{screenedCandidates.length > 1 ? "s" : ""} — pick one to pre-fill
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
                    {screenedCandidates.map((a) => {
                      const job = jobs.find((j) => j.id === a.jobId);
                      const src = SOURCE_META[a.portal] || SOURCE_META.manual;
                      return (
                        <div
                          key={a.id}
                          style={{ display: "flex", alignItems: "center", gap: 10, background: "#faf8f5", borderRadius: 10, padding: "10px 12px", cursor: "pointer", border: "1.5px solid #e8e2d9", textAlign: "left" }}
                          onClick={() => setSelectedCandidateId(a.id)}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0ece5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#5a5048", flexShrink: 0 }}>
                            {a.name?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: "#8a7e72" }}>{job?.title || "No role"}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                            {a.score > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 800, color: a.score >= 85 ? "#22c55e" : a.score >= 70 ? "#f59e0b" : "#ef4444" }}>{a.score}/100</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, background: src.bg, color: src.color, padding: "1px 6px", borderRadius: 20 }}>{src.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: "#b0a898" }}>Or select a job on the right and generate a general questionnaire.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>&#x2753;</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Select a job and interview type, then generate.</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>AI will create tailored questions for your interview process.</div>
                </>
              )}
            </div>
          )}

          {generating && (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
              <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: "#5a5048" }}>Generating questionnaire...</div>
            </div>
          )}

          {data?.sections && (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <CopyButton text={getAllQuestionsText()} label="Copy All Questions" />
                <button className="btn-outline" onClick={handleDownloadDocx}>
                  Download DOCX
                </button>
              </div>
              <div className="questionnaire-sections">
                {data.sections.map((section, si) => (
                  <div key={si} className="q-section">
                    <div className="q-section-title">{section.title}</div>
                    {section.questions.map((q, qi) => (
                      <div key={qi} className="q-item">
                        <div style={{ display: "flex", alignItems: "flex-start" }}>
                          <span className="q-number">{qi + 1}</span>
                          <span className="q-text">{q.question}</span>
                        </div>
                        {q.purpose && <div className="q-purpose">Purpose: {q.purpose}</div>}
                        {q.expectedAnswer && <div className="q-expected">Expected: {q.expectedAnswer}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Config sidebar */}
        <div style={{ position: "sticky", top: 24 }}>
          <div className="card">
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 14, fontFamily: "'Fraunces',serif" }}>Configuration</div>

            {/* ── Candidate selector ── */}
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label">Candidate (optional — pre-fills job &amp; JD)</label>
              <select
                className="form-input"
                value={selectedCandidateId}
                onChange={(e) => {
                  setSelectedCandidateId(e.target.value);
                  if (!e.target.value) { setSelectedJobId(""); setJdPaste(""); setCustomTopics(""); }
                }}
              >
                <option value="">— General / No specific candidate —</option>
                {screenedCandidates.map((a) => {
                  const job = jobs.find((j) => j.id === a.jobId);
                  const score = a.score > 0 ? ` · ${a.score}/100` : "";
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name}{job ? ` — ${job.title}` : ""}
                      {score}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected candidate info card */}
            {selectedCandidate && (
              <div style={{ background: "#faf8f5", border: "1.5px solid #e8e2d9", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0ece5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#5a5048", flexShrink: 0 }}>
                    {selectedCandidate.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedCandidate.name}</div>
                    <div style={{ fontSize: 11, color: "#8a7e72" }}>{selectedCandidate.email}</div>
                  </div>
                  {selectedCandidate.score > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: selectedCandidate.score >= 85 ? "#22c55e" : selectedCandidate.score >= 70 ? "#f59e0b" : "#ef4444" }}>
                      {selectedCandidate.score}/100
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: STAGE_META[selectedCandidate.stage]?.bg, color: STAGE_META[selectedCandidate.stage]?.color, padding: "2px 8px", borderRadius: 20 }}>
                    {STAGE_META[selectedCandidate.stage]?.label}
                  </span>
                  {selectedCandidate.portal && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: SOURCE_META[selectedCandidate.portal]?.bg, color: SOURCE_META[selectedCandidate.portal]?.color, padding: "2px 8px", borderRadius: 20 }}>
                      {SOURCE_META[selectedCandidate.portal]?.label}
                    </span>
                  )}
                </div>
                {selectedCandidate.screening_notes && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#5a5048", lineHeight: 1.5, borderTop: "1px solid #ede6db", paddingTop: 8 }}>
                    <span style={{ fontWeight: 700, color: "#8a7e72" }}>AI Notes: </span>
                    {selectedCandidate.screening_notes.slice(0, 200)}{selectedCandidate.screening_notes.length > 200 ? "…" : ""}
                  </div>
                )}
              </div>
            )}

            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label">Select Job *</label>
              <select className="form-input" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                <option value="">Select job...</option>
                {JOB_ROLES.map((role) => (
                  <option key={`role:${role}`} value={`role:${role}`}>
                    {role}
                  </option>
                ))}
                {jobs.filter((j) => !JOB_ROLES.includes(j.title)).length > 0 && (
                  <>
                    <option disabled>——— Posted jobs ———</option>
                    {jobs
                      .filter((j) => !JOB_ROLES.includes(j.title))
                      .map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))}
                  </>
                )}
              </select>
            </div>

            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label">Interview Type</label>
              <div className="interview-type-toggle">
                <button className={`interview-type-btn ${interviewType === "hr" ? "active" : ""}`} onClick={() => setInterviewType("hr")}>
                  HR Interview
                </button>
                <button className={`interview-type-btn ${interviewType === "director" ? "active" : ""}`} onClick={() => setInterviewType("director")}>
                  Director / Technical
                </button>
              </div>
            </div>

            <div className="form-field" style={{ marginBottom: 14 }}>
              <label className="form-label">Job description (optional – for tailored questions)</label>
              <textarea
                className="form-input"
                placeholder="Paste or type the JD here. Or upload a PDF/DOCX below. AI will use this to prepare questions."
                value={jdPaste}
                onChange={(e) => setJdPaste(e.target.value)}
                style={{ minHeight: 70 }}
                rows={3}
              />
              <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 6 }}>Or upload JD as PDF/DOCX:</div>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => handleJdFileChange(e.target.files?.[0] || null)}
                style={{ fontSize: 13, marginTop: 4 }}
              />
              {jdFile && <span style={{ fontSize: 12, color: "#8a7e72", marginTop: 4, display: "block" }}>{jdFile.name}</span>}
            </div>

            <div className="form-field" style={{ marginBottom: 18 }}>
              <label className="form-label">Custom Topics (optional)</label>
              <textarea
                className="form-input"
                placeholder="e.g. Focus on leadership skills, ask about system design experience..."
                value={customTopics}
                onChange={(e) => setCustomTopics(e.target.value)}
                style={{ minHeight: 80 }}
              />
            </div>

            {selectedJob && (
              <div style={{ background: "#faf8f5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
                {[
                  ["Title", selectedJob.title],
                  ["Dept", selectedJob.dept || "-"],
                  ["Exp", selectedJob.exp || "-"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #ede6db" }}>
                    <span style={{ color: "#8a7e72" }}>{k}</span>
                    <span style={{ fontWeight: 600, color: "#1a1612" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={handleGenerate} disabled={generating || !selectedJobId}>
              {generating ? (
                <>
                  <span className="spinner" /> Generating...
                </>
              ) : (
                "Generate Questionnaire"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
