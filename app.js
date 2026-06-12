const sampleRfp = `RFP: Global Manufacturing Data Platform Modernization

1. The proposed platform must provide 99.95% or higher availability for production workloads.
2. The vendor must support migration from on-premises Oracle Database and VMware-based application servers.
3. The solution must include strong network isolation, private connectivity, encryption at rest, encryption in transit, and key management.
4. The platform should support AI-assisted search over production manuals, maintenance reports, and quality inspection data.
5. The vendor must provide database performance tuning guidance and automated scaling options.
6. The response must include an implementation timeline, operational roles, and risk mitigation plan.
7. The solution must support audit logging, access control, and compliance reporting for internal governance.
8. The vendor should describe disaster recovery options across regions and the expected RTO/RPO.
9. Cost visibility, budget tracking, and usage optimization recommendations are required.
10. The proposal should include a clear executive summary and measurable business outcomes.`;

const emptyDraft = "Load a sample or paste an RFP, configure OCI Grok API settings, and run the analysis.";
const storageKey = "rfpAcceleratorOciGrokSettings";
const defaultOracleSkillsContext = [
  "oracle/skills context for RFP analysis:",
  "- Oracle Database: use migration assessment, Oracle migration tooling, performance tuning, security, privileges, encryption, auditing, Data Guard, RAC, multitenant, vector search, SELECT AI, ORDS, SQLcl, and agent-safe database workflows where relevant.",
  "- OCI and Oracle Cloud: emphasize secure architecture, private networking, identity and access controls, key management, observability, availability, disaster recovery, cost governance, workload migration, and operational readiness.",
  "- Proposal discipline: map each requirement to an Oracle capability only when support is clear. Treat unclear or unsupported items as risks or clarification questions.",
  "- Output style: concise, business-ready English suitable for an enterprise proposal team."
].join(" ");

let analysis = createEmptyAnalysis();
let currentTab = "executive";

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  document.getElementById("sampleBtn").addEventListener("click", () => {
    document.getElementById("rfpText").value = sampleRfp;
    showToast("Sample RFP loaded");
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    document.getElementById("rfpText").value = "";
    resetUi();
    showToast("Input cleared");
  });

  document.getElementById("analyzeBtn").addEventListener("click", analyzeRfp);
  document.getElementById("exportBtn").addEventListener("click", exportMarkdown);
  document.getElementById("rememberSettings").addEventListener("change", saveSettings);
  ["apiKey", "modelName", "apiEndpoint", "oracleSkillsContext"].forEach(id => {
    document.getElementById(id).addEventListener("change", saveSettings);
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      renderDraft();
    });
  });
});

async function analyzeRfp() {
  const text = document.getElementById("rfpText").value.trim();
  const settings = getApiSettings();

  if (!text) {
    showToast("Paste an RFP before running analysis");
    return;
  }
  if (!settings.apiKey) {
    showToast("Enter an OCI Grok API token in settings");
    return;
  }

  setLoading(true);
  saveSettings();

  try {
    const result = await callGrok(settings, text, document.getElementById("dealType").value);
    analysis = normalizeAnalysis(result);
    updateMetrics();
    renderMatrix();
    renderDraft();
    renderThemes();
    showToast("RFP analysis complete");
  } catch (error) {
    console.error(error);
    showToast(error.message || "OCI Grok analysis failed");
  } finally {
    setLoading(false);
  }
}

async function callGrok(settings, rfpText, dealType) {
  const instructions = [
    "You are an expert proposal strategist for enterprise technology RFPs.",
    settings.oracleSkillsContext || defaultOracleSkillsContext,
    "Analyze the RFP and return only valid JSON. Do not wrap it in Markdown.",
    "Use concise, business-ready English. Present the output as production-ready proposal content.",
    "Fit scores must be integers from 0 to 100.",
    "Use this exact JSON shape: {\"fitScore\": number, \"requirements\": [{\"id\": number, \"category\": string, \"text\": string, \"fit\": number, \"stance\": string}], \"risks\": [string], \"drafts\": {\"executive\": string, \"technical\": string, \"risk\": string}, \"themes\": [{\"title\": string, \"body\": string}]}."
  ].join(" ");

  const body = {
    model: settings.model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: `Deal type: ${dealType}\n\nRFP text:\n${rfpText}` }
    ],
    max_tokens: 4000
  };

  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OCI Grok API request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractChatText(payload);
  if (!outputText) {
    throw new Error("The API response did not include analysis text");
  }

  const jsonText = extractJsonObject(outputText);
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("The API response was not valid JSON");
  }
}

function extractChatText(payload) {
  return payload.choices?.[0]?.message?.content || payload.output_text || "";
}

