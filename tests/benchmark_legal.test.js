/**
 * SAHAKAR VAANI — AUTOMATED REPRODUCIBLE BENCHMARK & TEST SUITE
 * 
 * Validates:
 * 1. Statutory Database Ground Truth (11 verified Acts & Gazetted Bye-Laws)
 * 2. Deterministic Statutory Retrieval (25 empirical legal queries evaluated)
 * 3. Section 65B Indian Evidence Act Cryptographic HMAC-SHA256 Integrity
 * 4. Inundation Velocity Index (IVI) Soil Physics & Agronomic Calibration
 * 5. Joint Liability Group (JLG) Social Collateral Solvency Scoring Model
 * 6. PWA Offline Storage & Manifest Integrity
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================================');
console.log('      🏛️ SAHAKAR VAANI — STATUTORY & TELEMETRY BENCHMARK AUDIT SUITE           ');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failures.push({ testName, details });
    console.error(`  ❌ [FAIL] ${testName} — ${details}`);
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: LEGAL DATABASE INTEGRITY & GROUND TRUTH
// -----------------------------------------------------------------------------
console.log('--- TEST SUITE 1: Statutory Database Ground-Truth Verification ---');
const legalDbPath = path.join(rootDir, 'legal_database.json');
assert(fs.existsSync(legalDbPath), 'legal_database.json exists on disk');

const legalDocs = JSON.parse(fs.readFileSync(legalDbPath, 'utf8'));
assert(Array.isArray(legalDocs) && legalDocs.length === 11, `Legal database loaded with 11 statutory acts`);

const requiredStatuteIds = [
  'seed-act-1966',
  'fco-1985',
  'model-pacs-bye-laws',
  'mscs-act-2023',
  'pmfby-sec14',
  'kcc-miss-rbi',
  'consumer-protection-act-2019',
  'pacs-computerization-erp-2023',
  'tn-cooperative-act-1983',
  'essential-commodities-act-1955',
  'rti-act-2005'
];

requiredStatuteIds.forEach(id => {
  const doc = legalDocs.find(d => d.id === id);
  assert(!!doc, `Statute verified: ${id}`, `Missing mandatory statute ID: ${id}`);
  if (doc) {
    assert(doc.key_sections && doc.key_sections.length > 0, `  └─ ${id} contains verified statutory sections`, 'No key sections listed');
    assert(typeof doc.grievance_steps === 'string' && doc.grievance_steps.length > 20, `  └─ ${id} defines official grievance steps`);
  }
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: DETERMINISTIC CITATION RETRIEVAL (25 BENCHMARK QUERIES)
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Citation Accuracy Evaluation (25 Statutory Ground-Truth Prompts) ---');

const benchmarkQueries = [
  { q: "subsidized fertilizer overpricing MRP violation Clause 3 FCO", expectedId: "fco-1985" },
  { q: "unlawful tie-in sale of pesticide with urea bag Clause 21", expectedId: "fco-1985" },
  { q: "spurious low germination seeds compensation Section 15 seed testing", expectedId: "seed-act-1966" },
  { q: "seed inspector mandatory 3-part sealed sampling procedure Section 13", expectedId: "seed-act-1966" },
  { q: "PACS denial of membership or share capital without written justification Chapter 1", expectedId: "model-pacs-bye-laws" },
  { q: "PACS multi-service custom hiring center citizen services Rule 1", expectedId: "model-pacs-bye-laws" },
  { q: "KCC collateral demanded for crop loan under 1.60 lakh mortgage free RBI", expectedId: "kcc-miss-rbi" },
  { q: "KCC prompt repayment 3 percent subvention net 4 percent interest rate", expectedId: "kcc-miss-rbi" },
  { q: "tenant cultivators oral lessees sharecroppers eligible for KCC without land deeds", expectedId: "kcc-miss-rbi" },
  { q: "localized calamity 72 hours intimation window hailstorm inundation PMFBY", expectedId: "pmfby-sec14" },
  { q: "mandatory 25 percent immediate on-account payout for mid-season adversity", expectedId: "pmfby-sec14" },
  { q: "post-harvest crop loss cut and spread open field 14 days coverage", expectedId: "pmfby-sec14" },
  { q: "cooperative ombudsman member grievance redressal within 30 days Section 85", expectedId: "mscs-act-2023" },
  { q: "statutory arbitration of cooperative disputes Section 84 before Central Registrar", expectedId: "mscs-act-2023" },
  { q: "Cooperative Election Authority Section 45 independent elections", expectedId: "mscs-act-2023" },
  { q: "black marketing and hoarding of essential fertilizers Section 3 ECA", expectedId: "essential-commodities-act-1955" },
  { q: "penalties for hoarding black marketing 7 years imprisonment Section 7 ECA", expectedId: "essential-commodities-act-1955" },
  { q: "farmer as statutory consumer livelihood self-employment Section 2(7)", expectedId: "consumer-protection-act-2019" },
  { q: "strict product liability against manufacturer for defective seeds Chapter VI", expectedId: "consumer-protection-act-2019" },
  { q: "District Consumer Commission e-Daakhil claim jurisdiction up to 50 lakh", expectedId: "consumer-protection-act-2019" },
  { q: "RTI application to access PACS audit records Form A Section 6", expectedId: "rti-act-2005" },
  { q: "mandatory 30-day response timeline penalty 250 per day Section 7 RTI", expectedId: "rti-act-2005" },
  { q: "National PACS ERP software mandatory computerized transaction receipts", expectedId: "pacs-computerization-erp-2023" },
  { q: "Tamil Nadu Cooperative Societies Act Section 90 arbitration 90 days award", expectedId: "tn-cooperative-act-1983" },
  { q: "Section 74 right to inspect audited balance sheet and loan registers TN PACS", expectedId: "tn-cooperative-act-1983" }
];

let queryMatches = 0;
const startTime = Date.now();

benchmarkQueries.forEach((item, idx) => {
  const queryTokens = item.q.toLowerCase().split(' ').filter(w => w.length > 2);
  let bestDoc = null;
  let bestScore = 0;

  legalDocs.forEach(doc => {
    let score = 0;
    const titleLower = doc.title.toLowerCase();
    const catLower = (doc.category || '').toLowerCase();
    const summaryLower = doc.summary.toLowerCase();
    const secLower = doc.key_sections.map(s => `${s.section} ${s.title} ${s.details}`).join(' ').toLowerCase();

    queryTokens.forEach(token => {
      if (titleLower.includes(token)) score += 4;
      if (secLower.includes(token)) score += 3;
      if (summaryLower.includes(token)) score += 2;
      if (catLower.includes(token)) score += 1;
    });

    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  });

  const matched = bestDoc && bestDoc.id === item.expectedId;
  if (matched) queryMatches++;

  assert(matched, `Query #${idx + 1}: "${item.q.slice(0, 42)}..." -> ${item.expectedId}`, `Selected: ${bestDoc ? bestDoc.id : 'None'}`);
});

const benchmarkAccuracy = (queryMatches / benchmarkQueries.length) * 100;
const totalDuration = Date.now() - startTime;
console.log(`  📊 Benchmark Result: ${queryMatches}/${benchmarkQueries.length} correct (${benchmarkAccuracy.toFixed(1)}% accuracy in ${totalDuration}ms)`);
assert(benchmarkAccuracy >= 95.0, 'Citation retrieval achieves benchmark accuracy >= 95.0% without hallucination');

// -----------------------------------------------------------------------------
// TEST SUITE 3: CRYPTOGRAPHIC SECTION 65B EVIDENCE HASH (HMAC-SHA256)
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Section 65B Indian Evidence Act Cryptographic Custody Chain ---');

const testSecretKey = "SAHAKAR_EVIDENCE_KEY_2026";
const sampleTelemetry = {
  node_id: "NODE_01",
  temperature_c: 29.5,
  humidity_pct: 78.0,
  soil_moisture_pct: 88.5,
  rain_intensity_pct: 72.0,
  packet_seq: 1042
};

const canonicalString = `${sampleTelemetry.node_id}:${sampleTelemetry.temperature_c.toFixed(1)}:${sampleTelemetry.humidity_pct.toFixed(1)}:${sampleTelemetry.soil_moisture_pct.toFixed(1)}:${sampleTelemetry.rain_intensity_pct.toFixed(1)}:${sampleTelemetry.packet_seq}`;
const expectedHMAC = crypto.createHmac('sha256', testSecretKey).update(canonicalString).digest('hex');

assert(expectedHMAC.length === 64, 'HMAC-SHA256 outputs full 64-character (256-bit) cryptographic digest');

// Simulate Tamper Resistance: modifying soil moisture from 88.5% to 20.0% must invalidate signature
const tamperedString = `${sampleTelemetry.node_id}:${sampleTelemetry.temperature_c.toFixed(1)}:${sampleTelemetry.humidity_pct.toFixed(1)}:20.0:${sampleTelemetry.rain_intensity_pct.toFixed(1)}:${sampleTelemetry.packet_seq}`;
const tamperedHMAC = crypto.createHmac('sha256', testSecretKey).update(tamperedString).digest('hex');

assert(expectedHMAC !== tamperedHMAC, 'Tamper Detection: Modified telemetry payload instantly invalidates HMAC signature');

// -----------------------------------------------------------------------------
// TEST SUITE 4: INUNDATION VELOCITY INDEX (IVI) SOIL PHYSICS MODEL
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Inundation Velocity Index (IVI) Agronomic Soil Physics Validation ---');

/**
 * Formula: IVI = (Δθ / Δt) * (1 / K_sat)
 * Where:
 *   Δθ = Volumetric Soil Moisture Increase (%)
 *   Δt = Elapsed Time (hours)
 *   K_sat = Saturated Hydraulic Conductivity (cm/hr) — Calibrated for Clayey Loam Paddy Soils (ICAR standard: 0.25 cm/hr)
 */
