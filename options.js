// Redwood Assist — options page: save the Gemini API key + model locally, test the key.

const $ = (id) => document.getElementById(id);
const KEY = "rw_settings";

function flash(ok, text) {
  $("ok").hidden = !!ok ? false : true;
  $("err").hidden = !!ok;
  (ok ? $("ok") : $("err")).textContent = text;
}

async function load() {
  const d = await chrome.storage.local.get(KEY);
  const s = d[KEY] || {};
  $("key").value = s.apiKey || "";
  $("model").value = s.model || "gemini-2.5-flash";
}

$("save").addEventListener("click", async () => {
  const apiKey = $("key").value.trim();
  const model = $("model").value.trim() || "gemini-2.5-flash";
  if (!apiKey) return flash(false, "حط المفتاح الأول.");
  await chrome.storage.local.set({ [KEY]: { apiKey, model } });
  flash(true, "اتحفظ ✅ المفتاح متخزن في متصفحك بس.");
});

$("test").addEventListener("click", async () => {
  flash(true, "بيجرب…");
  const resp = await chrome.runtime.sendMessage({ type: "RW_TEST_KEY" });
  flash(!!resp?.ok, resp?.ok ? "المفتاح شغال ✅" : "❌ " + (resp?.error || "مش شغال"));
});

load();
