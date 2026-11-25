// Redwood Assist — the top bar injected on Facebook reels / the Appen task page.
// Records the reel straight from the page's <video> element (video + audio),
// grabs the caption/account context, sends it to the background (Gemini API),
// and shows the verdict: Approve/Reject + R code + stars + note.

(() => {
  if (window.__redwoodBarLoaded) return;
  window.__redwoodBarLoaded = true;

  const MAX_RECORD_SEC = 120; // reels are short; longer videos get a warning to review the rest manually
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // -------------------------------------------------------------- bar UI
  const bar = document.createElement("div");
  bar.id = "redwood-assist-bar";
  bar.innerHTML = `
    <div class="rw-row">
      <span class="rw-title">Redwood Assist</span>
      <button type="button" class="rw-btn rw-go" id="rw-eval">🎬 سجّل وقيّم</button>
      <button type="button" class="rw-btn" id="rw-eval-text">📝 نص بس</button>
      <button type="button" class="rw-btn" id="rw-fill" disabled>📥 طبّق في الصفحة</button>
      <label class="rw-auto"><input type="checkbox" id="rw-auto"> 🤖 تلقائي (يبعت وينقل للي بعده)</label>
      <button type="button" class="rw-btn" id="rw-stop" hidden>⏹ وقف</button>
      <button type="button" class="rw-btn rw-hide" id="rw-hide">✕</button>
    </div>
    <div class="rw-status" id="rw-status">جاهز. القاعدة الذهبية: لو في شك يبقى Reject.</div>
    <div class="rw-verdict" id="rw-verdict" hidden></div>`;
  const css = document.createElement("style");
  css.textContent = `
    #redwood-assist-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: #1B1220; color: #EFEAF2; font: 13px/1.5 "Segoe UI", Tahoma, sans-serif;
      direction: rtl; border-bottom: 2px solid #7A1C38; box-shadow: 0 2px 10px rgba(0,0,0,.45); }
    #redwood-assist-bar .rw-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; }
    #redwood-assist-bar .rw-title { font-weight: 700; margin-left: 6px; }
    #redwood-assist-bar .rw-btn { border: 1px solid #4A3A52; background: #2A2130; color: #EFEAF2;
      border-radius: 8px; padding: 5px 12px; font: 600 13px inherit; cursor: pointer; }
    #redwood-assist-bar .rw-btn:hover { filter: brightness(1.2); }
    #redwood-assist-bar .rw-btn:disabled { opacity: .45; cursor: default; }
    #redwood-assist-bar .rw-go { background: #7A1C38; border-color: #9B2A4B; }
    #redwood-assist-bar .rw-hide { margin-inline-start: auto; padding: 5px 9px; }
    #redwood-assist-bar .rw-status { padding: 0 10px 6px; color: #B9AFC2; font-size: 12px; }
    #redwood-assist-bar .rw-verdict { margin: 0 10px 8px; padding: 10px; border-radius: 10px; background: #241A2B;
      border: 1px solid #4A3A52; direction: rtl; }
    #redwood-assist-bar .rw-badge { display: inline-block; padding: 2px 14px; border-radius: 999px;
      font-weight: 800; font-size: 15px; margin-inline-end: 8px; }
    #redwood-assist-bar .rw-approve { background: #14532D; color: #86EFAC; }
    #redwood-assist-bar .rw-reject { background: #5B1A1A; color: #FCA5A5; }
    #redwood-assist-bar .rw-chip { display: inline-block; background: #33253C; border: 1px solid #5A4568;
      border-radius: 6px; padding: 1px 8px; margin: 2px 4px 2px 0; font-size: 12px; }
    #redwood-assist-bar .rw-note { margin-top: 6px; color: #E7DFEE; white-space: pre-wrap; }
    #redwood-assist-bar .rw-reason { margin-top: 4px; color: #B9AFC2; font-size: 12px; white-space: pre-wrap; }
    #redwood-assist-bar .rw-copy { margin-top: 8px; }
    #redwood-assist-bar .rw-auto { font-size: 12px; cursor: pointer; color: #F3D9A4; }
    body.rw-bar-offset { margin-top: 0 !important; }`;
  document.documentElement.appendChild(css);
  (document.body || document.documentElement).appendChild(bar);

  const $ = (id) => bar.querySelector("#" + id);
  const status = (t) => { $("rw-status").textContent = t; };

  $("rw-hide").addEventListener("click", () => bar.remove());

  // -------------------------------------------------------------- find the reel's <video>
  function bestVideo() {
    const vids = Array.from(document.querySelectorAll("video")).filter((v) => {
      const r = v.getBoundingClientRect();
      return r.width > 100 && r.height > 100 && r.bottom > 0 && r.top < innerHeight;
    });
    vids.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return vids[0] || null;
  }

  // -------------------------------------------------------------- page context (caption, account, text)
  function extractContext(video) {
    let nearby = "";
    let node = video;
    for (let i = 0; i < 8 && node; i++) {
      node = node.parentElement;
      const t = (node?.innerText || "").trim();
      if (t.length > 120) { nearby = t; break; }
      nearby = t || nearby;
    }
    const captionEl = document.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
    return {
      url: location.href,
      title: document.title || "",
      caption: (captionEl?.innerText || document.querySelector('meta[property="og:description"]')?.content || "").trim().slice(0, 800),
      nearbyText: (nearby || document.body?.innerText || "").trim().slice(0, 2000)
    };
  }

  // -------------------------------------------------------------- record the video element (video+audio)
  async function recordVideo(video) {
    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : MAX_RECORD_SEC;
    const secs = Math.min(Math.max(duration, 3), MAX_RECORD_SEC);
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    if (!stream) throw new Error("المتصفح مش قادر يسجل من الفيديو ده.");
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

    try { video.currentTime = 0; } catch {}
    video.loop = false;
    const stopped = new Promise((res) => { rec.onstop = res; });
    rec.start(250);
    try { await video.play(); } catch {}

    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < secs) {
      if (video.ended) break;
      status(`🔴 بيسجل… ${Math.min(Math.round((Date.now() - t0) / 1000), secs)} / ${secs} ثانية`);
      await sleep(500);
    }
    try { video.pause(); } catch {}
    rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
    if (blob.size < 20000) throw new Error("التسجيل طلع فاضي — الفيديو ده محمي أو مش بيشتغل. جرب زر «نص بس».");
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return { b64: btoa(bin), mime: blob.type, secs: Math.round((Date.now() - t0) / 1000), fullDuration: duration };
  }

  // -------------------------------------------------------------- verdict rendering
  let lastVerdict = null;
  function showVerdict(v) {
    lastVerdict = v;
    const box = $("rw-verdict");
    const approve = v.decision === "Approve";
    const stars = approve ? "★".repeat(Number(v.stars) || 0) + "☆".repeat(3 - (Number(v.stars) || 0)) : "";
    box.innerHTML = `
      <div>
        <span class="rw-badge ${approve ? "rw-approve" : "rw-reject"}">${approve ? "✅ Approve" : "⛔ Reject"}</span>
        ${!approve ? `<span class="rw-chip">الكود: ${v.rejection_code}</span>` : ""}
        ${approve ? `<span class="rw-chip">${stars} (${v.stars}/3)</span>` : ""}
        <span class="rw-chip">${v.confidence === "Confident" ? "متأكد" : "حدّي (Borderline)"}</span>
      </div>
      ${v.note ? `<div class="rw-note">📝 ${v.note.replace(/</g, "&lt;")}</div>` : ""}
      <div class="rw-reason">${(v.reasoning_ar || "").replace(/</g, "&lt;")}</div>
      <button type="button" class="rw-btn rw-copy" id="rw-copy">📋 انسخ النتيجة</button>`;
    box.hidden = false;
    $("rw-fill").disabled = false;
    box.querySelector("#rw-copy").addEventListener("click", () => {
      const lines = [
        `Decision: ${v.decision}`,
        approve ? `Stars: ${v.stars}/3` : `Code: ${v.rejection_code}`,
        `Confidence: ${v.confidence}`,
        v.note ? `Note: ${v.note}` : null
      ].filter(Boolean).join("\n");
      navigator.clipboard.writeText(lines).then(() => status("اتنسخت ✅"), () => status("النسخ ما نجحش."));
    });
  }

  // -------------------------------------------------------------- evaluate
  let busy = false;
  async function evaluate(withVideo) {
    if (busy) return;
    busy = true;
    $("rw-eval").disabled = true;
    $("rw-eval-text").disabled = true;
    try {
      const video = bestVideo();
      const context = extractContext(video || document.body);
      let videoB64 = null, mime = null;
      if (withVideo) {
        if (!video) { status("ملقيتش فيديو في الصفحة — هقيّم من النص بس."); }
        else {
          const r = await recordVideo(video);
          videoB64 = r.b64; mime = r.mime;
          if (r.fullDuration > MAX_RECORD_SEC) status(`⚠️ الفيديو أطول من ${MAX_RECORD_SEC} ثانية — سجلت أول ${MAX_RECORD_SEC} بس، راجع الباقي بنفسك.`);
          else status("بيترفع الفيديو لـ Gemini…");
        }
      }
      if (!withVideo || videoB64) {
        if (videoB64) status("Gemini بيتفرج وبيحلل…");
        else status("Gemini بيحلل النص…");
        const resp = await chrome.runtime.sendMessage({ type: "RW_EVALUATE", videoB64, mime, context });
        if (!resp?.ok) { status("❌ " + (resp?.error || "حاجة غلط حصلت.")); return; }
        showVerdict(resp.verdict);
        status(resp.verdict.decision === "Reject" ? "القرار: Reject — راجع الكود والنوت تحت." : "القرار: Approve — راجع النجوم تحت. القرار الأخير ليك.");
      }
    } catch (e) {
      status("❌ " + String(e.message || e));
    } finally {
      busy = false;
      $("rw-eval").disabled = false;
      $("rw-eval-text").disabled = false;
    }
  }
  $("rw-eval").addEventListener("click", () => evaluate(true));
  $("rw-eval-text").addEventListener("click", () => evaluate(false));

  // -------------------------------------------------------------- best-effort auto-fill on the Appen task page
  function applyVerdict() {
    if (!lastVerdict) return 0;
    const want = lastVerdict.decision.toLowerCase();
    let clicked = 0;
    for (const inp of document.querySelectorAll('input[type="radio"]')) {
      const label = (inp.closest("label")?.innerText || document.querySelector(`label[for="${inp.id}"]`)?.innerText || inp.value || "").toLowerCase();
      if (label.includes(want)) { inp.click(); clicked++; }
    }
    if (lastVerdict.decision === "Approve") {
      for (const inp of document.querySelectorAll('input[type="radio"]')) {
        const label = (inp.closest("label")?.innerText || inp.value || "").toLowerCase();
        if (label.includes(lastVerdict.stars) && (label.includes("star") || /^\s*[123]\s*$/.test(label))) { inp.click(); clicked++; }
      }
    }
    if (lastVerdict.note) {
      const ta = document.querySelector("textarea");
      if (ta) {
        ta.focus();
        ta.value = lastVerdict.note;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    return clicked;
  }
  $("rw-fill").addEventListener("click", () => {
    const clicked = applyVerdict();
    status(clicked ? `✅ اختار ${clicked} اختيار — راجع بنفسك قبل ما تدوس Submit.` : "ملقيتش اختيارات مطابقة في الصفحة دي — املاها بإيدك من النتيجة.");
  });

  // -------------------------------------------------------------- AUTO MODE: evaluate -> fill -> submit -> next video -> repeat
  // Safety: stops on borderline verdicts, on any error, when no Submit button is found,
  // when the page doesn't move to a new video, and after MAX_AUTO videos.
  const MAX_AUTO = 50;
  let autoRunning = false, stopFlag = false;
  const AUTO_KEY = "rw_auto";
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled; };
  const textOf = (el) => (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().toLowerCase();

  function findSubmit() {
    return Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'))
      .filter((el) => !bar.contains(el) && visible(el))
      .find((el) => /^(submit|submit task|submit & next|إرسال|ارسال)$/i.test(textOf(el)) || /^submit/i.test(textOf(el)));
  }
  function findNext() {
    return Array.from(document.querySelectorAll('button, [role="button"], a'))
      .filter((el) => !bar.contains(el) && visible(el))
      .find((el) => /^(next|next task|next video|get next|التالي)/i.test(textOf(el)) || /next (card|video|reel)/i.test(textOf(el)));
  }
  const videoKey = () => { const v = bestVideo(); return v ? (v.currentSrc || v.src || "") + "|" + location.href : location.href; };

  async function goNext(prevKey) {
    const nxt = findNext();
    if (nxt) nxt.click();
    else {
      // Facebook reels: arrow-down moves to the next reel
      for (const t of ["keydown", "keyup"]) document.dispatchEvent(new KeyboardEvent(t, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true }));
    }
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if (stopFlag) return false;
      if (videoKey() !== prevKey) { await sleep(1500); return true; }
    }
    return false;
  }

  async function autoLoop() {
    if (autoRunning) return;
    autoRunning = true; stopFlag = false;
    $("rw-stop").hidden = false;
    let n = 0;
    try {
      while (!stopFlag && n < MAX_AUTO) {
        await evaluate(true);
        if (stopFlag) break;
        const v = lastVerdict;
        if (!v || $("rw-eval").disabled) { status("⏹ وقف التلقائي: التقييم فشل. كمّل بإيدك."); break; }
        if (v.confidence !== "Confident") { status("⏹ وقف التلقائي: القرار حدّي (Borderline). راجعه بنفسك وقرر."); break; }
        if (!applyVerdict()) { status("⏹ وقف التلقائي: ملقيتش خانات القرار في الصفحة. املاها بإيدك."); break; }
        await sleep(800);
        const sub = findSubmit();
        if (!sub) { status("⏹ وقف التلقائي: ملقيتش زر Submit. اتملت الخانات، دوس بإيدك."); break; }
        const prev = videoKey();
        sub.click();
        n++;
        status(`✅ اتبعت (${n}). بنقل للي بعده…`);
        await sleep(2500);
        if (!(await goNext(prev))) { status(`⏹ وقف التلقائي بعد ${n} فيديو: الصفحة مانقلتش لفيديو جديد.`); break; }
        $("rw-verdict").hidden = true; lastVerdict = null;
      }
      if (n >= MAX_AUTO) status(`⏹ وقف بعد ${MAX_AUTO} فيديو للأمان. فعّل تاني لو عايز تكمل.`);
    } finally {
      autoRunning = false; $("rw-stop").hidden = true;
    }
  }
  $("rw-stop").addEventListener("click", () => { stopFlag = true; status("⏹ هيقف بعد الفيديو الحالي."); });
  $("rw-auto").addEventListener("change", (e) => {
    chrome.storage.local.set({ [AUTO_KEY]: e.target.checked });
    if (e.target.checked) autoLoop(); else stopFlag = true;
  });
  // Auto mode starts only when the checkbox is ticked in this page; it never resumes on its own.
})();
