// ================= IMPORTS =================
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Groq, { toFile } from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
// NOTE: Google Cloud removed — using Groq Whisper (free) for STT
//       and browser SpeechSynthesis (free) for TTS

dotenv.config();

// ================= APP SETUP =================
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "25mb" }));
app.use(bodyParser.urlencoded({ limit: "25mb", extended: true }));

// ================= PATH FIX (IMPORTANT) =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_PATH = path.join(__dirname, "log.json");

// ================= SERVE FRONTEND (OPTIMIZED FOR LOW BANDWIDTH) =================
app.use(express.static(__dirname, {
  maxAge: "1d",
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    } else {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    }
  }
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= GROQ CONFIG =================
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const rawKey = String(process.env.GROQ_API_KEY || "").trim();
if (!rawKey || rawKey === "YOUR_GROQ_API_KEY") {
  console.error("GROQ_API_KEY is missing or placeholder in .env");
  process.exit(1);
}
const AZURE_SPEECH_KEY = ""; // Not used
const AZURE_SPEECH_REGION = ""; // Not used
// ================= DATA.GOV.IN API CONFIG =================
const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY || "579b464db66ec23bdd000001d51bce119b61434842fc8eff5d2b1935";
const DATA_GOV_RESOURCE_MSME = process.env.DATA_GOV_RESOURCE_MSME || "579b464db66ec23bdd00000101e4411b31d0429a73a2eb6c7795ad9a";
const DATA_GOV_RESOURCE_MARKET_ARRIVAL = process.env.DATA_GOV_RESOURCE_MARKET_ARRIVAL || "579b464db66ec23bdd00000101e4411b31d0429a73a2eb6c7795ad9a";

// Fallback / Pre-cached Dataset for Market Arrivals & Commodity Product Prices (AGMARKNET / data.gov.in)
const MARKET_ARRIVALS_DATA = [
  { commodity: "Paddy (Dhan)", state: "Tamil Nadu", market: "Madurai Mandi", arrival_tonnes: 1450, modal_price_rs_quintal: 2180, min_price: 2100, max_price: 2250, date: "September 2026" },
  { commodity: "Tomato", state: "Tamil Nadu", market: "Koyambedu / Dindigul", arrival_tonnes: 890, modal_price_rs_quintal: 2800, min_price: 2400, max_price: 3200, date: "September 2026" },
  { commodity: "Chilli (Red)", state: "Tamil Nadu", market: "Guntur / Ramnad", arrival_tonnes: 620, modal_price_rs_quintal: 14500, min_price: 13800, max_price: 15200, date: "September 2026" },
  { commodity: "Cotton", state: "Tamil Nadu", market: "Coimbatore / Tiruppur", arrival_tonnes: 1100, modal_price_rs_quintal: 7200, min_price: 6800, max_price: 7500, date: "September 2026" },
  { commodity: "Sugarcane", state: "Tamil Nadu", market: "Erode / Salem", arrival_tonnes: 3400, modal_price_rs_quintal: 3150, min_price: 3050, max_price: 3250, date: "September 2026" },
  { commodity: "Coconut", state: "Tamil Nadu", market: "Pollachi Mandi", arrival_tonnes: 2100, modal_price_rs_quintal: 12800, min_price: 12000, max_price: 13500, date: "September 2026" }
];

// Fallback / Pre-cached UDYAM MSME Registered Agricultural Units (data.gov.in)
const MSME_UDYAM_UNITS_DATA = [
  { udyam_registration_no: "UDYAM-TN-03-0014892", enterprise_name: "Uzhavan Agro Processing MSME", category: "Micro Enterprise", sector: "Food Processing & Agri-Packaging", district: "Madurai, Tamil Nadu", state: "Tamil Nadu" },
  { udyam_registration_no: "UDYAM-TN-12-0089201", enterprise_name: "Kongu Dairy & Bio-Fertilizers Cooperative", category: "Small Enterprise", sector: "Dairy & Organic Fertilizers", district: "Coimbatore, Tamil Nadu", state: "Tamil Nadu" },
  { udyam_registration_no: "UDYAM-TN-07-0043192", enterprise_name: "Cauvery Delta PACS Cold Storage Unit", category: "Small Enterprise", sector: "Warehousing & Cold Chain", district: "Thanjavur, Tamil Nadu", state: "Tamil Nadu" },
  { udyam_registration_no: "UDYAM-TN-22-0031890", enterprise_name: "Green Harvest Solar Irrigation Equipment", category: "Micro Enterprise", sector: "Agri-Tech & Solar Pumps", district: "Salem, Tamil Nadu", state: "Tamil Nadu" }
];

async function fetchDataGovResource(resourceId, fallbackData = []) {
  try {
    const fetchUrl = `https://api.data.gov.in/resource/${resourceId}?api-key=${DATA_GOV_API_KEY}&format=json&limit=20`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json && json.status === "ok" && Array.isArray(json.records) && json.records.length > 0) {
      return json.records;
    }
  } catch (err) {
    console.warn(`Data.gov.in fetch fallback for ${resourceId}:`, err?.message || err);
  }
  return fallbackData;
}

let schemesDataset = [];
try {
  const schemesPath = path.join(__dirname, "tn_central_schemes.json");
  const rawSchemes = await fs.readFile(schemesPath, "utf-8");
  schemesDataset = JSON.parse(rawSchemes);
  console.log(`Loaded ${schemesDataset.length} Central & Tamil Nadu schemes into memory.`);
} catch (e) {
  console.warn("Could not load tn_central_schemes.json:", e?.message);
}

// ================= SUPABASE CLOUD DOCUMENT STORAGE & RAG (MUMBAI AP-SOUTH-1) =================
const SUPABASE_RAW_URL = process.env.SUPABASE_URL || "https://snxhbfqucejukillyjee.supabase.co";
const SUPABASE_BASE_URL = SUPABASE_RAW_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const SUPABASE_KEY = (process.env.SUPABASE_KEY || "").trim();
const SUPABASE_BUCKET = "agri-laws";

let legalDataset = [];
try {
  const legalPath = path.join(__dirname, "legal_database.json");
  const rawLegal = await fs.readFile(legalPath, "utf-8");
  legalDataset = JSON.parse(rawLegal);
  console.log(`Loaded ${legalDataset.length} statutory Acts & Rules into Legal RAG memory.`);
} catch (e) {
  console.warn("Could not load legal_database.json:", e?.message);
}

let supabaseStatus = {
  connected: false,
  bucketExists: false,
  uploadedCount: 0,
  lastChecked: null,
  error: null,
  url: SUPABASE_BASE_URL,
  bucket: SUPABASE_BUCKET
};

async function syncLegalDocsToSupabase() {
  if (!SUPABASE_KEY) {
    console.warn("SUPABASE_KEY not configured in .env");
    supabaseStatus.error = "SUPABASE_KEY not set";
    return;
  }

  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };

  try {
    // 1. Check/List Buckets
    const bucketRes = await fetch(`${SUPABASE_BASE_URL}/storage/v1/bucket`, { headers });
    if (bucketRes.ok) {
      supabaseStatus.connected = true;
      const buckets = await bucketRes.json();
      const exists = Array.isArray(buckets) && buckets.some(b => b.name === SUPABASE_BUCKET);
      if (!exists) {
        console.log(`[Supabase Cloud] Creating '${SUPABASE_BUCKET}' public storage bucket...`);
        const createRes = await fetch(`${SUPABASE_BASE_URL}/storage/v1/bucket`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: true })
        });
        supabaseStatus.bucketExists = createRes.ok;
      } else {
        supabaseStatus.bucketExists = true;
      }
    } else {
      const errText = await bucketRes.text();
      console.warn(`[Supabase Cloud] Bucket check HTTP ${bucketRes.status}:`, errText);
      supabaseStatus.error = `HTTP ${bucketRes.status}: ${errText.slice(0, 100)}`;
    }

    // 2. Upload legal documents from legal_docs/
    const docsDir = path.join(__dirname, "legal_docs");
    let files = [];
    try {
      files = await fs.readdir(docsDir);
    } catch (e) {
      console.warn("Could not read legal_docs dir:", e.message);
    }

    let uploaded = 0;
    for (const fname of files) {
      if (!fname.endsWith(".pdf") && !fname.endsWith(".txt")) continue;
      try {
        const filePath = path.join(docsDir, fname);
        const fileBytes = await fs.readFile(filePath);
        const contentType = fname.endsWith(".pdf") ? "application/pdf" : "text/plain";

        const uploadRes = await fetch(`${SUPABASE_BASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${encodeURIComponent(fname)}`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": contentType,
            "x-upsert": "true"
          },
          body: fileBytes
        });

        if (uploadRes.ok || uploadRes.status === 200 || uploadRes.status === 201) {
          uploaded++;
        }
      } catch (uploadErr) {
        // Skip individual file upload error
      }
    }

    supabaseStatus.uploadedCount = uploaded;
    supabaseStatus.lastChecked = new Date().toISOString();
    console.log(`[Supabase Cloud] Storage check completed: ${uploaded} files synced in '${SUPABASE_BUCKET}'.`);
  } catch (err) {
    console.warn("[Supabase Cloud] Warning:", err?.message || err);
    supabaseStatus.error = err?.message || String(err);
  }
}

