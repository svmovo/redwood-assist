// Redwood Assist — system instruction + prompt builders.
// REDWOOD_GUIDELINES and REDWOOD_RULES are extracted verbatim from the project
// guidelines file the user supplied; they are prompt data sent to Gemini, nothing else.

export const REDWOOD_GUIDELINES = "# Project Redwood — Video Quality Evaluation (Appen Experts)\n\n## 1. Core Objective\nEvaluate short-form videos (Facebook Reels) for **Brand Safety** and **Brand Positioning** on Facebook.\n- **Primary Decision (`Q1.0`):** `Approve` or `Reject` (Note: `Maybe` has been permanently removed from the project).\n- **Golden Rule:** **When in doubt, Reject.**\n- **Watch Requirement:** Always inspect the **entire video duration** with **audio ON**, plus the caption, account name, and on-screen text.\n\n---\n\n## 2. Rejection Reasons (`Q1.1` — R1 to R12)\n\n| Code | Category | Detailed Criteria & Edge Cases |\n| :--- | :--- | :--- |\n| **R1** | **Inappropriate Content** | • **Politics & Elections:** Any political content, voting reminders, election campaigns (even if labeled \"non-partisan\" or presented as a skit).<br>• **Suggestive / Provocative:** Lingerie, stockings/garter belts, sexually suggestive poses or attire.<br>• **Profanity / Explicit:** Swearing, offensive language, violence, self-harm, drugs/alcohol abuse. |\n| **R2** | **Health & Medical Claims** | Unverified medical advice, miracle cures, weight-loss/supplement claims, or misleading health statements. |\n| **R3** | **AI-Generated Content** | • **Reject:** Visuals generated or manipulated by AI (`deepfakes`, `AI artifacts` like distorted hands/6 fingers, garbled/nonsensical text on signs, uncanny/fake appearance) without clear educational context.<br>• **Approve:** Real camera footage using only an **AI text-to-speech voiceover** (provided visuals are 100% real and no other rules are violated). |\n| **R5** | **Main Focal Point Is IP** | • Copyrighted movies, TV shows, anime, or video game clips (e.g., *Spider-Man* clips, *Malcolm in the Middle* promotional stills).<br>• Official sports broadcasts/leagues (e.g., **NBA**, **NFL** game footage on TV or full-screen).<br>• Branded commercial products/logos as the main focus.<br>• *Exception:* Standard Facebook audio library background music is allowed if the visual focus is original content (e.g., DIY/pets). |\n| **R8** | **Minors** | • Anyone who appears under 18, or **whose age cannot be confirmed as 18+** (e.g., \"looks 16 or 20, can't tell\" $\\rightarrow$ **Reject**). |\n| **R9** | **Language / Visual Quality / Text** | • Non-English spoken audio or non-English primary on-screen text (unless purely visual with no speech/text needed, e.g., silent pet clip where Facebook auto-translates caption).<br>• Illegible, cut-off, obscured, or garbled decorative text on screen.<br>• Watermarks from external platforms (TikTok, CapCut, etc.) or low-resolution/blurry video. |\n| **R10** | **Engagement Bait / Spam / Promo** | Explicit calls to action in video or caption (\"Like & Subscribe\", \"Please share!\", \"Follow for part 2\", \"Link in bio\") or promotional ads/campaigns. |\n| **R11** | **Too Many People** | • More than 1 person clearly visible (face visible for **$\\ge 3$ seconds**) in the frame.<br>• Podcasts/interviews featuring a guest who is not the channel owner.<br>• *Exception:* Two creators intentionally collaborating together on a single video (not a bystander, background crowd, or podcast guest). |\n| **R12** | **Not Related to Brand Positioning** | Low-effort, mundane, unengaging, or awkward content that fails to represent Facebook positively even if it doesn't violate R1–R11. |\n\n---\n\n## 3. Star Rating Rubric (For `Approved` Reels Only)\n\n- **3 Stars (Exceptional / X-Factor):**\n  - Hooks the viewer immediately (e.g., action/cheese-pull already in motion in frame 1).\n  - Funny, surprising, or deeply satisfying from start to finish with zero dragging/boring middle sections.\n  - Makes you want to watch it again or share it.\n- **2 Stars (Good / Solid, No X-Factor):**\n  - Useful, clear, well-made, or pleasant (e.g., clear tutorial where you learn something useful, or good skill video that drags slightly in the middle).\n  - Lacks the extraordinary \"X-Factor\" or full-duration hook required for 3 stars.\n  - *Rule:* Never downgrade a good video to 1 star just because you personally dislike the topic (e.g., finding yo-yos boring).\n- **1 Star (Low Quality / Barely Approvable):**\n  - Technically approvable, not offensive, but boring, poorly paced, or weak execution.\n\n---\n\n## 4. Confidence & Notes Rules\n- **Confident + Approve:** **No note is needed** when you are sure of your rating.\n- **Reject** OR **Borderline:** Always write a brief, clear note citing the exact rule code (e.g., `R5 - Movie clip from Spider-Man` or `R8 - Cannot confirm person is 18+`).\n\n---\n\n## 5. Proven Quiz Edge Cases (25-Question Calibration)\n1. **AI Voiceover on Real Hiking Footage:** Real video + AI TTS voice $\\rightarrow$ **Approve** (R3 applies to AI visuals).\n2. **AI Street Vendor Video (6 fingers / garbled sign):** Visual AI artifacts $\\rightarrow$ **Reject (R3)**.\n3. **Movie Clip (*Spider-Man* / J. Jonah Jameson):** Copyrighted film IP $\\rightarrow$ **Reject (R5)**.\n4. **Podcast with Guest & TV Show Poster (*Malcolm in the Middle*):** Copyrighted IP + guest $\\rightarrow$ **Reject (R5 / R11)**.\n5. **Non-Partisan Election / Voting Skit:** Political/election topic $\\rightarrow$ **Reject (R1)**.\n6. **Woman in Lingerie / Garter Belt:** Suggestive/provocative attire $\\rightarrow$ **Reject (R1)**.\n7. **NBA / NFL Game Clip (or TV showing NFL in background):** Sports broadcast IP $\\rightarrow$ **Reject (R5)**.\n8. **Clear Tutorial Without X-Factor:** Useful steps, not exciting enough to rewatch $\\rightarrow$ **2 Stars**.\n9. **Yo-Yo Trick Video (Personal Bias + Slow Middle):** Ignore personal boredom with topic, penalize slow middle $\\rightarrow$ **2 Stars**.\n10. **Instant Cheese-Pull Food Video (Sure of Rating):** Great hook + rewatchable $\\rightarrow$ **3 Stars + Confident (No note needed)**.\n11. **DIY Stone Cat House (Hagrid's Hut) / Silent Pet Hallway Video:** Original DIY/pet content, no watermarks/faces $\\rightarrow$ **Approve**.\n12. **Person of Uncertain Age (16 vs 20):** Cannot verify 18+ $\\rightarrow$ **Reject (R8)**.";