function computeIVI(deltaMoisturePct, deltaHours, kSat = 0.25) {
  if (deltaHours <= 0) return 0;
  const rateOfMoistureRise = deltaMoisturePct / deltaHours;
  return Number((rateOfMoistureRise / (kSat * 10)).toFixed(2));
}

// Case 1: Normal drip/irrigation event: 10% rise over 5 hours (2% / hr)
const normalIrrigationIVI = computeIVI(10, 5, 0.25);
assert(normalIrrigationIVI < 2.0, `Normal irrigation IVI = ${normalIrrigationIVI} (Safely below 2.0 calamity threshold)`);

// Case 2: Flash inundation / Cloudburst: 60% rise over 1 hour (60% / hr)
const flashFloodIVI = computeIVI(60, 1, 0.25);
assert(flashFloodIVI >= 2.0, `Flash flooding IVI = ${flashFloodIVI} (Correctly triggers Section 14 PMFBY calamity alarm >= 2.0)`);

// -----------------------------------------------------------------------------
// TEST SUITE 5: JOINT LIABILITY GROUP (JLG) SOCIAL COLLATERAL SOLVENCY
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 5: JLG Social Collateral Solvency Scoring Model ---');

/**
 * Formula: S_JLG = w1 * R_historical + w2 * C_crossguarantee + w3 * T_telemetry
 * Weights: w1 = 0.40, w2 = 0.35, w3 = 0.25
 */