function searchLegalContext(query = "") {
  if (!query || !legalDataset || legalDataset.length === 0) return null;
  const q = String(query).toLowerCase();

  const matches = legalDataset.map(doc => {
    let score = 0;
    const allText = `${doc.title} ${doc.category} ${doc.summary} ${doc.grievance_steps} ${doc.key_sections.map(s => s.section + ' ' + s.title + ' ' + s.details).join(' ')}`.toLowerCase();

    // Specific statutory intent scoring
    if (/seed|germination|spurious|certified|defective seed|lot number|purity|seed testing/i.test(q) && doc.id === "seed-act-1966") score += 15;
    if (/fertilizer|urea|dap|npk|mrp|overcharg|fco|dealer|tie-in|bag price|pos machine/i.test(q) && doc.id === "fco-1985") score += 15;
    if (/model pacs|bye-law|bylaw|village society|universal member|tenant farmer|sharecropper/i.test(q) && doc.id === "model-pacs-bye-laws") score += 15;
    if (/multi-state|mscs|ombudsman|election authority|cea|information officer|cio|crcs|board election/i.test(q) && doc.id === "mscs-act-2023") score += 15;
    if (/pmfby|crop insurance|insurance claim|72 hour|72hr|intimation|hailstorm|flood|inundation|calamity|mid-season|cut and spread|post-harvest|14447/i.test(q) && doc.id === "pmfby-sec14") score += 15;
    if (/kcc|kisan credit|interest subvention|miss|prompt repayment|4%|7%|collateral|mortgage|1.6|1.60|restructur|reschedul/i.test(q) && doc.id === "kcc-miss-rbi") score += 15;
    if (/consumer|edaakhil|e-daakhil|product liability|cheat|defective tractor|pump defect|faulty machinery|compensation|commission/i.test(q) && doc.id === "consumer-protection-act-2019") score += 15;
    if (/computer|computeriz|erp|software|digital receipt|receipt|printed bill|csc|common service center/i.test(q) && doc.id === "pacs-computerization-erp-2023") score += 15;
    if (/dispute|arbitration|drcs|registrar|tamil nadu|tn cooperative|section 90|sec 90|section 74|section 81/i.test(q) && doc.id === "tn-cooperative-act-1983") score += 15;
    if (/hoard|black market|shortage|essential commodity|eca|godown|seizure/i.test(q) && doc.id === "essential-commodities-act-1955") score += 15;
    if (/rti|right to information|pio|fund status|trace delay|application fee/i.test(q) && doc.id === "rti-act-2005") score += 15;

    // Word match scoring
    const words = q.split(/\s+/).filter(w => w.length > 3);
    for (const w of words) {
      if (allText.includes(w)) score += 2;
    }

    // General legal keywords fallback
    if (/law|right|rule|act|statute|grievance|petition|complain|legal/i.test(q)) {
      if (doc.id === "model-pacs-bye-laws" || doc.id === "mscs-act-2023" || doc.id === "pmfby-sec14" || doc.id === "kcc-miss-rbi") score += 5;
    }

    return { doc, score };
  }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    // If user asked general legal question, provide top fundamental cooperative rights
    const defaultDocs = legalDataset.filter(d => ["model-pacs-bye-laws", "mscs-act-2023", "kcc-miss-rbi", "fco-1985"].includes(d.id));
    if (defaultDocs.length === 0) return null;
    let contextStr = "OFFICIAL STATUTORY COOPERATIVE & AGRICULTURAL REPOSITORY (Supabase Cloud RAG):\n";
    for (const doc of defaultDocs.slice(0, 3)) {
      contextStr += `\n[Act: ${doc.title}]\nAuthority: ${doc.authority}\nSummary: ${doc.summary}\nKey Provisions:\n`;
      for (const sec of doc.key_sections) {
        contextStr += `• ${sec.section} - ${sec.title}: ${sec.details}\n`;
      }
      contextStr += `Grievance Redressal Procedure:\n${doc.grievance_steps}\n`;
    }
    return contextStr;
  }

  const topMatches = matches.slice(0, 3);
  let contextStr = "OFFICIAL STATUTORY COOPERATIVE & AGRICULTURAL REPOSITORY (Supabase Cloud RAG):\n";
  for (const { doc } of topMatches) {
    contextStr += `\n[Act: ${doc.title}]\n`;
    contextStr += `Authority: ${doc.authority} | Category: ${doc.category}\n`;
    contextStr += `Summary: ${doc.summary}\n`;
    contextStr += `Key Statutory Provisions:\n`;
    for (const sec of doc.key_sections) {
      contextStr += `• ${sec.section} - ${sec.title}: ${sec.details}\n`;
    }
    contextStr += `Official Grievance Redressal Procedure:\n${doc.grievance_steps}\n`;
    contextStr += `Official Document Link: ${SUPABASE_BASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(doc.filename)}\n`;
  }
  return contextStr;
}

// ================= MEMORY =================
let sensorHistory = [];
let notifications = [];
const TEXT_MODEL_CANDIDATES = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
];
const VISION_MODEL_CANDIDATES = [
  "meta-llama/llama-4-scout-17b-16e-instruct"
];
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
let groqModelCache = {
  ids: null,
  fetchedAt: 0
};

function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimList(list, max = 100) {
  if (list.length > max) {
    list.splice(0, list.length - max);
  }
}

function createNotification({
  msg,
  details = "",
  kind = "alert",
  source = "system",
  undoable = false,
  linkedAnalysisId = null
}) {
  const entry = {
    id: makeId("notif"),
    msg,
    details,
    kind,
    source,
    undoable,
    linkedAnalysisId,
    time: new Date()
  };

  notifications.push(entry);
  trimList(notifications, 150);
  return entry;
}

function parseAnalysisResult(result = "") {
  const lines = String(result)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const actionLine = lines.find(line => /^Action\s*:/i.test(line));
  const reasonLine = lines.find(line => /^Reason\s*:/i.test(line));

  return {
    action: actionLine ? actionLine.replace(/^Action\s*:\s*/i, "").trim() : "",
    reason: reasonLine ? reasonLine.replace(/^Reason\s*:\s*/i, "").trim() : ""
  };
}

async function getAvailableGroqModelIds() {
  const now = Date.now();
  if (groqModelCache.ids && now - groqModelCache.fetchedAt < MODEL_CACHE_TTL_MS) {
    return groqModelCache.ids;
  }

  const models = await client.models.list();
  const ids = new Set((models?.data || []).map(item => item.id).filter(Boolean));
  groqModelCache = {
    ids,
    fetchedAt: now
  };
  return ids;
}

async function getModelCandidates(wantsVision = false) {
  const preferred = wantsVision ? VISION_MODEL_CANDIDATES : TEXT_MODEL_CANDIDATES;

  try {
    const availableIds = await getAvailableGroqModelIds();
    const supported = preferred.filter(model => availableIds.has(model));
    if (supported.length > 0) {
      return supported;
    }
  } catch (err) {
    console.warn("Could not refresh Groq model list, using static fallback:", err?.message || err);
  }

  return preferred;
}

function sanitizeChatContent(content) {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed ? trimmed : null;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const parts = content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      if (part.type === "text" && typeof part.text === "string" && part.text.trim()) {
        return { type: "text", text: part.text.trim() };
      }

      const imageUrl = part?.image_url?.url;
      if (part.type === "image_url" && typeof imageUrl === "string" && imageUrl.startsWith("data:image/")) {
        return {
          type: "image_url",
          image_url: { url: imageUrl }
        };
      }

      return null;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts : null;
}

function sanitizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-16)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
      const content = sanitizeChatContent(item.content);
      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean);
}

function historyContainsImage(messages = []) {
  return messages.some((message) =>
    Array.isArray(message.content) &&
    message.content.some((part) => part?.type === "image_url" && typeof part?.image_url?.url === "string")
  );
}