export const REDWOOD_RULES = "{\n  \"project\": \"Redwood\",\n  \"platform\": \"Appen Experts\",\n  \"target_url_pattern\": \"*://experts.appen.com/*\",\n  \"global_rules\": {\n    \"allow_maybe\": false,\n    \"default_on_doubt\": \"Reject\",\n    \"require_full_watch\": true,\n    \"require_audio_check\": true,\n    \"ignore_personal_topic_bias\": true\n  },\n  \"rejection_codes\": [\n    {\n      \"code\": \"R1\",\n      \"label\": \"Inappropriate Content\",\n      \"triggers\": [\n        \"politics\",\n        \"elections\",\n        \"voting_reminder\",\n        \"non_partisan_political_skit\",\n        \"lingerie\",\n        \"sexually_suggestive\",\n        \"profanity\",\n        \"violence\"\n      ]\n    },\n    {\n      \"code\": \"R2\",\n      \"label\": \"Health & Medical Claims\",\n      \"triggers\": [\"unverified_medical_advice\", \"miracle_cure\", \"supplement_claims\"]\n    },\n    {\n      \"code\": \"R3\",\n      \"label\": \"AI-Generated Content\",\n      \"triggers\": [\n        \"ai_generated_visuals\",\n        \"deepfake\",\n        \"distorted_hands_or_fingers\",\n        \"garbled_ai_text\"\n      ],\n      \"exceptions\": [\"real_footage_with_ai_tts_voiceover\"]\n    },\n    {\n      \"code\": \"R5\",\n      \"label\": \"Main Focal Point Is IP\",\n      \"triggers\": [\n        \"movie_clip\",\n        \"tv_show_clip_or_poster\",\n        \"sports_broadcast_nba_nfl\",\n        \"tv_screen_showing_sports\",\n        \"video_game_footage\",\n        \"commercial_brand_focus\"\n      ],\n      \"exceptions\": [\"facebook_library_background_music\"]\n    },\n    {\n      \"code\": \"R8\",\n      \"label\": \"Minors\",\n      \"triggers\": [\"under_18\", \"ambiguous_age_cannot_confirm_adult\"]\n    },\n    {\n      \"code\": \"R9\",\n      \"label\": \"Language / Quality / Text\",\n      \"triggers\": [\n        \"non_english_speech\",\n        \"non_english_on_screen_text\",\n        \"unreadable_or_cut_off_text\",\n        \"third_party_watermark_tiktok_capcut\",\n        \"low_resolution\"\n      ]\n    },\n    {\n      \"code\": \"R10\",\n      \"label\": \"Engagement Bait / Spam\",\n      \"triggers\": [\"please_share\", \"like_and_subscribe\", \"follow_for_more\", \"link_in_bio\", \"promotional_ad\"]\n    },\n    {\n      \"code\": \"R11\",\n      \"label\": \"Too Many People\",\n      \"triggers\": [\n        \"extra_person_face_visible_3s_or_more\",\n        \"podcast_or_interview_guest\",\n        \"crowd_focal_point\"\n      ],\n      \"exceptions\": [\"two_creators_collaborating_intentionally\"]\n    },\n    {\n      \"code\": \"R12\",\n      \"label\": \"Not Related to Brand Positioning\",\n      \"triggers\": [\"mundane_unengaging_content\", \"awkward_low_effort\"]\n    }\n  ],\n  \"rating_scale\": {\n    \"3_stars\": {\n      \"criteria\": [\"immediate_hook\", \"x_factor\", \"funny_surprising_or_satisfying\", \"rewatchable_throughout\"],\n      \"note_required_when_confident\": false\n    },\n    \"2_stars\": {\n      \"criteria\": [\"useful_or_clear\", \"no_x_factor\", \"good_skill_with_slow_middle\"],\n      \"note_required_when_confident\": false\n    },\n    \"1_star\": {\n      \"criteria\": [\"approvable_but_boring_or_weak_pacing\"],\n      \"note_required_when_confident\": false\n    }\n  },\n  \"notes_policy\": {\n    \"Approve_Confident\": false,\n    \"Approve_Borderline\": true,\n    \"Reject_Confident\": true,\n    \"Reject_Borderline\": true\n  }\n}";