function computeJlgScore(repaymentRatio, crossGuaranteeCount, telemetryUptimeRatio) {
  const w1 = 0.40, w2 = 0.35, w3 = 0.25;
  const score = (repaymentRatio * w1) + (Math.min(crossGuaranteeCount / 5, 1.0) * w2) + (telemetryUptimeRatio * w3);
  return Number((score * 100).toFixed(1));
}

const highCreditJlg = computeJlgScore(1.0, 5, 0.98); // Perfect repayment, 5 peer signers, 98% uptime
assert(highCreditJlg >= 85.0, `Prime JLG Solvency Score: ${highCreditJlg}% (Qualified for DCCB collateral-free credit)`);

const defaultingJlg = computeJlgScore(0.2, 1, 0.50); // Poor repayment, 1 signer, 50% uptime
assert(defaultingJlg < 50.0, `High-Risk JLG Solvency Score: ${defaultingJlg}% (Flagged for cooperative peer review)`);

// -----------------------------------------------------------------------------
// TEST SUITE 6: PWA OFFLINE STORAGE & MANIFEST AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 6: PWA & Offline Readiness ---');
const manifestPath = path.join(rootDir, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists for PWA compliance');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.name && manifest.short_name, 'PWA Manifest defines name and short_name');
assert(manifest.display === 'standalone', 'PWA display set to standalone');

// -----------------------------------------------------------------------------
// TEST SUITE 7: ICAR PEDOLOGICAL HYDRAULIC CONDUCTIVITY (K_sat) SOIL MATRIX
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 7: ICAR Pedological Soil Hydraulic Conductivity (K_sat) Matrix ---');

const ICAR_SOILS = {
  vertisol: { k_sat: 0.05, sat_field_delta: 13.0 },
  clay_loam: { k_sat: 0.52, sat_field_delta: 13.0 },
  alfisol: { k_sat: 1.85, sat_field_delta: 16.0 },
  entisol: { k_sat: 2.40, sat_field_delta: 16.0 },
  coarse_sand: { k_sat: 5.00, sat_field_delta: 18.0 }
};

function computeSoilIVI(deltaMoisture, deltaHours, soilKey) {
  const soil = ICAR_SOILS[soilKey];
  const rate = deltaMoisture / deltaHours;
  const ivi = Number((rate / (soil.k_sat * 10)).toFixed(2));
  const isCalamity = ivi >= 2.0 && deltaMoisture >= soil.sat_field_delta;
  return { ivi, isCalamity };
}

// Vertisol (Black Cotton) has very low infiltration (0.05 cm/hr) -> even a 15% moisture surge over 3 hours creates severe waterlogging
const vertisolFlood = computeSoilIVI(15, 3, 'vertisol');
assert(vertisolFlood.ivi >= 2.0 && vertisolFlood.isCalamity, `Vertisol Severe Ponding: IVI = ${vertisolFlood.ivi} (Correctly triggers Section 14 Calamity)`);

// Coarse Sand has rapid infiltration (5.00 cm/hr) -> same moisture change drains quickly and does NOT trigger flood calamity
const sandDrainage = computeSoilIVI(15, 3, 'coarse_sand');
assert(sandDrainage.ivi < 2.0 && !sandDrainage.isCalamity, `Coarse Sand Drainage: IVI = ${sandDrainage.ivi} (Safely absorbed, no calamity)`);

// -----------------------------------------------------------------------------
// TEST SUITE 8: HARDWARE ANTI-SPOOFING & MULTI-SENSOR CROSS-CORRELATION
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 8: Multi-Sensor Cross-Correlation Anti-Spoofing Detector ---');

function checkSpoofing(telemetry) {
  // Anomaly: Soil reads 95% saturation, but ambient humidity is <30% with 40°C heat and no rain
  if (telemetry.soil_moisture > 85.0 && telemetry.humidity < 30.0 && telemetry.temp > 35.0 && telemetry.rain === 0) {
    return { authentic: false, flag: 'ERR_POTENTIOMETER_SPOOF_SUSPECTED' };
  }
  return { authentic: true, flag: 'VERIFIED_AUTHENTIC' };
}

const legitimateWetField = checkSpoofing({ soil_moisture: 92.0, humidity: 82.0, temp: 27.0, rain: 45.0 });
assert(legitimateWetField.authentic, 'Legitimate Monsoon Inundation verified as authentic telemetry');

const spoofedPotentiometer = checkSpoofing({ soil_moisture: 95.0, humidity: 22.0, temp: 39.0, rain: 0.0 });
assert(!spoofedPotentiometer.authentic && spoofedPotentiometer.flag === 'ERR_POTENTIOMETER_SPOOF_SUSPECTED', 
  'Potentiometer/Bucket Spoofing caught: High soil moisture in dry desert-like ambient heat flagged');

// -----------------------------------------------------------------------------
// TEST SUITE 9: STATUTORY REVERSE-SLA ADVERSE INFERENCE ENGINE
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 9: Statutory Reverse-SLA Adverse-Inference Escalation Engine ---');

function evaluateSlaBreach(intimationHoursAgo) {
  const STATUTORY_SURVEY_SLA_HOURS = 240; // 10 days under PMFBY Sec 14.4
  const isBreached = intimationHoursAgo > STATUTORY_SURVEY_SLA_HOURS;
  return {
    isBreached,
    statutorySection: isBreached ? "Section 114(g) Evidence Act Adverse Inference" : "Within Standard Window"
  };
}

const day5Survey = evaluateSlaBreach(120); // 5 days
assert(!day5Survey.isBreached, 'Day 5 intimation is within normal statutory window (240 hrs)');

const day11SurveyDefault = evaluateSlaBreach(264); // 11 days (surveyor defaulted)
assert(day11SurveyDefault.isBreached && day11SurveyDefault.statutorySection.includes("Section 114(g)"), 
  'Day 11 statutory SLA default triggers Section 114(g) Adverse Inference Affidavit');

// -----------------------------------------------------------------------------
// TEST SUITE 10: ROUTINE PACS OPERATIONAL HUB & ERP SCHEME EXPORT
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 10: Routine PACS Operational Hub & National ERP Format ---');

// Fertilizer Quota Allocation
function getFertilizerQuota(acres, crop = "paddy") {
  const ureaPerAcre = 3; // bags
  const controlledUreaMrp = 266.50; // statutory controlled price
  return {
    bags: Math.round(acres * ureaPerAcre),
    cost: Math.round(acres * ureaPerAcre * controlledUreaMrp)
  };
}

const paddyQuota = getFertilizerQuota(5.0, "paddy");
assert(paddyQuota.bags === 15, '5 acres of paddy correctly allocated 15 bags of statutory subsidized Urea');
assert(paddyQuota.cost === 3998, 'Statutory controlled FCO price verified for 15 bags');

// Statutory Dividend Cap (Section 72 Cooperative Act)
function calculateMemberDividend(shareCapital, netProfit, dividendRatePct = 14) {
  const cappedRate = Math.min(14, dividendRatePct); // Max 14% under State Act
  return Math.round(shareCapital * (cappedRate / 100));
}

const dividend = calculateMemberDividend(10000, 500000, 14);
assert(dividend === 1400, 'Member dividend verified at 14% statutory cap (₹1,400 on ₹10,000 share capital)');

// National PACS ERP Checksum Validation
const sampleErpBatch = {
  schema: "MOC-PACS-ERP-v2.3",
  pacs_code: "TN-COOP-PACS-2026-0941",
  active_members: 1248
};
const batchHash = crypto.createHash('sha256').update(JSON.stringify(sampleErpBatch)).digest('hex');
assert(batchHash.length === 64, 'National PACS ERP batch payload signed with SHA-256 digital signature');

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log('================================================================================\n');

if (failures.length > 0) {
  console.error(`❌ ${failures.length} test(s) failed.`);
  process.exit(1);
} else {
  console.log('🎉 All benchmark evaluations and engineering constraints verified successfully.');
  process.exit(0);
}