async function createGroqChatCompletion({ messages, wantsVision }) {
  const modelCandidates = await getModelCandidates(wantsVision);
  let lastErr = null;

  for (const model of modelCandidates) {
    try {
      return await client.chat.completions.create({
        model,
        messages,
        temperature: 0.6,
        max_tokens: wantsVision ? 1024 : 900
      });
    } catch (err) {
      lastErr = err;
      const errorCode = err?.error?.code || err?.code || "";
      const errorMessage = String(err?.error?.message || err?.message || "");
      const retryableModelError =
        errorCode === "model_decommissioned" ||
        errorCode === "model_not_found" ||
        /decommissioned|no longer supported|not found|unsupported/i.test(errorMessage);

      if (retryableModelError) {
        console.warn(`Groq model ${model} unavailable, trying next candidate.`);
        groqModelCache.fetchedAt = 0;
        continue;
      }

      throw err;
    }
  }

  throw lastErr || new Error("No Groq model is currently available for this request.");
}

// ================= REAL-TIME SENSOR DATA RAG HELPER (from log.json) =================
async function getLatestSensorContext() {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf-8");
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch {
      entries = JSON.parse(raw.replace(/\bNaN\b/g, "null").replace(/\bInfinity\b/g, "null"));
    }
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const latest = entries[entries.length - 1];
    const avg = latest.average || {};
    
    let info = `[LIVE IOT FIELD TELEMETRY - READ DIRECTLY FROM log.json]\n`;
    info += `• Latest 1-Minute Average Recorded At: ${latest.timestamp || "Just now"}\n`;
    info += `• Overall Air Temperature: ${avg.temperature !== undefined ? avg.temperature : "N/A"} °C\n`;
    info += `• Overall Air Humidity: ${avg.humidity !== undefined ? avg.humidity : "N/A"} %\n`;
    info += `• Overall Soil Moisture: ${avg.soil !== undefined ? avg.soil : "N/A"} %\n`;
    info += `• Overall Rain Level: ${avg.rain !== undefined ? avg.rain : "N/A"} %\n`;
    info += `• Overall Soil Condition: ${latest.soil_status || (avg.soil < 25 ? "DRY (Irrigation Needed)" : "OPTIMAL")}\n`;
    if (latest.farm_wealth !== undefined) {
      info += `• Farm Health Index: ${latest.farm_wealth}\n`;
    }

    if (latest.nodes && Object.keys(latest.nodes).length > 0) {
      info += `• Multi-Node Breakdown:\n`;
      for (const [nodeId, n] of Object.entries(latest.nodes)) {
        info += `  - [${nodeId}]: Temp: ${n.temperature}°C, Soil Moisture: ${n.soil_moisture}%, Rain: ${n.rain_intensity}%, Flood Risk: ${n.flood_risk || "NO"}, Drought Risk: ${n.drought_risk || "NO"}, Status: ${n.status || "Active"}\n`;
      }
    }

    // Include recent 3-minute trend if available
    if (entries.length >= 3) {
      const prev = entries[entries.length - 3];
      const pAvg = prev.average || {};
      if (pAvg.soil !== undefined && avg.soil !== undefined) {
        const soilDiff = Math.round((avg.soil - pAvg.soil) * 10) / 10;
        info += `• Trend over last 3 mins: Soil moisture has changed by ${soilDiff > 0 ? "+" : ""}${soilDiff}%.\n`;
      }
    }

    return info;
  } catch (err) {
    console.warn("Could not read sensor telemetry from log.json:", err?.message || err);
    return null;
  }
}

const LANGUAGE_NAMES = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "gu-IN": "Gujarati",
  "mr-IN": "Marathi",
  "bn-IN": "Bengali",
  "pa-IN": "Punjabi",
  "or-IN": "Odia",
  "as-IN": "Assamese",
  "ur-PK": "Urdu",
  "sa-IN": "Sanskrit",
  "ne-NP": "Nepali",
  "mai-IN": "Maithili",
  "ks-IN": "Kashmiri",
  "sd-IN": "Sindhi",
  "kok-IN": "Konkani",
  "doi-IN": "Dogri",
  "mni-IN": "Manipuri",
  "sat-IN": "Santali",
  "brx-IN": "Bodo",
  "bho-IN": "Bhojpuri",
  "de-DE": "German",
  "fr-FR": "French",
  "es-ES": "Spanish",
  "it-IT": "Italian",
  "pt-PT": "Portuguese",
  "ru-RU": "Russian",
  "zh-CN": "Chinese",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "ar-SA": "Arabic",
  "tr-TR": "Turkish",
  "nl-NL": "Dutch",
  "pl-PL": "Polish",
  "sv-SE": "Swedish",
  "no-NO": "Norwegian",
  "da-DK": "Danish",
  "fi-FI": "Finnish",
  "cs-CZ": "Czech",
  "el-GR": "Greek",
  "he-IL": "Hebrew",
  "th-TH": "Thai",
  "vi-VN": "Vietnamese",
  "id-ID": "Indonesian",
  "ms-MY": "Malay",
  "uk-UA": "Ukrainian",
  "ro-RO": "Romanian",
  "hu-HU": "Hungarian"
};

function detectMessageLanguage(text) {
  if (!text || typeof text !== "string") return null;
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Native Unicode Scripts (Highest accuracy)
  if (/[\u0B80-\u0BFF]/.test(clean)) return "ta-IN"; // Tamil
  if (/[\u0900-\u097F]/.test(clean)) {
    if (/\b(आहे|नाही|शेतकरी|पिक|पाऊस|कसा|काय)\b/.test(clean)) return "mr-IN";
    if (/\b(অসম|কৃষি|ধান|পানী)\b/.test(clean)) return "as-IN"; // Assamese
    if (/\b(नेपाल|कृषि|ধান|पानी)\b/.test(clean)) return "ne-NP"; // Nepali
    return "hi-IN"; // Hindi / Devanagari / Sanskrit
  }
  if (/[\u0C00-\u0C7F]/.test(clean)) return "te-IN"; // Telugu
  if (/[\u0C80-\u0CFF]/.test(clean)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(clean)) return "ml-IN"; // Malayalam
  if (/[\u0A80-\u0AFF]/.test(clean)) return "gu-IN"; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(clean)) return "pa-IN"; // Punjabi
  if (/[\u0980-\u09FF]/.test(clean)) {
    if (/\b(অসম|ৰাইজ|বৰষুণ)\b/.test(clean)) return "as-IN";
    return "bn-IN"; // Bengali
  }
  if (/[\u0B00-\u0B7F]/.test(clean)) return "or-IN"; // Odia
  if (/[\u0600-\u06FF]/.test(clean)) {
    if (/\b(کیا|ہیں|کسان|فصل|پانی|مدد)\b/.test(clean)) return "ur-PK"; // Urdu
    return "ar-SA"; // Arabic
  }
  if (/[\u4E00-\u9FFF]/.test(clean)) return "zh-CN"; // Chinese
  if (/[\u3040-\u30FF]/.test(clean)) return "ja-JP"; // Japanese
  if (/[\uAC00-\uD7AF]/.test(clean)) return "ko-KR"; // Korean
  if (/[\u0400-\u04FF]/.test(clean)) return "ru-RU"; // Russian

  // 2. Transliterated / Phonetic keywords
  if (/\b(hola|buenos|dias|tardes|gracias|cultivo|cooperativa)\b/i.test(lower)) return "es-ES";
  if (/\b(bonjour|merci|agriculteur|champ|cooperative)\b/i.test(lower)) return "fr-FR";
  if (/\b(guten|tag|danke|bauer|genossenschaft)\b/i.test(lower)) return "de-DE";
  if (/\b(vyavasaya|vyavasayam|bhoomi|bhumi|ela|elaa|undi|unnaru|cheyali|cheyyali|panta|raithu|raithulu|neellu|polam|namaskaram|bagunnara|eppudu|emi|emiti|dabbulu|dharalu|mandulu|kothalu|subhodayam)\b/i.test(lower)) return "te-IN";
  if (/\b(vanakkam|vannakam|vanakam|epdi|eppadi|irukinga|irukku|enokku|enakku|nandri|magizhchi|nalla|payir|thanni|mazhai|vivasaayam|poochi|kadan|marunthu|seiyyanum|vilai|sollunga)\b/i.test(lower)) return "ta-IN";
  if (/\b(namaste|namaskar|pranam|kaise|kya|hai|hain|hoon|shukriya|dhanyawad|kheti|fasal|kisan|paani|baarish|zameen|mitti|beej|khaad|keede|daam|mandi|batao|kariye)\b/i.test(lower)) return "hi-IN";
  if (/\b(namaskara|hegiddira|hegidhe|dhanyavada|raitha|bale|bele|krushi|krishi|neeru|manne|yava|enu|hege|kelsa|ivattu|rogi)\b/i.test(lower)) return "kn-IN";
  if (/\b(namaskaram|sugamano|nandi|karsakan|mazha|krishi|vellam|nelam|vila|manņu|puzhu|chood|engane|und|enth|parayu)\b/i.test(lower)) return "ml-IN";
  if (/\b(namaskar|kasa|ahe|dhanyavad|shetkari|paus|sheti|pik|zameen|bhav|sang)\b/i.test(lower)) return "mr-IN";
  if (/\b(namaste|kem|cho|khedut|kheti|paak|pani|khatar|bhav|kevi|rite)\b/i.test(lower)) return "gu-IN";
  if (/\b(nomoshkar|kemon|achen|chash|krishi|mati|jol|shoshyo|dhoron|bolun)\b/i.test(lower)) return "bn-IN";
  if (/\b(sat|sri|akal|kive|ho|kisan|kheti|fasal|pani|mitti|dasso)\b/i.test(lower)) return "pa-IN";
  if (/\b(namaskar|kemiti|achanti|chasa|chasi|fasala|pani|mati|kete|kahantu)\b/i.test(lower)) return "or-IN";
  if (/\b(nomoskar|kenekoi|ase|kheti|khetok|pani|mati)\b/i.test(lower)) return "as-IN";
  if (/\b(hello|hi|hey|good morning|good afternoon|weather|crop|soil|farm|rain|fertilizer|pest|scheme)\b/i.test(lower)) return "en-IN";

  return null;
}