function extractJsonObject(text) {
  const trimmed = String(text).trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function normalizeAnalysis(result) {
  const requirements = (result.requirements || []).map((item, index) => ({
    id: Number(item.id) || index + 1,
    category: String(item.category || "General"),
    text: String(item.text || ""),
    fit: clampScore(item.fit),
    stance: String(item.stance || "Clarify the requirement and map the response to measurable evaluation criteria.")
  })).filter(item => item.text);

  return {
    requirements,
    fitScore: clampScore(result.fitScore),
    risks: (result.risks || []).map(String).filter(Boolean).slice(0, 6),
    drafts: {
      executive: String(result.drafts?.executive || emptyDraft),
      technical: String(result.drafts?.technical || emptyDraft),
      risk: String(result.drafts?.risk || emptyDraft)
    },
    themes: (result.themes || []).map(theme => ({
      title: String(theme.title || "Win theme"),
      body: String(theme.body || "")
    })).filter(theme => theme.body).slice(0, 5)
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function updateMetrics() {
  const risks = analysis.risks.length;
  const reqs = analysis.requirements.length;
  const ready = Math.min(99, Math.round(50 + reqs * 3.5 + analysis.fitScore * 0.2));
  const saved = Math.min(85, Math.round(30 + reqs * 3.8));

  document.getElementById("fitScore").textContent = `${analysis.fitScore}%`;
  document.getElementById("reqCount").textContent = reqs;
  document.getElementById("readiness").textContent = `${ready}%`;
  document.getElementById("riskCount").textContent = risks;
  document.getElementById("timeSaved").textContent = `${saved}%`;
  updateScoreArc(analysis.fitScore);
}

function updateScoreArc(score) {
  const arc = document.getElementById("scoreArc");
  const circumference = 302;
  const offset = circumference - circumference * score / 100;
  arc.style.strokeDashoffset = offset;
}

function renderMatrix() {
  const rows = document.getElementById("matrixRows");
  if (!analysis.requirements.length) {
    rows.innerHTML = `<tr><td colspan="4" class="empty">Analysis results will appear here</td></tr>`;
    return;
  }

  rows.innerHTML = analysis.requirements.map(item => {
    const fitClass = item.fit >= 90 ? "high" : item.fit >= 80 ? "medium" : "low";
    return `
      <tr>
        <td><strong>${escapeHtml(item.category)}</strong><br><small>REQ-${String(item.id).padStart(3, "0")}</small></td>
        <td>${escapeHtml(item.text)}</td>
        <td><span class="fit ${fitClass}">${item.fit}%</span></td>
        <td>${escapeHtml(item.stance)}</td>
      </tr>
    `;
  }).join("");
}

function renderDraft() {
  document.getElementById("draft").textContent = analysis.drafts[currentTab];
}

function renderThemes() {
  const target = document.getElementById("winThemes");
  if (!analysis.themes.length) {
    target.innerHTML = `<div class="empty-card">Win themes will appear after analysis</div>`;
    return;
  }

  target.innerHTML = analysis.themes.map(theme => `
    <div class="theme-card">
      <strong>${escapeHtml(theme.title)}</strong>
      <span>${escapeHtml(theme.body)}</span>
    </div>
  `).join("");
}

function resetUi() {
  analysis = createEmptyAnalysis();
  document.getElementById("fitScore").textContent = "--%";
  document.getElementById("reqCount").textContent = "--";
  document.getElementById("readiness").textContent = "--";
  document.getElementById("riskCount").textContent = "--";
  document.getElementById("timeSaved").textContent = "--";
  document.getElementById("matrixRows").innerHTML = `<tr><td colspan="4" class="empty">Analysis results will appear here</td></tr>`;
  document.getElementById("winThemes").innerHTML = `<div class="empty-card">Win themes will appear after analysis</div>`;
  updateScoreArc(0);
  renderDraft();
}

function exportMarkdown() {
  if (!analysis.requirements.length) {
    showToast("Run the RFP analysis first");
    return;
  }

  const markdown = `# RFP Response Accelerator Output

## Fit Score
${analysis.fitScore}%

## Requirements
${analysis.requirements.map(item => `- **${item.category} / ${item.fit}%**: ${item.text}\n  - Response stance: ${item.stance}`).join("\n")}

## Executive Draft
${analysis.drafts.executive}

## Technical Draft
${analysis.drafts.technical}

## Risks
${analysis.drafts.risk}

## Win Themes
${analysis.themes.map(theme => `- **${theme.title}**: ${theme.body}`).join("\n")}
`;

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rfp-response-draft.md";
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Markdown exported");
}

function createEmptyAnalysis() {
  return {
    requirements: [],
    fitScore: 0,
    risks: [],
    drafts: {
      executive: emptyDraft,
      technical: emptyDraft,
      risk: emptyDraft
    },
    themes: []
  };
}

function getApiSettings() {
  return {
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("modelName").value.trim() || "grok-4.3",
    endpoint: document.getElementById("apiEndpoint").value.trim() || "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com/openai/v1/chat/completions",
    oracleSkillsContext: document.getElementById("oracleSkillsContext").value.trim() || defaultOracleSkillsContext
  };
}

function getPersistableSettings() {
  const settings = getApiSettings();
  return {
    model: settings.model,
    endpoint: settings.endpoint,
    oracleSkillsContext: settings.oracleSkillsContext
  };
}

function saveSettings() {
  const remember = document.getElementById("rememberSettings").checked;
  if (!remember) {
    localStorage.removeItem(storageKey);
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(getPersistableSettings()));
}

function loadSettings() {
  document.getElementById("oracleSkillsContext").value = defaultOracleSkillsContext;

  const saved = localStorage.getItem(storageKey);
  if (!saved) return;

  try {
    const settings = JSON.parse(saved);
    document.getElementById("apiKey").value = "";
    document.getElementById("modelName").value = settings.model || "grok-4.3";
    document.getElementById("apiEndpoint").value = settings.endpoint || "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com/openai/v1/chat/completions";
    document.getElementById("oracleSkillsContext").value = settings.oracleSkillsContext || defaultOracleSkillsContext;
    document.getElementById("rememberSettings").checked = true;
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function setLoading(isLoading) {
  const button = document.getElementById("analyzeBtn");
  button.disabled = isLoading;
  button.textContent = isLoading ? "Analyzing..." : "Analyze RFP";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}
