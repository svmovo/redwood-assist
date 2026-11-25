// Redwood Assist — background service worker.
// Talks to the Gemini API with the user's OWN key (stored in chrome.storage.local,
// entered by him on the options page — it never goes through any chat).
// Flow: bar.js records the reel -> RW_EVALUATE -> upload video to the Files API ->
// generateContent with the Redwood system instruction -> JSON verdict -> back to the bar.

import { buildSystemInstruction, buildEvalPrompt, VERDICT_SCHEMA } from "./prompts.js";

const API = "https://generativelanguage.googleapis.com";
const SETTINGS_KEY = "rw_settings";
const LAST_KEY = "rw_last";
const DEFAULT_MODEL = "gemini-2.5-flash";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settings() {
  const d = await chrome.storage.local.get(SETTINGS_KEY);
  return { model: DEFAULT_MODEL, ...(d[SETTINGS_KEY] || {}) };
}

function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

// ---------- Gemini Files API: upload the recorded reel, wait until it is ACTIVE ----------
async function uploadVideo(key, b64, mime) {
  const blob = b64ToBlob(b64, mime || "video/webm");
  const meta = { file: { display_name: "redwood_reel_" + Date.now() } };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", blob, "reel.webm");
  const r = await fetch(`${API}/upload/v1beta/files?uploadType=multipart&key=${encodeURIComponent(key)}`, { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("رفع الفيديو فشل: " + (j.error?.message || r.status));
  const file = j.file || {};
  if (!file.name) throw new Error("رفع الفيديو فشل: مفيش اسم ملف رجع من جوجل.");

  // Small files are ACTIVE immediately; bigger ones need a short wait.
  let state = file.state;
  for (let i = 0; i < 40 && state !== "ACTIVE"; i++) {
    if (state === "FAILED") throw new Error("جوجل رفضت تعالج الفيديو (state=FAILED).");
    await sleep(2000);
    const g = await fetch(`${API}/v1beta/${file.name}?key=${encodeURIComponent(key)}`);
    const gj = await g.json().catch(() => ({}));
    if (!g.ok) throw new Error("متابعة حالة الملف فشلت: " + (gj.error?.message || g.status));
    state = gj.state;
  }
  if (state !== "ACTIVE") throw new Error("الفيديو اترفع بس لسه مش جاهز عند جوجل — جرب تاني.");
  return file;
}

async function deleteFile(key, name) {
  try { await fetch(`${API}/v1beta/${name}?key=${encodeURIComponent(key)}`, { method: "DELETE" }); } catch {}
}

// ---------- Gemini generateContent with the Redwood system instruction ----------
async function evaluate(key, model, videoFile, context) {
  const parts = [];
  if (videoFile) parts.push({ fileData: { fileUri: videoFile.uri, mimeType: videoFile.mimeType || "video/webm" } });
  parts.push({ text: buildEvalPrompt(context, !!videoFile) });
  const body = {
    systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: VERDICT_SCHEMA,
      temperature: 0.1
    }
  };
  const r = await fetch(`${API}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Gemini رفض الطلب: " + (j.error?.message || r.status));
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) {
    const block = j.promptFeedback?.blockReason;
    throw new Error(block ? "Gemini حجب الرد: " + block : "Gemini رجع رد فاضي — جرب تاني.");
  }
  let v;
  try { v = JSON.parse(text); } catch { throw new Error("رد Gemini مش JSON سليم."); }
  // Normalize; the golden rule is enforced in the prompt, and Maybe is not in the schema.
  return {
    decision: v.decision === "Approve" ? "Approve" : "Reject",
    rejection_code: v.decision === "Approve" ? "NONE" : (v.rejection_code || "R12"),
    stars: v.decision === "Approve" ? (["1", "2", "3"].includes(v.stars) ? v.stars : "2") : "NONE",
    confidence: v.confidence === "Confident" ? "Confident" : "Borderline",
    note: String(v.note || ""),
    reasoning_ar: String(v.reasoning_ar || "")
  };
}

async function runEvaluation(msg) {
  const s = await settings();
  if (!s.apiKey) return { ok: false, error: "مفيش مفتاح Gemini. افتح إعدادات الإضافة (Options) وحط المفتاح الأول." };
  let file = null;
  try {
    if (msg.videoB64) file = await uploadVideo(s.apiKey, msg.videoB64, msg.mime);
    const verdict = await evaluate(s.apiKey, s.model || DEFAULT_MODEL, file, msg.context);
    const rec = { at: new Date().toISOString(), url: msg.context?.url || "", verdict };
    await chrome.storage.local.set({ [LAST_KEY]: rec });
    return { ok: true, verdict };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally {
    if (file?.name) deleteFile(s.apiKey, file.name); // keep his Google quota clean
  }
}

async function testKey() {
  const s = await settings();
  if (!s.apiKey) return { ok: false, error: "حط المفتاح الأول واضغط حفظ." };
  try {
    const r = await fetch(`${API}/v1beta/models/${encodeURIComponent(s.model || DEFAULT_MODEL)}?key=${encodeURIComponent(s.apiKey)}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return { ok: false, error: "المفتاح مش شغال: " + (j.error?.message || r.status) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "مشكلة نت: " + String(e.message || e) };
  }
}

// ---------- bar registration on sites the user enabled (same model as the Poliwag bar) ----------
const BAR_ID = "redwood-bar";
async function barOrigins() {
  const all = await chrome.permissions.getAll();
  return (all.origins || []).filter((o) => !o.includes("generativelanguage.googleapis.com"));
}
async function syncBarScript() {
  const origins = await barOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [BAR_ID] }).catch(() => []);
  if (!origins.length) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [BAR_ID] }).catch(() => {});
    return;
  }
  const def = { id: BAR_ID, matches: origins, js: ["bar.js"], runAt: "document_idle", persistAcrossSessions: true };
  if (existing.length) await chrome.scripting.updateContentScripts([def]);
  else await chrome.scripting.registerContentScripts([def]);
  const tabs = await chrome.tabs.query({ url: origins });
  for (const t of tabs) chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["bar.js"] }).catch(() => {});
}
chrome.permissions.onAdded.addListener(() => syncBarScript());
chrome.permissions.onRemoved.addListener(() => syncBarScript());
chrome.runtime.onInstalled.addListener(() => syncBarScript());
chrome.runtime.onStartup.addListener(() => syncBarScript());

// ---------- messages ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "RW_EVALUATE") {
    runEvaluation(msg).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true; // async
  }
  if (msg?.type === "RW_TEST_KEY") {
    testKey().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg?.type === "RW_SYNC_BAR") {
    syncBarScript().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  return false;
});