// ================= CHAT API =================
app.post("/chat", async (req, res) => {
  try {
    const { message, imageBase64, languageCode, farmerContext, history } = req.body;
    const hasImage = typeof imageBase64 === "string" && imageBase64.startsWith("data:image/");
    const requestedLang = String(languageCode || "en-IN").trim();
    const languageNames = LANGUAGE_NAMES;
    const systemInstruction = `You are Sahakar Vaani (सहकार वाणी) — an omnilingual, voice-enabled AI legal, cooperative governance, and agricultural advisor built for the Ministry of Cooperation (SIH PS 26088).
You are fluent in ALL 22 official Eighth Schedule languages of India (Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Odia, Assamese, Urdu, Sanskrit, Nepali, Maithili, Kashmiri, Sindhi, Konkani, Dogri, Manipuri, Santali, Bodo) as well as global languages (Spanish, French, German, Arabic, Russian, Portuguese, etc.).
Always detect the farmer's language immediately and reply naturally, accurately, and fluently in the EXACT SAME language and script they use.

OMNI-COMPREHENSIVE STATUTORY LEGAL & COOPERATIVE REPOSITORY:
You are grounded in the complete body of Indian cooperative governance, agricultural statutes, financial subventions, and consumer protection acts:
1. Model PACS Bye-Laws (Ministry of Cooperation): Universal membership for every cultivator, tenant, and oral lessee. Collateral-free crop loans up to ₹1.60 Lakh without land mortgage. 3% Prompt Repayment Incentive yielding effective 4% annual interest. Automatic conversion of short-term loans into 3 to 5 year medium-term loans upon declared natural disaster.
2. Multi-State Co-operative Societies (Amendment) Act, 2023 (MSCS Act 2023): Section 45 Cooperative Election Authority (CEA) for fair scheduled elections; Section 85 Cooperative Ombudsman for mandatory 30-day resolution of member complaints; Section 106 Cooperative Information Officer (CIO) for right to inspect accounts and voter rolls; Sections 84 and 86 statutory arbitration before the Central Registrar.
3. PMFBY Operational Guidelines Section 14: Mandatory 72-hour reporting window for localized calamities (hailstorm, inundation, landslide) with individual farm plot loss assessment; 25% immediate on-account payout for mid-season adversity; post-harvest loss coverage up to 14 days in cut-and-spread condition; direct DBT transfer into bank account with strict prohibition on bank/PACS lien or unauthorized loan deduction.
4. KCC Modified Interest Subvention Scheme (MISS) & RBI Master Directions: Net 4% annual interest for timely repayment up to ₹3 Lakh; collateral-free and mortgage-free credit up to ₹1.60 Lakh (up to ₹2 Lakh with tie-up); full eligibility for tenant farmers and Joint Liability Groups (JLGs) without land patta.
5. Fertilizer (Control) Order 1985 & Essential Commodities Act 1955: Clause 3 strict MRP enforcement (overcharging even ₹1 is a non-bailable offense under ECA Section 7); Clause 21 mandatory 60% PACS fertilizer stock reservation for small and marginal farmers; strict ban on tie-in sales.
6. Seeds Act 1966 & Seed Control Order 1983: Sections 6 and 7 mandatory certified labeling (germination %, purity %, expiry); Section 13 3-part sealed sampling; Section 15 right to 100% financial compensation for crop loss due to defective or spurious seeds.
7. Consumer Protection Act 2019: Farmers recognized as statutory consumers under Section 2(7); Chapter VI (Sections 82 to 87) strict Product Liability against manufacturers and dealers for spurious seeds, fake pesticides, defective drip systems, or faulty tractors; free online e-Daakhil filing up to ₹50 Lakh with zero court fees under ₹5 Lakh.
8. National PACS Computerization & CSC Rules: Cloud-based National ERP integration with NABARD; statutory right to instant printed computerized receipts for all loan, share, and fertilizer transactions; PACS delivery of 300+ village e-governance services.
9. Tamil Nadu Cooperative Societies Act 1983 & State Acts: Section 90 binding arbitration within 90 days with zero court fees; Section 74 member right to inspect audited accounts; Section 81 statutory inquiry into corruption or fund diversion.
10. Right to Information (RTI) Act 2005: Section 6 requests in regional languages (₹10 fee, free for BPL); Section 7 mandatory 30-day deadline with personal penalty of ₹250 per day up to ₹25,000 on defaulting Public Information Officers (PIO).
11. All 15+ Central & State Schemes (PM-KISAN, PM-KMY, PMKSY Drip 100%, PM-KUSUM Solar 70%, AIF 3% Subvention, SMAM Machinery 50%, SDRF Disaster Relief, TANGEDCO Free Power).

AUTOMATED FORMAL LEGAL GRIEVANCE PETITION DRAFTING:
Whenever a farmer reports a violation, denial, overcharging, fake inputs, crop disaster, or asks for a complaint or petition:
ALWAYS generate a clean, official, and ready-to-submit Legal Grievance Petition:
- State the exact Addressee Authority (e.g. Deputy Registrar of Cooperative Societies, Cooperative Ombudsman, District Collector, Banking Ombudsman, or District Consumer Disputes Redressal Commission).
- Subject line with the exact Act and Section violated.
- Complainant particulars (Farmer name, Village, Land, Crop).
- Concise chronological statement of facts.
- Statutory grounds citing specific section and rights.
- Specific prayers and penalties demanded (immediate loan disbursal, full refund of overcharged amount, 100% crop loss compensation, suspension of dealer license).
- Followed by submission instructions: where to submit, documents to attach, and the statutory timeline by which the authority must pass an order.

CRITICAL FORMATTING RULES FOR NATURAL VOICE & TTS:
1. NEVER output Markdown tables (| ... |). Write clean explanatory lists instead.
2. NEVER output horizontal dividers or repeated dashes (like ---, ___, ===).
3. NEVER use slashes (/) between words; write 'or' or comma instead.
4. NEVER use underscores (_) or asterisks (*); write clean plain text.
5. Do NOT use dashes (-) as bullet points so the text-to-speech engine never speaks 'dash dash'. Use numbers (1., 2.) or clean sentences.`;

    const sanitizedHistory = sanitizeHistory(history);
    const fallbackUserContent = hasImage
      ? [
        {
          type: "text",
          text:
            message ||
            "Analyze this farm image. Identify crop/weed/disease/pest signs if any, and give clear treatment steps."
        },
        {
          type: "image_url",
          image_url: { url: imageBase64 }
        }
      ]
      : (message || "Help me with my farm.");

    const messages = [
      { role: "system", content: systemInstruction }
    ];

    if (typeof farmerContext === "string" && farmerContext.trim()) {
      messages.push({
        role: "system",
        content: `Farmer profile context: ${farmerContext.trim()}`
      });
    }

    // Scheme RAG Knowledge Injection
    const userQueryLower = String(message || "").toLowerCase();
    const isSchemeQuery = /scheme|yojana|pmfby|pm-kisan|pmkisan|kcc|subsidy|insurance|pacs|cooperative|loan|solar|drip|machinery|government|gov|policy|grant|pension|subvention|relief/i.test(userQueryLower);
    if (isSchemeQuery && schemesDataset.length > 0) {
      const schemeContextStr = schemesDataset.map(s => 
        `Scheme: ${s.name} (${s.state_scope})\nCategory: ${s.category}\nBenefits: ${s.benefits}\nEligibility: ${Array.isArray(s.eligibility) ? s.eligibility.join("; ") : s.eligibility}\nDocuments: ${Array.isArray(s.documents_required) ? s.documents_required.join(", ") : s.documents_required}\nHow to apply: ${s.application_process}\nLink: ${s.official_link}`
      ).join("\n\n");

      messages.push({
        role: "system",
        content: `Official Government Schemes Database Knowledge (Central & Tamil Nadu):\n${schemeContextStr}`
      });
    }

    // Data.gov.in Market Arrivals & MSME RAG Knowledge Injection
    const isMarketOrPriceQuery = /price|rate|mandi|market|arrival|quintal|paddy|tomato|chilli|cotton|sugarcane|coconut|cost|sale|sell|udyam|msme|processing|cooperative|unit/i.test(userQueryLower);
    if (isMarketOrPriceQuery) {
      const marketStr = MARKET_ARRIVALS_DATA.map(m => 
        `Commodity: ${m.commodity} | State: ${m.state} | Market: ${m.market} | Monthly Arrival: ${m.arrival_tonnes} tonnes | Modal Price: ₹${m.modal_price_rs_quintal}/quintal (Range: ₹${m.min_price} - ₹${m.max_price})`
      ).join("\n");

      const msmeStr = MSME_UDYAM_UNITS_DATA.map(u => 
        `Udyam No: ${u.udyam_registration_no} | Name: ${u.enterprise_name} | Category: ${u.category} | Sector: ${u.sector} | District: ${u.district}`
      ).join("\n");

      messages.push({
        role: "system",
        content: `Official Data.gov.in Agricultural Product Prices & Market Arrivals:\n${marketStr}\n\nRegistered MSME Agricultural & PACS Units under UDYAM (data.gov.in):\n${msmeStr}`
      });
    }

    // Legal Docs Supabase Cloud RAG Knowledge Injection (Laws, PACS Bye-Laws, MSCS, Seed Act, FCO, KCC, PMFBY, Consumer Protection & Grievances)
    const isLegalQuery = /law|rule|bye-law|by-law|bylaw|grievance|dispute|complaint|rights|drcs|court|legal|section|act|penalty|audit|denied|denial|refus|member|seed|fertilizer|fco|inspection|inspector|compensation|pacs|clause|statute|regulation|legal_docs|document|folder|hoard|black market|mrp|overcharg|rti|ombudsman|election|mscs|pmfby|72 hour|72hr|calamity|inundation|collateral|mortgage|subvention|consumer|edaakhil|product liability|spurious|fake|cheated|scam|erp|receipt|computerized|bill|petition|appeal|draft|notice|letter/i.test(userQueryLower);
    if (isLegalQuery) {
      // 1. First inject structured Supabase Cloud Legal provisions & remedies
      const legalCloudContext = searchLegalContext(message);
      if (legalCloudContext) {
        messages.push({
          role: "system",
          content: `${legalCloudContext}\nINSTRUCTION: You are backed by the Supabase Cloud Legal Document Store. Cite the exact statutory Act, Section number, and the official grievance redressal procedure step-by-step. If the user is facing an issue or asks for a petition/complaint, draft the full formal legal grievance petition addressed to the competent authority (DRCS, Ombudsman, Collector, or Consumer Commission).`
        });
      }

      // 2. Try ChromaDB HTTP bridge if available
      try {
        const ragRes = await fetch('http://localhost:3005/rag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: message })
        });
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          if (ragData && ragData.prompt) {
            messages.push({ role: "system", content: ragData.prompt });
          }
        }
      } catch (err) {
        // HTTP bridge not running, Supabase Cloud RAG already provided full context above
      }
    }

    // Live IoT Sensor Telemetry RAG Knowledge Injection (read from log.json)
    const sensorContext = await getLatestSensorContext();
    if (sensorContext) {
      messages.push({
        role: "system",
        content: `${sensorContext}\nINSTRUCTION: The farmer's field sensors are live. When the user asks about soil moisture, whether to water/irrigate, temperature, weather effects on their crop, flood or drought risk, or asks how their farm/nodes are doing, ALWAYS answer using these real sensor readings directly with numbers and practical farming steps!`
      });
    }

    // Live Personalized Govt Schemes & Subsidies Knowledge Injection
    const schemesContext = getEligibleSchemesContext(farmerContext || {});
    if (schemesContext) {
      messages.push({
        role: "system",
        content: `${schemesContext}\nINSTRUCTION: If the farmer asks about government schemes, loans, KCC, subsidies, free electricity, solar pumps, seed kits, or disaster relief, directly recommend their 100% ELIGIBLE schemes listed above based on their exact land size and crop, detailing exact money amounts and how to apply!`
      });
    }

    messages.push(
      ...(sanitizedHistory.length > 0
        ? sanitizedHistory
        : [{ role: "user", content: fallbackUserContent }])
    );

    const response = await createGroqChatCompletion({
      messages,
      wantsVision: historyContainsImage(messages)
    });

    const reply = response?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({
        error: "Model returned an empty response for this image. Try a clearer image or smaller file."
      });
    }

    const detectedLanguage = detectMessageLanguage(message) || detectMessageLanguage(reply);

    res.json({
      reply,
      detectedLanguage
    });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err?.message || "Chat failed" });
  }
});

