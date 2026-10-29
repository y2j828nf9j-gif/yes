/*
 * KnowledgeGainzz — enquiry form
 * - Multi-step form with per-step validation
 * - PAR-Q flagging (any "yes" asks for details + adds GP clearance to checklist)
 * - Draft saved to this device as the client types
 * - On submit: emails Leo the full enquiry and emails the client their
 *   personalised checklist via the EmailJS REST API (no SDK, no framework).
 *   If EmailJS isn't configured yet it falls back to opening an email to Leo.
 */
(function () {
  "use strict";

  var form = document.getElementById("enquiry-form");
  if (!form) return;

  var config = window.KG_CONFIG || {};
  var FREE = new URLSearchParams(window.location.search).get("bundle") === "free";
  var FREE_BUNDLE = "Lets Get Started!: 1 h 20 min 1:1 consultation followed by a taster session (first 20 people)";
  var DRAFT_KEY = FREE ? "kg-enquiry-draft-free" : "kg-enquiry-draft";
  var EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";
  var BOOKING_NOTICE_DAYS = 4;

  // Free taster: details, PAR-Q, then its own short goals + training history steps
  // in place of the full form's experience, goals and nutrition steps
  var dropSelector = FREE
    ? '.form-step[data-step="3"], .form-step[data-step="4"], .form-step[data-step="5"]'
    : '.form-step[data-mode="free"]';
  form.querySelectorAll(dropSelector).forEach(function (fs) { fs.remove(); });
  if (FREE) {
    var reviewLegend = form.querySelector('.form-step[data-step="6"] legend');
    if (reviewLegend) reviewLegend.textContent = "5. Review & send";
    document.title = "Lets Get Started! | KnowledgeGainzz Personal Training";
    var intro = document.querySelector(".form-intro");
    intro.querySelector(".eyebrow").textContent = "Free 1 h 20 min session";
    intro.querySelector("h1").textContent = "Lets Get Started!";
    intro.querySelector("p:not(.eyebrow)").innerHTML =
      "A free 1 h 20 min 1:1 session: a consultation, followed by a taster of what a PT session will be like. I'll ask for your details, a quick health check (PAR-Q), and a few questions about your goals and training so I can make the most of your session. " +
      "It takes about 5 minutes. Spots are limited to the first 20 people.";
    var alt = document.createElement("p");
    alt.className = "small muted";
    alt.innerHTML = 'Looking for a paid package? <a href="enquire.html">Use the full enquiry form</a>.';
    intro.appendChild(alt);
  }

  var steps = Array.prototype.slice.call(form.querySelectorAll(".form-step"));
  var btnBack = document.getElementById("btn-back");
  var btnNext = document.getElementById("btn-next");
  var btnSubmit = document.getElementById("btn-submit");
  var errorBox = document.getElementById("form-error");
  var progressFill = document.getElementById("progress-fill");
  var progressLabel = document.getElementById("progress-label");
  var current = 0;

  var PARQ_QUESTIONS = [
    ["parq_1", "Heart condition or high blood pressure"],
    ["parq_2", "Chest pain at rest / daily activity / exercise"],
    ["parq_3", "Dizziness or loss of consciousness (last 12 months)"],
    ["parq_4", "Other chronic medical condition"],
    ["parq_5", "Prescribed medication for a chronic condition"],
    ["parq_6", "Bone, joint or soft-tissue problem"],
    ["parq_7", "Doctor advised medically supervised activity only"],
    ["parq_8", "Pregnant or given birth in last 6 months"]
  ];

  // Sections used for the review screen and the email to Leo
  var SECTIONS = [
    ["Your details", [
      ["full_name", "Name"], ["age", "Age"], ["email", "Email"], ["phone", "Phone"],
      ["contact_method", "Preferred contact"], ["social_handle", "Social handle"],
      ["heard_about", "Heard about us via"]
    ]],
    ["Health (PAR-Q)", PARQ_QUESTIONS.concat([
      ["parq_details", "PAR-Q details"], ["injuries", "Other injuries / notes"]
    ])],
    ["Experience & activity", [
      ["experience_level", "Experience"], ["training_history", "Training history"],
      ["current_sessions", "Sessions per week now"], ["daily_activity", "Daily activity"],
      ["steps", "Daily steps"], ["sleep", "Sleep"], ["current_activity", "Current exercise"]
    ]],
    ["Goals", [
      ["goals", "Goals"], ["goal_detail", "Goal in their words"], ["goal_why", "Why now"],
      ["timeframe", "Timeframe"], ["sessions_wanted", "Sessions wanted"],
      ["package_interest", "Package interest"], ["availability", "Availability"]
    ]],
    ["Nutrition & lifestyle", [
      ["meals_per_day", "Meals per day"], ["water", "Water"], ["tracking", "Tracks food"],
      ["alcohol", "Alcohol"], ["typical_day", "Typical day of eating"],
      ["dietary", "Dietary needs"], ["supplements", "Supplements"],
      ["nutrition_struggles", "Biggest struggle"]
    ]],
    ["Other", [
      ["anything_else", "Anything else"], ["consent_marketing", "Marketing opt-in"]
    ]]
  ];
  var FREE_SECTIONS = [
    ["Goals", [
      ["primary_goal", "Primary goal"], ["secondary_goals", "Secondary goals"],
      ["specific_target", "Specific target"], ["target_deadline", "Deadline / event"],
      ["goal_reason", "Why it matters now"], ["motivation", "Motivation (0-10)"],
      ["past_barriers", "What stopped them before"]
    ]],
    ["Training history", [
      ["activity_level", "Activity level"], ["weekly_activity", "Each week"],
      ["training_experience", "Experience"], ["training_types", "Training types"],
      ["exercises_enjoy", "Enjoys"], ["exercises_hate", "Hates"],
      ["previous_programmes", "Previous programmes"],
      ["lift_squat", "Squat"], ["lift_hinge", "Hinge"], ["lift_press", "Press"],
      ["lift_row", "Row"], ["lift_pullup", "Pull-up"]
    ]]
  ];
  var SUMMARY_SECTIONS = FREE
    ? [["Bundle", [["package_interest", "Bundle"]]], SECTIONS[0], SECTIONS[1]].concat(FREE_SECTIONS, [SECTIONS[5]])
    : SECTIONS;
  // Review sections line up with step indexes so each "Edit" jumps to the right step
  var REVIEW_SECTIONS = FREE ? SECTIONS.slice(0, 2).concat(FREE_SECTIONS) : SECTIONS.slice(0, 5);

  /* ---------- helpers ---------- */

  function getData() {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (data[key]) data[key] += ", " + value;
      else data[key] = value;
    });
    // Unticked checkboxes aren't in FormData
    data.consent_marketing = form.elements.consent_marketing.checked ? "Yes" : "No";
    if (FREE) data.package_interest = FREE_BUNDLE;
    return data;
  }

  function radioValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function isHidden(el) {
    return !!el.closest("[hidden]");
  }

  function parqFlagged() {
    return PARQ_QUESTIONS.some(function (q) { return radioValue(q[0]) === "Yes"; });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function isEmailjsConfigured() {
    var e = config.emailjs || {};
    return [e.publicKey, e.serviceId, e.leoTemplateId, e.clientTemplateId].every(function (v) {
      return v && v.indexOf("YOUR_") !== 0;
    });
  }

  /* ---------- conditional fields ---------- */

  function updateConditionals() {
    // Social handle only when contacting via Instagram / TikTok
    form.querySelectorAll("[data-show-when]").forEach(function (field) {
      var values = field.getAttribute("data-show-values").split(",");
      var show = values.indexOf(radioValue(field.getAttribute("data-show-when"))) !== -1;
      field.hidden = !show;
      field.querySelectorAll("input, textarea, select").forEach(function (el) { el.required = show; });
    });

    // PAR-Q: any "yes" reveals the details box and makes it required
    var flagged = parqFlagged();
    document.getElementById("parq-flag").hidden = !flagged;
    document.getElementById("parq-details-field").hidden = !flagged;
    form.elements.parq_details.required = flagged;
  }

  /* ---------- validation ---------- */

  function clearErrors(step) {
    step.querySelectorAll(".has-error").forEach(function (el) { el.classList.remove("has-error"); });
    step.querySelectorAll(".error-msg").forEach(function (el) { el.hidden = true; });
    errorBox.hidden = true;
  }

  function validateStep(step) {
    clearErrors(step);
    var firstInvalid = null;
    var seenRadio = {};

    step.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (isHidden(el) || el.closest(".hp")) return;
      if (el.type === "radio") {
        if (seenRadio[el.name]) return;
        seenRadio[el.name] = true;
      }
      if (!el.checkValidity()) {
        var wrap = el.closest(".field, .parq-q, .consent") || el;
        wrap.classList.add("has-error");
        if (!firstInvalid) firstInvalid = el;
      }
    });

    // "At least one" checkbox groups
    step.querySelectorAll("[data-group-required]").forEach(function (group) {
      var name = group.getAttribute("data-group-required");
      if (!group.querySelector('input[name="' + name + '"]:checked')) {
        group.closest(".field").classList.add("has-error");
        var msg = step.querySelector('[data-error-for="' + name + '"]');
        if (msg) msg.hidden = false;
        if (!firstInvalid) firstInvalid = group.querySelector("input");
      }
    });

    if (firstInvalid) {
      errorBox.textContent = "Please complete the highlighted questions before continuing.";
      errorBox.hidden = false;
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  /* ---------- step navigation ---------- */

  function showStep(index, noScroll) {
    current = index;
    steps.forEach(function (step, i) { step.classList.toggle("is-active", i === index); });

    var isLast = index === steps.length - 1;
    btnBack.hidden = index === 0;
    btnNext.hidden = isLast;
    btnSubmit.hidden = !isLast;

    progressFill.style.width = ((index + 1) / steps.length * 100) + "%";
    progressLabel.textContent = "Step " + (index + 1) + " of " + steps.length + ": " + steps[index].getAttribute("data-title");

    if (isLast) renderReview();
    errorBox.hidden = true;
    if (!noScroll) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  btnNext.addEventListener("click", function () {
    if (validateStep(steps[current])) showStep(current + 1);
  });

  btnBack.addEventListener("click", function () {
    showStep(current - 1);
  });

  /* ---------- review ---------- */

  function renderReview() {
    var data = getData();
    var html = "";
    REVIEW_SECTIONS.forEach(function (section, i) {
      var rows = section[1].filter(function (f) { return data[f[0]]; }).map(function (f) {
        return "<div><dt>" + escapeHtml(f[1]) + "</dt><dd>" + escapeHtml(data[f[0]]) + "</dd></div>";
      }).join("");
      html += '<details class="review-section"' + (i === 0 ? " open" : "") + ">" +
        "<summary>" + escapeHtml(section[0]) +
        ' <button type="button" class="link-btn" data-goto="' + i + '">Edit</button></summary>' +
        "<dl>" + (rows || "<div><dd class=\"muted\">Nothing entered</dd></div>") + "</dl></details>";
    });
    document.getElementById("review").innerHTML = html;
  }

  document.getElementById("review").addEventListener("click", function (e) {
    var target = e.target.closest("[data-goto]");
    if (target) {
      e.preventDefault();
      showStep(Number(target.getAttribute("data-goto")));
    }
  });

  /* ---------- draft save / restore ---------- */

  function saveDraft() {
    try {
      var data = getData();
      delete data.company_website;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (err) { /* storage unavailable: form still works */ }
  }

  function restoreDraft() {
    var data;
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (err) { data = null; }
    if (!data) return;

    Object.keys(data).forEach(function (name) {
      var els = form.querySelectorAll('[name="' + name + '"]');
      if (!els.length) return;
      var values = String(data[name]).split(", ");
      els.forEach(function (el) {
        if (el.type === "radio") el.checked = el.value === data[name];
        else if (el.type === "checkbox") el.checked = el.value === "on" ? data[name] === "on" || data[name] === "Yes" : values.indexOf(el.value) !== -1;
        else el.value = data[name];
      });
    });
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
  }

  function clearFixedError(e) {
    var wrap = e.target.closest(".has-error");
    if (wrap && e.target.checkValidity()) wrap.classList.remove("has-error");
  }
  form.addEventListener("input", function (e) { clearFixedError(e); updateConditionals(); saveDraft(); });
  form.addEventListener("change", function (e) { clearFixedError(e); updateConditionals(); saveDraft(); });

  /* ---------- checklist ---------- */

  function buildChecklist(data) {
    var items = FREE ? [
      { done: true, text: "Lets Get Started! claim and PAR-Q health questionnaire submitted" },
      (config.business || {}).freeTasterBookingUrl
        ? { text: "Book your free 1 h 20 min session at PureGym Giltbrook: " + config.business.freeTasterBookingUrl }
        : { text: "Reply to Leo's message with the day and time that suits you for your free 1 h 20 min session at PureGym Giltbrook" },
      { text: "Make sure you have gym access at PureGym Giltbrook (membership or day pass)" },
      { text: "Bring to your first session: water bottle, trainers, a towel and any medication you may need (e.g. inhaler)" }
    ] : [
      { done: true, text: "Enquiry and PAR-Q health questionnaire submitted" },
      { text: "Reply to Leo's message with 2–3 times that suit you for a free consultation at PureGym Giltbrook" },
      { text: "Log everything you eat and drink for 3 typical days (including one weekend day). Photos or an app like MyFitnessPal are both fine" },
      { text: "Optional: take starting photos and measurements (waist, hips, chest). These stay private and help track progress" },
      { text: "Make sure you have gym access at PureGym Giltbrook (membership or day pass)" },
      { text: "Bring to your first session: water bottle, trainers, a towel and any medication you may need (e.g. inhaler)" }
    ];

    if (parqFlagged()) {
      items.splice(1, 0, { important: true, text: "You answered \"yes\" on the PAR-Q. Please speak to your GP and get written confirmation that you're OK to start a new exercise programme before your first session" });
    }
    if (radioValue("parq_5") === "Yes") {
      items.push({ text: "Bring a list of your current medications and doses to the consultation" });
    }
    if (radioValue("parq_6") === "Yes" || (data.injuries && data.injuries.trim())) {
      items.push({ text: "Bring any physio or medical notes about your injury, if you have them" });
    }
    if (radioValue("parq_8") === "Yes") {
      items.push({ important: true, text: "Get approval from your GP or midwife to exercise before your first session" });
    }
    if (Number(data.age) < 18) {
      items.push({ important: true, text: "Under 18: a parent or guardian will need to sign a consent form before training" });
    }
    return items;
  }

  function checklistText(items) {
    return items.map(function (item) {
      return (item.done ? "[✓] " : item.important ? "[!] " : "[ ] ") + item.text;
    }).join("\n");
  }

  // Plain-text "next steps" for the EmailJS templates: excludes the
  // "already done" item (submitting the enquiry, which just happened)
  // and lists what's still to come. Plain text (no HTML tags) because
  // EmailJS inserts merge variables as literal text, not as markup —
  // an earlier HTML-table version showed up as raw code in the inbox.
  function nextStepsText(items) {
    return items
      .filter(function (item) { return !item.done; })
      .map(function (item) { return (item.important ? "⚠ " : "• ") + item.text; })
      .join("\n\n");
  }

  function renderChecklist(items) {
    document.getElementById("client-checklist").innerHTML = items.map(function (item) {
      var cls = item.done ? "is-done" : item.important ? "is-important" : "";
      return '<li class="' + cls + '">' + escapeHtml(item.text) + "</li>";
    }).join("");
  }

  /* ---------- summary for Leo ---------- */

  function buildSummary(data) {
    return SUMMARY_SECTIONS.map(function (section) {
      var lines = section[1].filter(function (f) { return data[f[0]]; }).map(function (f) {
        return f[1] + ": " + data[f[0]];
      });
      return "== " + section[0].toUpperCase() + " ==\n" + (lines.join("\n") || "-");
    }).join("\n\n");
  }

  /* ---------- sending ---------- */

  function sendEmailjs(templateId, params) {
    var e = config.emailjs;
    return fetch(EMAILJS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: e.serviceId,
        template_id: templateId,
        user_id: e.publicKey,
        template_params: params
      })
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(t || res.status); });
    });
  }

  // Calendly booking calendar, pre-filled with their name and email
  function showBooking(data) {
    var base = (config.business || {}).freeTasterBookingUrl;
    var card = document.getElementById("free-booking");
    if (!base || !card) return;
    // Open on the earliest bookable day; the minimum notice itself is enforced in Calendly
    var earliest = new Date();
    earliest.setDate(earliest.getDate() + BOOKING_NOTICE_DAYS);
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    var month = earliest.getFullYear() + "-" + pad(earliest.getMonth() + 1);
    var params = new URLSearchParams({
      month: month,
      date: month + "-" + pad(earliest.getDate()),
      embed_type: "Inline",
      embed_domain: window.location.hostname || "localhost",
      hide_gdpr_banner: "1",
      name: data.full_name || "",
      email: data.email || ""
    });
    var iframe = document.createElement("iframe");
    iframe.src = base + "?" + params.toString();
    iframe.title = "Book your free Lets Get Started! session";
    iframe.loading = "lazy";
    card.querySelector(".booking-frame").appendChild(iframe);
    document.getElementById("booking-link").href = base + "?" + new URLSearchParams({ name: data.full_name || "", email: data.email || "" }).toString();
    if (parqFlagged()) {
      var note = document.createElement("p");
      note.className = "notice notice-warn";
      note.textContent = "You answered \"yes\" on the PAR-Q, so please get your GP's go-ahead before your first session. You can still book a time now.";
      card.insertBefore(note, card.querySelector(".booking-frame"));
    }
    card.hidden = false;
  }

  function showSuccess(data, items, message) {
    renderChecklist(items);
    document.querySelectorAll("[data-first-name]").forEach(function (el) {
      el.textContent = (data.full_name || "there").split(" ")[0];
    });
    document.querySelectorAll("[data-client-email]").forEach(function (el) { el.textContent = data.email; });
    document.querySelectorAll("[data-contact-method]").forEach(function (el) {
      el.textContent = data.contact_method === "Email" ? "email" : data.contact_method;
    });
    if (message) document.getElementById("success-message").textContent = message;
    if (FREE) showBooking(data);

    form.hidden = true;
    document.querySelector(".progress").hidden = true;
    document.querySelector(".form-intro").hidden = true;
    var success = document.getElementById("form-success");
    success.hidden = false;
    success.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    // Enter / "Go" on a phone keyboard submits the form from any step: treat it as Next
    if (current < steps.length - 1) {
      if (validateStep(steps[current])) showStep(current + 1);
      return;
    }
    // Every step must be complete (PAR-Q, consents, etc.) before anything is sent
    for (var i = 0; i < steps.length; i++) {
      if (i !== current) showStep(i, true);
      if (!validateStep(steps[i])) { form.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }

    var data = getData();
    if (data.company_website) return; // honeypot tripped: silently ignore bots

    var items = buildChecklist(data);
    var summary = buildSummary(data);
    var firstName = (data.full_name || "").split(" ")[0];
    var flagged = parqFlagged();
    var business = config.business || {};

    if (!isEmailjsConfigured()) {
      // Fallback: open the client's email app addressed to Leo
      var subject = (FREE ? "Lets Get Started! claim: " : "PT enquiry: ") + data.full_name + (flagged ? " (PAR-Q flagged)" : "");
      window.location.href = "mailto:" + business.email +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(summary);
      clearDraft();
      showSuccess(data, items, "Your email app should have opened with your answers. Please press send so Leo receives them. Your checklist is below. Screenshot it or save it for later.");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Sending…";

    var shared = {
      client_name: data.full_name,
      first_name: firstName,
      client_email: data.email,
      client_phone: data.phone || "Not given",
      contact_method: data.contact_method,
      social_handle: data.social_handle || "N/A",
      goals: data.goals || [data.primary_goal, data.secondary_goals].filter(Boolean).join(", "),
      package_interest: data.package_interest || "Not sure — recommend one",
      parq_status: flagged ? "FLAGGED: GP clearance may be required" : "All clear",
      checklist: checklistText(items),
      next_steps: nextStepsText(items),
      submitted_at: new Date().toLocaleString("en-GB"),
      trainer_email: business.email
    };

    var leoParams = Object.assign({}, shared, {
      summary: summary,
      reply_to: data.email
    });
    var clientParams = Object.assign({}, shared, {
      summary: summary,
      reply_to: business.email,
      booking_line: FREE ? "book in your free session" : "book your free consultation",
      package_note: FREE
        ? "Spots are limited to the first 20 people, so I'll confirm yours when I get in touch."
        : "Nothing is confirmed until after your free consultation.",
      parq_note: flagged
        ? "Because you answered \"yes\" to at least one PAR-Q question, please get written confirmation from your GP that you're fine to start exercising before your first session."
        : "Your PAR-Q came back all clear, so you're good to go."
    });

    sendEmailjs(config.emailjs.leoTemplateId, leoParams)
      .then(function () {
        return sendEmailjs(config.emailjs.clientTemplateId, clientParams).then(
          function () { return true; },
          function () { return false; } // Leo still got it; don't fail the enquiry
        );
      })
      .then(function (clientEmailSent) {
        clearDraft();
        showSuccess(data, items, clientEmailSent ? null :
          "Leo has your enquiry, but we couldn't email your checklist. It's shown below, so screenshot it or save it for later.");
      })
      .catch(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Send enquiry";
        errorBox.innerHTML = "Sorry, something went wrong sending your enquiry. Your answers are saved, so please try again, or email <a href=\"mailto:" +
          escapeHtml(business.email) + "\">" + escapeHtml(business.email) + "</a>.";
        errorBox.hidden = false;
      });
  });

  /* ---------- init ---------- */

  restoreDraft();
  updateConditionals();
  showStep(0, true);
})();
