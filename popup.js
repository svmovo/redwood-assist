// Redwood Assist — popup: enable the bar on the current site, open settings, show last verdict.

const $ = (id) => document.getElementById(id);
let tab = null;
let origin = null;

function showError(text) {
  $("msg").textContent = text;
  $("msg").hidden = !text;
}

async function render() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  $("ver").textContent = chrome.runtime.getManifest().version;

  if (!/^https:\/\//.test(url)) {
    $("where").textContent = "افتح صفحة الريل أو صفحة مهمة Redwood، وبعدين دوس على أيقونة الإضافة تاني.";
    $("need").hidden = true;
    $("active").hidden = true;
  } else {
    origin = new URL(url).origin;
    $("where").innerHTML = "";
    $("where").append("الموقع: ", Object.assign(document.createElement("span"), { className: "host", textContent: new URL(url).host }));
    const granted = await chrome.permissions.contains({ origins: [origin + "/*"] });
    $("need").hidden = granted;
    $("active").hidden = !granted;
  }

  const d = await chrome.storage.local.get("rw_last");
  const last = d.rw_last;
  if (last?.verdict) {
    const v = last.verdict;
    $("last").hidden = false;
    $("last").textContent =
      `آخر نتيجة: ${v.decision}` +
      (v.decision === "Reject" ? ` (${v.rejection_code})` : ` — ${v.stars}/3 نجوم`) +
      ` · ${new Date(last.at).toLocaleString("ar-EG")}`;
  }
}

$("btn-enable").addEventListener("click", async () => {
  showError("");
  try {
    const ok = await chrome.permissions.request({ origins: [origin + "/*"] });
    if (!ok) return showError("الإذن اترفض — البار مش هتقدر تظهر على الموقع ده.");
    await chrome.runtime.sendMessage({ type: "RW_SYNC_BAR" });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["bar.js"] }).catch(() => {});
    render();
  } catch (e) {
    showError(String(e.message || e));
  }
});

$("btn-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

render();