// ================= TRANSLATE CHAT HISTORY =================
app.post("/translate-history", async (req, res) => {
  try {
    const { history, targetLang } = req.body;
    if (!Array.isArray(history) || history.length === 0) return res.json({ history: [] });
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang || "English";

    const promptItems = history.map((item, idx) => {
      let text = "";
      if (typeof item.content === "string") {
        text = item.content;
      } else if (Array.isArray(item.content)) {
        text = item.content.find((p) => p.type === "text")?.text || "";
      }
      return `[[[${idx}]]] ${text}`;
    }).join("\n\n");

    const completion = await createGroqChatCompletion({
      messages: [
        {
          role: "system",
          content: `You are a professional multilingual translator for an Indian smart farming platform. Translate the given messages into ${targetName}. Maintain the exact [[[index]]] tags for each message. Output ONLY the translated messages with their [[[index]]] tags without any preamble or conversational text.`
        },
        {
          role: "user",
          content: promptItems
        }
      ],
      wantsVision: false
    });

    const translatedRaw = completion?.choices?.[0]?.message?.content || "";
    const updatedHistory = history.map((item, idx) => {
      const tag = `[[[${idx}]]]`;
      const nextTag = `[[[${idx + 1}]]]`;
      const start = translatedRaw.indexOf(tag);
      if (start === -1) return item;
      const contentStart = start + tag.length;
      const end = translatedRaw.indexOf(nextTag, contentStart);
      const translatedText = (end !== -1 ? translatedRaw.substring(contentStart, end) : translatedRaw.substring(contentStart)).trim();
      if (!translatedText) return item;

      if (typeof item.content === "string") {
        return { ...item, content: translatedText };
      } else if (Array.isArray(item.content)) {
        const newParts = item.content.map((p) => p.type === "text" ? { ...p, text: translatedText } : p);
        return { ...item, content: newParts };
      }
      return item;
    });

    res.json({ history: updatedHistory });
  } catch (err) {
    console.error("Translate history error:", err);
    res.json({ history: req.body.history || [] });
  }
});