export const VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    decision: { type: "STRING", enum: ["Approve", "Reject"] },
    rejection_code: { type: "STRING", enum: ["R1", "R2", "R3", "R5", "R8", "R9", "R10", "R11", "R12", "NONE"] },
    stars: { type: "STRING", enum: ["1", "2", "3", "NONE"] },
    confidence: { type: "STRING", enum: ["Confident", "Borderline"] },
    note: { type: "STRING" },
    reasoning_ar: { type: "STRING" }
  },
  required: ["decision", "rejection_code", "stars", "confidence", "note", "reasoning_ar"]
};

export function buildSystemInstruction() {
  return [
    "You are the evaluation engine for Project Redwood (Appen Experts): brand safety and brand",
    "positioning review of Facebook Reels. Apply the project guidelines below EXACTLY and nothing else.",
    "",
    "Non-negotiable rules:",
    "- The ONLY decisions are Approve and Reject. Maybe does not exist.",
    "- GOLDEN RULE: when in doubt about ANY rule, Reject.",
    "- Judge the ENTIRE video with its audio, plus the caption, account name and on-screen text.",
    "- If the video attachment is missing or unwatchable, say so in reasoning_ar and decide from what",
    "  you can verify; if a rule needs audio or visuals you could not check and the result is doubtful, Reject.",
    "",
    "=== PROJECT GUIDELINES (verbatim) ===",
    REDWOOD_GUIDELINES,
    "",
    "=== MACHINE-READABLE RULES (verbatim) ===",
    REDWOOD_RULES
  ].join("\n");
}

export function buildEvalPrompt(context, hasVideo) {
  const c = context || {};
  return [
    hasVideo
      ? "The attached file is the screen recording of the FULL reel (video + audio) captured from the page. Watch all of it and listen to the audio."
      : "No video could be attached this time. Evaluate from the page context below only; if anything audio/visual cannot be verified and leaves doubt, apply the golden rule (Reject).",
    "",
    "PAGE CONTEXT:",
    "- URL: " + (c.url || "(unknown)"),
    "- Page title / account: " + (c.title || "(unknown)"),
    "- Caption (best guess): " + (c.caption || "(none found)"),
    "- Text near the video (on-screen text, buttons, comments):",
    (c.nearbyText || "(none)").slice(0, 2000),
    "",
    "Decide Q1.0 (Approve/Reject). If Reject: pick the ONE main rejection code (R1-R12).",
    "If Approve: give the star rating (1, 2 or 3) per the rubric.",
    "Confidence: Confident or Borderline.",
    "Note: per the notes policy - empty string for Confident+Approve, otherwise a short note citing the exact rule code.",
    "reasoning_ar: 2-4 جمل بالعربي تشرح القرار لمراجع بشري.",
    "Reply with ONLY the JSON object matching the required schema."
  ].join("\n");
}
