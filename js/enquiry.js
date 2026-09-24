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
  var DRAFT_KEY = "kg-enquiry-draft";
  var EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

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
      ["availability", "Availability"]
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
    SECTIONS.slice(0, 5).forEach(function (section, i) {
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

  form.addEventListener("input", function () { updateConditionals(); saveDraft(); });
  form.addEventListener("change", function () { updateConditionals(); saveDraft(); });

  /* ---------- checklist ---------- */

  function buildChecklist(data) {
    var items = [
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

  function renderChecklist(items) {
    document.getElementById("client-checklist").innerHTML = items.map(function (item) {
      var cls = item.done ? "is-done" : item.important ? "is-important" : "";
      return '<li class="' + cls + '">' + escapeHtml(item.text) + "</li>";
    }).join("");
  }

  /* ---------- summary for Leo ---------- */

  function buildSummary(data) {
    return SECTIONS.map(function (section) {
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
    if (!validateStep(steps[current])) return;

    var data = getData();
    if (data.company_website) return; // honeypot tripped: silently ignore bots

    var items = buildChecklist(data);
    var summary = buildSummary(data);
    var firstName = (data.full_name || "").split(" ")[0];
    var flagged = parqFlagged();
    var business = config.business || {};

    if (!isEmailjsConfigured()) {
      // Fallback: open the client's email app addressed to Leo
      var subject = "PT enquiry: " + data.full_name + (flagged ? " (PAR-Q flagged)" : "");
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
      goals: data.goals || "",
      parq_status: flagged ? "FLAGGED: GP clearance may be required" : "All clear",
      checklist: checklistText(items),
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