// ================= 5-MINUTE SENSOR ANALYSIS & BOT NOTIFICATION =================
app.post("/sensor-analysis", async (req, res) => {
  try {
    const { readings, window_minutes } = req.body;
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: "No readings provided" });
    }

    const formattedData = readings.map(r => {
      if (r.length >= 8) {
        return `[${r[1]}] Temp:${r[2]}°C Hum:${r[3]}% Soil:${r[4]}% Rain:${r[5]}% FloodRisk:${r[6]} DroughtRisk:${r[7]}`;
      } else if (r.length === 5) {
        return `Temp:${r[1]}°C Hum:${r[2]}% Soil:${r[3]}% Rain:${r[4]}%`;
      } else {
        return r.join(" ");
      }
    }).join("\n");

    const prompt = `
You are an expert agriculture AI. Analyze this ${window_minutes || 5}-minute telemetry window from the farmer's multi-node IoT sensors (e.g. NODE_01 and NODE_02).

Field Telemetry:
${formattedData}

Analyse:
1. Soil condition and moisture balance across nodes
2. Microclimate / temperature & humidity risks
3. Flood or drought risk
4. Immediate farming recommendations

Respond EXACTLY in this format:
Health: <Good/Moderate/Critical>
Reason: <1-2 short sentences diagnosing field conditions and comparing nodes if applicable>
Action: <clear, actionable irrigation or field recommendation for the farmer>
`;

    const response = await createGroqChatCompletion({
      messages: [{ role: "user", content: prompt }]
    });

    const result = response.choices[0].message.content;
    const parsed = parseAnalysisResult(result);

    const entry = {
      id: makeId("analysis"),
      time: new Date(),
      result
    };

    sensorHistory.push(entry);
    trimList(sensorHistory, 100);

    // Push high-priority notification to the bot interface
    createNotification({
      msg: parsed.action || "New 5-minute farm AI diagnosis is ready.",
      details: result,
      kind: "sensor-suggestion",
      source: "sensor-analysis",
      undoable: true,
      linkedAnalysisId: entry.id
    });

    // Rule-based safety alerts on the latest reading
    const last = readings[readings.length - 1];
    if (last) {
      const isMulti = last.length >= 8;
      const nodeId = isMulti ? last[1] : "NODE_01";
      const temp = parseFloat(isMulti ? last[2] : last[1]);
      const hum = parseFloat(isMulti ? last[3] : last[2]);
      const soil = parseFloat(isMulti ? last[4] : last[3]);
      const rain = parseFloat(isMulti ? last[5] : last[4]);
      const flood = isMulti ? last[6] : "NO";

      if (soil < 25) {
        createNotification({
          msg: `⚠️ Soil is dry in [${nodeId}] (${soil}%). Irrigation is needed immediately.`,
          kind: "alert",
          source: "sensor-rule"
        });
      }
      if (rain > 50) {
        createNotification({
          msg: `🌧️ Heavy rain detected at [${nodeId}] (${rain}%). Stop irrigation.`,
          kind: "alert",
          source: "sensor-rule"
        });
      }
      if (flood === "HIGH") {
        createNotification({
          msg: `🚨 High flood risk detected at [${nodeId}]. Inspect field drainage channels.`,
          kind: "alert",
          source: "sensor-rule"
        });
      }
      if (temp > 35) {
        createNotification({
          msg: `☀️ High temperature detected at [${nodeId}] (${temp}°C).`,
          kind: "alert",
          source: "sensor-rule"
        });
      }
    }

    res.json({ result });

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

// ================= LATEST 1-MINUTE SENSOR DATA API =================
app.get("/api/sensor-data/latest", async (req, res) => {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf-8");
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch {
      entries = JSON.parse(raw.replace(/\bNaN\b/g, "null").replace(/\bInfinity\b/g, "null"));
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ status: "no_data", latest: null });
    }
    res.json({
      status: "success",
      latest: entries[entries.length - 1],
      total_entries: entries.length
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ================= SCHEMES & ELIGIBILITY ENGINE (STEP 2 & 3) =================
function evaluateSchemeEligibility(scheme, profile = {}) {
  const acres = parseFloat(profile.acres || profile.land || 2.5);
  const state = String(profile.state || "Tamil Nadu").toLowerCase();
  const crop = String(profile.crop || "").toLowerCase();
  const irrigation = String(profile.irrigation || "").toLowerCase();
  const age = parseInt(profile.age || 40, 10);
  const rules = scheme.rules || {};

  let score = 100;
  const reasons = [];

  // Land size checks
  if (rules.max_land_acres !== null && rules.max_land_acres !== undefined && acres > rules.max_land_acres) {
    score -= 45;
    reasons.push(`Land size (${acres} acres) exceeds small/marginal limit of ${rules.max_land_acres} acres`);
  } else if (rules.min_land_acres && acres < rules.min_land_acres) {
    score -= 35;
    reasons.push(`Minimum land requirement is ${rules.min_land_acres} acres`);
  } else {
    reasons.push(`Matches your ${acres} acres landholding`);
  }

  // State checks
  const appStates = (rules.applicable_states || ["All"]).map(s => s.toLowerCase());
  if (!appStates.includes("all")) {
    const stateMatched = appStates.some(s => state.includes(s) || s.includes(state));
    if (!stateMatched) {
      score -= 50;
      reasons.push(`Only applicable in: ${rules.applicable_states.join(", ")}`);
    } else {
      reasons.push(`Applicable in ${profile.state || "Tamil Nadu"}`);
    }
  }

  // Age checks (e.g. PM-KMY 18-40)
  if (rules.min_age && age < rules.min_age) {
    score -= 40;
    reasons.push(`Minimum age is ${rules.min_age} years`);
  }
  if (rules.max_age && age > rules.max_age) {
    score -= 40;
    reasons.push(`Maximum age is ${rules.max_age} years (your age: ${age})`);
  }

  // Irrigation check (e.g. PMKSY, Solar Pumps, TANGEDCO)
  if (rules.requires_irrigation) {
    const hasWater = irrigation.includes("well") || irrigation.includes("bore") || irrigation.includes("canal") || irrigation.includes("drip");
    if (!hasWater && irrigation.includes("rainfed")) {
      score -= 25;
      reasons.push(`Requires active well/borewell water source`);
    } else {
      reasons.push(`Verified for ${profile.irrigation || "borewell"} irrigation source`);
    }
  }

  let matchStatus = "100% ELIGIBLE";
  if (score >= 90) {
    matchStatus = "100% ELIGIBLE";
  } else if (score >= 60) {
    matchStatus = "HIGH MATCH";
  } else {
    matchStatus = "INELIGIBLE";
  }

  return {
    match_status: matchStatus,
    match_score: Math.max(15, score),
    reasons: reasons.slice(0, 3)
  };
}

function getEligibleSchemesContext(farmerContext = {}) {
  if (!Array.isArray(schemesDataset) || schemesDataset.length === 0) return "";
  const evaluated = schemesDataset.map(s => {
    const ev = evaluateSchemeEligibility(s, farmerContext);
    return {
      name: s.name,
      benefit: s.benefit_summary || s.benefits,
      status: ev.match_status,
      docs: (s.documents_required || []).join(", ")
    };
  }).filter(s => s.status === "100% ELIGIBLE");

  let info = `[FARMER SPECIFIC 100% ELIGIBLE GOVERNMENT SCHEMES & SUBSIDIES]\n`;
  info += `Farmer Profile: Land: ${farmerContext.acres || "2.5"} acres, Crop: ${farmerContext.crop || "Paddy"}, Location: ${farmerContext.state || "Tamil Nadu"}\n`;
  evaluated.slice(0, 6).forEach(s => {
    info += `• ${s.name}: ${s.benefit} (Documents Needed: ${s.docs})\n`;
  });
  return info;
}

// ================= SCHEMES API =================
app.get("/api/schemes", (req, res) => {
  res.json({
    total: schemesDataset.length,
    schemes: schemesDataset
  });
});

app.post("/api/schemes/eligible", (req, res) => {
  const profile = req.body || {};
  const evaluated = schemesDataset.map(s => {
    const evalResult = evaluateSchemeEligibility(s, profile);
    return {
      ...s,
      ...evalResult
    };
  });

  // Sort so 100% ELIGIBLE schemes come first
  evaluated.sort((a, b) => b.match_score - a.match_score);

  const eligibleCount = evaluated.filter(s => s.match_status === "100% ELIGIBLE").length;

  res.json({
    total: evaluated.length,
    eligible_count: eligibleCount,
    schemes: evaluated
  });
});


// ================= DATA.GOV.IN MARKET ARRIVALS & PRICES API =================
app.get("/api/datagov/market-arrivals", async (req, res) => {
  const records = await fetchDataGovResource(DATA_GOV_RESOURCE_MARKET_ARRIVAL, MARKET_ARRIVALS_DATA);
  res.json({
    source: "data.gov.in / AGMARKNET",
    resourceId: DATA_GOV_RESOURCE_MARKET_ARRIVAL,
    total: records.length,
    records
  });
});

// ================= DATA.GOV.IN MSME UDYAM REGISTERED UNITS API =================
app.get("/api/datagov/msme-units", async (req, res) => {
  const records = await fetchDataGovResource(DATA_GOV_RESOURCE_MSME, MSME_UDYAM_UNITS_DATA);
  res.json({
    source: "data.gov.in / Ministry of MSME UDYAM Portal",
    resourceId: DATA_GOV_RESOURCE_MSME,
    total: records.length,
    records
  });
});

// ================= GET ANALYSIS =================
app.get("/sensor-history", (req, res) => {
  res.json(sensorHistory);
});

// ================= GET ALERTS =================
app.get("/notifications", (req, res) => {
  res.json(notifications.slice(-20));
});

app.post("/notifications/:id/undo", (req, res) => {
  const { id } = req.params;
  const idx = notifications.findIndex(item => item.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Notification not found" });
  }

  const [removed] = notifications.splice(idx, 1);

  res.json({
    ok: true,
    removedId: id,
    linkedAnalysisId: removed.linkedAnalysisId || null
  });
});

// ================= WEATHER ALERT =================
app.get("/weather-alert", (req, res) => {
  try {
    const weatherMsg = "No rain expected today.";
    res.json({ msg: weatherMsg });

  } catch (err) {
    console.error("Weather error:", err);
    res.status(500).json({ error: "Weather failed" });
  }
});


// ================= LATEST FARM WEALTH =================
app.get("/farm-wealth", async (req, res) => {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf-8");
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch {
      // Backward compatibility: older log.json may contain bare NaN tokens.
      entries = JSON.parse(raw.replace(/\bNaN\b/g, "\"NaN\""));
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ farmWealth: null, timestamp: null, average: null });
    }

    const last = entries[entries.length - 1];
    res.json({
      farmWealth: last.farm_wealth ?? null,
      timestamp: last.timestamp ?? null,
      average: last.average ?? null,
      windowSeconds: last.window_seconds ?? 10
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ farmWealth: null, timestamp: null, average: null });
    }
    console.error("Farm wealth read error:", err);
    res.status(500).json({ error: "Failed to read farm wealth log" });
  }
});

// ================= FARM WEALTH HISTORY =================
app.get("/farm-wealth/history", async (req, res) => {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf-8");
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch {
      entries = JSON.parse(raw.replace(/\bNaN\b/g, "\"NaN\""));
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ items: [] });
    }

    const items = entries
      .slice(-20)
      .reverse()
      .map((x) => ({
        timestamp: x.timestamp ?? null,
        average: x.average ?? null
      }));

    res.json({ items });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ items: [] });
    }
    console.error("Farm wealth history read error:", err);
    res.status(500).json({ error: "Failed to read farm wealth history" });
  }
});

// ================= 100% FREE GOOGLE TTS SYNTHESIZER =================
// Uses public Google Translate TTS endpoint (client=tw-ob)
// No API key or billing required. Supports Tamil, Hindi, Telugu, Kannada, Malayalam, etc.
function splitTextForTts(text, maxLen = 180) {
  const cleanText = String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[#*_`~]/g, "")
    .trim();

  if (!cleanText) return [];

  const sentences = cleanText.match(/[^.!?\n]+[.!?\n]*/g) || [cleanText];
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLen) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      if (sentence.length > maxLen) {
        const words = sentence.split(" ");
        let wordChunk = "";
        for (const w of words) {
          if ((wordChunk + " " + w).length <= maxLen) {
            wordChunk += (wordChunk ? " " : "") + w;
          } else {
            if (wordChunk.trim()) chunks.push(wordChunk.trim());
            wordChunk = w;
          }
        }
        currentChunk = wordChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

async function synthesizeFreeGoogleTts({ text, languageCode }) {
  const langMap = {
    "hi-IN": "hi", "ta-IN": "ta", "te-IN": "te", "kn-IN": "kn",
    "ml-IN": "ml", "mr-IN": "mr", "gu-IN": "gu", "bn-IN": "bn",
    "pa-IN": "pa", "ur-PK": "ur", "en-IN": "en", "en-US": "en"
  };
  const lang = langMap[languageCode] || (languageCode ? languageCode.split("-")[0] : "en");
  const chunks = splitTextForTts(text, 180);
  if (!chunks.length) {
    throw new Error("No text provided for TTS");
  }

  const audioBuffers = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!resp.ok) {
      throw new Error(`Google TTS endpoint returned HTTP ${resp.status}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    audioBuffers.push(Buffer.from(arrayBuffer));
  }

  return Buffer.concat(audioBuffers);
}

// ================= FAST GROQ WHISPER STT (IN-MEMORY & AUTO-DETECT) =================
function mapWhisperLangToCode(whisperLang) {
  if (!whisperLang) return null;
  const l = String(whisperLang).toLowerCase().trim();
  if (l.includes("ta") || l.includes("tamil")) return "ta-IN";
  if (l.includes("hi") || l.includes("hindi")) return "hi-IN";
  if (l.includes("te") || l.includes("telugu")) return "te-IN";
  if (l.includes("kn") || l.includes("kannada")) return "kn-IN";
  if (l.includes("ml") || l.includes("malayalam")) return "ml-IN";
  if (l.includes("mr") || l.includes("marathi")) return "mr-IN";
  if (l.includes("gu") || l.includes("gujarati")) return "gu-IN";
  if (l.includes("bn") || l.includes("bengali")) return "bn-IN";
  if (l.includes("pa") || l.includes("punjabi")) return "pa-IN";
  if (l.includes("ur") || l.includes("urdu")) return "ur-PK";
  if (l.includes("en") || l.includes("english")) return "en-IN";
  return null;
}

app.post("/stt", async (req, res) => {
  try {
    const { audioBase64, mimeType, languageCode } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== "string" || !audioBase64.includes(",")) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const base64Data = audioBase64.split(",")[1];
    const audioBuffer = Buffer.from(base64Data, "base64");
    if (!audioBuffer.length) {
      return res.status(400).json({ error: "Invalid audio payload" });
    }

    const safeMime = String(mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
    const extensionMap = {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav"
    };
    const ext = extensionMap[safeMime] || "webm";

    let transcriptResp;
    try {
      // In-memory file object
      const file = await toFile(audioBuffer, `speech.${ext}`, { type: safeMime });
      transcriptResp = await client.audio.transcriptions.create({
        file,
        model: "whisper-large-v3-turbo",
        response_format: "verbose_json",
        temperature: 0.0
      });
    } catch (inMemoryErr) {
      console.warn("In-memory STT failed, using temp file fallback:", inMemoryErr?.message);
      const tmpPath = path.join(__dirname, `tmp-stt-${Date.now()}.${ext}`);
      await fs.writeFile(tmpPath, audioBuffer);
      try {
        transcriptResp = await client.audio.transcriptions.create({
          file: createReadStream(tmpPath),
          model: "whisper-large-v3-turbo",
          response_format: "verbose_json",
          temperature: 0.0
        });
      } finally {
        await fs.unlink(tmpPath).catch(() => { });
      }
    }

    let text = String(transcriptResp?.text || "").trim();

    // Filter out common Whisper silence hallucinations
    const hallucinationPatterns = [
      /^thank\s*you\.?$/i,
      /^thank\s*you\s*for\s*watching\.?$/i,
      /^thanks\s*for\s*watching\.?$/i,
      /^subtitles\s*by/i,
      /^amara\.org/i,
      /^bye\.?$/i,
      /^you$/i
    ];

    if (hallucinationPatterns.some(pattern => pattern.test(text))) {
      text = "";
    }

    if (!text) {
      return res.status(422).json({ error: "No speech detected in audio. Please speak louder or closer to the mic." });
    }

    const detectedLanguage = mapWhisperLangToCode(transcriptResp?.language) || detectMessageLanguage(text);
    return res.json({ transcript: text, detectedLanguage });
  } catch (err) {
    console.error("Groq Whisper STT error:", err);
    return res.status(500).json({ error: err?.message || "Speech-to-text failed" });
  }
});

// ================= FREE GOOGLE TTS ENDPOINT =================
app.post("/tts", async (req, res) => {
  try {
    const { text, languageCode } = req.body || {};
    const audioBuffer = await synthesizeFreeGoogleTts({ text, languageCode });
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (err) {
    console.error("Free TTS error:", err);
    res.status(500).json({ error: err?.message || "TTS synthesis failed" });
  }
});

// ================= LEGACY /azure-tts REDIRECT =================
app.post("/azure-tts", async (req, res) => {
  req.url = "/tts";
  app.handle(req, res);
});

// ================= TRANSLATE PROXY =================
app.post("/translate", (req, res) => {
  const { text } = req.body || {};
  res.json({ translatedText: text || "" });
});

// ================= QUERY 3: 1-MIN AVERAGE & 10-MIN AUTOMATED AI ADVISORY =================
let tenMinuteHistory = [];
let rawReadingsBuffer = [];
let last10MinAnalysisTimestamp = 0;

// Sync live telemetry rows from Google Apps Script Web App
async function syncTelemetryFromGoogleSheet() {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) return;
  try {
    const res = await fetch(`${scriptUrl}?action=get_rows&limit=30`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === "success" && Array.isArray(data.rows) && data.rows.length > 0) {
      for (const row of data.rows) {
        if (!rawReadingsBuffer.some(r => r.timestamp === row.timestamp && r.node_id === row.node_id)) {
          rawReadingsBuffer.push(row);
        }
      }
      trimList(rawReadingsBuffer, 200);
      computeOneMinuteAverageAndLog();
    }
  } catch (err) {
    // Non-blocking
  }
}

function computeOneMinuteAverageAndLog() {
  if (rawReadingsBuffer.length === 0) return;
  const recent = rawReadingsBuffer.slice(-15);
  let sumT = 0, sumH = 0, sumS = 0, sumR = 0, count = 0;
  let nodes = {};

  for (const r of recent) {
    const t = parseFloat(r.temperature);
    const h = parseFloat(r.humidity);
    const s = parseFloat(r.soil_moisture);
    const rain = parseFloat(r.rain_intensity);
    if (!isNaN(t) && !isNaN(h) && !isNaN(s)) {
      sumT += t; sumH += h; sumS += s; sumR += isNaN(rain) ? 0 : rain;
      count++;
      const nid = r.node_id || "NODE_01";
      if (!nodes[nid]) nodes[nid] = { count: 0, sumT: 0, sumS: 0, sumR: 0, light: r.light || "DARK" };
      nodes[nid].count++;
      nodes[nid].sumT += t;
      nodes[nid].sumS += s;
      nodes[nid].sumR += isNaN(rain) ? 0 : rain;
      nodes[nid].light = r.light || nodes[nid].light;
    }
  }

  if (count === 0) return;

  const avgEntry = {
    timestamp: new Date().toLocaleTimeString(),
    average: {
      temperature: Math.round((sumT / count) * 10) / 10,
      humidity: Math.round((sumH / count) * 10) / 10,
      soil: Math.round((sumS / count) * 10) / 10,
      rain: Math.round((sumR / count) * 10) / 10
    },
    soil_status: (sumS / count) < 25 ? "DRY (Irrigation Needed)" : "OPTIMAL",
    farm_wealth: Math.min(100, Math.max(20, Math.round(((sumS / count) * 0.4) + ((sumH / count) * 0.3) + 30))),
    nodes: {}
  };

  for (const [nid, n] of Object.entries(nodes)) {
    avgEntry.nodes[nid] = {
      temperature: Math.round((n.sumT / n.count) * 10) / 10,
      soil_moisture: Math.round((n.sumS / n.count) * 10) / 10,
      rain_intensity: Math.round((n.sumR / n.count) * 10) / 10,
      light: n.light,
      status: "Active"
    };
  }

  fs.readFile(LOG_PATH, "utf-8").then(raw => {
    let entries = [];
    try { entries = JSON.parse(raw); } catch {}
    if (!Array.isArray(entries)) entries = [];
    entries.push(avgEntry);
    trimList(entries, 120);
    return fs.writeFile(LOG_PATH, JSON.stringify(entries, null, 2));
  }).catch(() => {
    fs.writeFile(LOG_PATH, JSON.stringify([avgEntry], null, 2)).catch(() => {});
  });
}

async function triggerTenMinuteAutomatedAnalysis() {
  const now = Date.now();
  last10MinAnalysisTimestamp = now;

  try {
    const sensorContext = await getLatestSensorContext();
    const prompt = `You are a Senior Agricultural Scientist and IoT Crop Health Expert.
Conduct an automated 10-Minute Crop Health & Microclimate Diagnostic for the farmer based on this 10-minute field trend:
${sensorContext || "Temperature: 29°C, Humidity: 65%, Soil Moisture: 45%, Rain: 0%, Sunlight: BRIGHT"}

Provide a structured, authoritative report in this format:
Risk Level: <LOW / MODERATE / HIGH / CRITICAL>
Diagnosis: <2 sentences assessing root zone moisture, heat stress, and fungal/pest vulnerability>
Recommended Actions:
1. <Action step for irrigation or soil management>
2. <Action step for pest or crop protection>
3. <Action step for nutrient or fertilizer scheduling>`;

    const completion = await createGroqChatCompletion({
      messages: [{ role: "user", content: prompt }]
    });

    const reportText = completion?.choices?.[0]?.message?.content || "";
    const riskMatch = reportText.match(/Risk Level:\s*(LOW|MODERATE|HIGH|CRITICAL)/i);
    const riskLevel = riskMatch ? riskMatch[1].toUpperCase() : "LOW";

    const reportItem = {
      id: makeId("advisory-10m"),
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      riskLevel,
      report: reportText,
      sensorSummary: sensorContext ? sensorContext.slice(0, 240) : "Optimal sensor range"
    };

    tenMinuteHistory.unshift(reportItem);
    trimList(tenMinuteHistory, 50);

    createNotification({
      msg: `🔔 10-Min AI Advisory [Risk: ${riskLevel}]`,
      details: reportText,
      kind: riskLevel === "CRITICAL" || riskLevel === "HIGH" ? "alert" : "sensor-suggestion",
      source: "automated-10min",
      linkedAnalysisId: reportItem.id
    });

    console.log(`[10-MIN AUTOMATED AI ADVISORY GENERATED] Risk: ${riskLevel}`);
    return reportItem;
  } catch (err) {
    console.error("10-Min Automated Advisory error:", err?.message || err);
    return null;
  }
}

// 10-Minute Advisory History Endpoints
app.get("/api/10min-history", (req, res) => {
  res.json({
    total: tenMinuteHistory.length,
    history: tenMinuteHistory
  });
});

app.post("/api/10min-history/trigger", async (req, res) => {
  const result = await triggerTenMinuteAutomatedAnalysis();
  res.json({ success: true, advisory: result });
});

// ================= SUPABASE CLOUD LEGAL REPOSITORY ENDPOINTS =================
app.get("/api/legal/documents", (req, res) => {
  const enhancedDocs = legalDataset.map(doc => ({
    ...doc,
    supabase_pdf_url: `${SUPABASE_BASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(doc.filename)}`,
    local_pdf_url: `/legal_docs/${encodeURIComponent(doc.filename)}`,
    cloud_bucket: SUPABASE_BUCKET,
    region: "ap-south-1 (Mumbai, India)"
  }));
  res.json({
    success: true,
    count: enhancedDocs.length,
    supabase_url: SUPABASE_BASE_URL,
    documents: enhancedDocs
  });
});

app.post("/api/legal/query", (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  const context = searchLegalContext(query);
  const q = String(query).toLowerCase();
  const matchedDocs = legalDataset.filter(doc => {
    const text = `${doc.title} ${doc.category} ${doc.summary} ${doc.grievance_steps} ${doc.key_sections.map(s => s.section + ' ' + s.title).join(' ')}`.toLowerCase();
    return q.split(/\s+/).some(w => w.length > 3 && text.includes(w));
  });

  res.json({
    success: true,
    query,
    context_injected: Boolean(context),
    matched_count: matchedDocs.length,
    matched_documents: matchedDocs.map(doc => ({
      ...doc,
      supabase_pdf_url: `${SUPABASE_BASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(doc.filename)}`,
      local_pdf_url: `/legal_docs/${encodeURIComponent(doc.filename)}`
    }))
  });
});

app.get("/api/supabase/status", (req, res) => {
  res.json({
    success: true,
    supabase: supabaseStatus
  });
});

app.post("/api/supabase/sync", async (req, res) => {
  await syncLegalDocsToSupabase();
  res.json({
    success: true,
    supabase: supabaseStatus
  });
});

// Start Background Services
setInterval(syncTelemetryFromGoogleSheet, 15000);   // Poll sheet every 15s
setInterval(() => {
  const now = Date.now();
  if (now - last10MinAnalysisTimestamp >= 10 * 60 * 1000) {
    triggerTenMinuteAutomatedAnalysis();
  }
}, 60000); // Check 10-min timer every 60s

// Generate initial sample advisory 10s after startup
setTimeout(() => {
  if (tenMinuteHistory.length === 0) {
    triggerTenMinuteAutomatedAnalysis();
  }
}, 10000);

// Auto-sync legal documents to Supabase Cloud on startup (3 seconds after boot)
setTimeout(() => {
  syncLegalDocsToSupabase();
}, 3000);

// ================= START SERVER =================
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


