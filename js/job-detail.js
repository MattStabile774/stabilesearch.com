/* Stabile Search — on-site job detail + apply page (job.html).
   Loads a single role from /api/job and submits applications through /api/apply,
   so candidates view and apply without ever leaving stabilesearch.com. */
(function () {
  var MAX_FILE_MB = 5;

  function qs(id) { return document.getElementById(id); }

  function money(n) {
    if (n == null || isNaN(n)) return null;
    if (n >= 1e6) { var m = n / 1e6; return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M"; }
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + n;
  }
  function compRange(job) {
    var lo = money(job.compMin), hi = money(job.compMax);
    if (lo && hi) return lo + " – " + hi;
    return lo || hi || null;
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function esc(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }
  function loc(job) { return [job.city, job.state].filter(Boolean).join(", "); }

  function getCode() {
    return new URLSearchParams(window.location.search).get("code") || "";
  }

  var code = getCode();

  function renderError(msg) {
    qs("job-title").textContent = "Role unavailable";
    qs("job-body").innerHTML =
      '<div class="job-empty"><p>' + esc(msg || "We couldn't load this role.") +
      '</p><p style="margin-top:12px;"><a class="btn" href="/jobs.html">Browse all open roles</a></p></div>';
    var card = qs("apply-card");
    if (card) card.style.display = "none";
  }

  if (!code) { renderError("No role was specified."); return; }

  function renderJob(job) {
    document.title = job.title + " | Stabile Search";
    qs("job-company").textContent = (job.company || "Stabile Search") +
      (loc(job) ? " · " + loc(job) : "");
    qs("job-title").textContent = job.title;

    var facts = [];
    if (loc(job)) facts.push('<span class="job-fact">📍 ' + esc(loc(job)) + "</span>");
    var comp = compRange(job);
    if (comp) facts.push('<span class="job-fact comp">' + esc(comp) + " total comp</span>");
    facts.push('<span class="job-fact">Confidential client</span>');
    if (job.postedOn) facts.push('<span class="job-fact">Posted ' + esc(fmtDate(job.postedOn)) + "</span>");
    qs("job-facts").innerHTML = facts.join("");

    // Description is pre-sanitized server-side (inline colors/fonts removed).
    qs("job-body").innerHTML = job.description ||
      "<p>Full details available on request — submit your resume and we'll be in touch.</p>";

    var r = job.recruiter || {};
    if (r.name) {
      var box = qs("recruiter");
      if (r.imageUrl) { qs("r-img").src = r.imageUrl; qs("r-img").alt = r.name; }
      else { qs("r-img").style.display = "none"; }
      qs("r-name").textContent = r.name;
      qs("r-meta").textContent = [r.jobTitle, r.phone].filter(Boolean).join(" · ");
      box.hidden = false;
    }
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var s = String(reader.result);
        var comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = function () { reject(new Error("Could not read the file.")); };
      reader.readAsDataURL(file);
    });
  }

  function setStatus(msg, kind) {
    var el = qs("apply-status");
    el.textContent = msg || "";
    el.className = "apply-status" + (kind ? " " + kind : "");
  }

  function showThankYou(name) {
    qs("apply-form").hidden = true;
    var rec = qs("recruiter"); if (rec) rec.hidden = true;
    var card = qs("apply-card");
    var ty = document.createElement("div");
    ty.className = "thankyou";
    ty.innerHTML =
      '<div class="check">✓</div>' +
      "<h2>Application received</h2>" +
      '<p class="form-note" style="margin-top:10px;">Thanks' + (name ? ", " + esc(name) : "") +
      ". Your application went straight to Stabile Search. If it's a fit, we'll reach out directly — often about roles that are never posted publicly.</p>" +
      '<p style="margin-top:16px;"><a class="btn" href="/jobs.html">View other open roles</a></p>';
    card.appendChild(ty);
  }

  function initForm() {
    var form = qs("apply-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", "");

      var firstName = qs("firstName").value.trim();
      var lastName = qs("lastName").value.trim();
      var email = qs("email").value.trim();
      var phone = qs("phone").value.trim();
      var fileInput = qs("resume");
      var file = fileInput.files && fileInput.files[0];

      if (!firstName || !lastName) { setStatus("Please enter your first and last name.", "err"); return; }
      if (!file) { setStatus("Please attach your resume.", "err"); return; }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setStatus("That file is over " + MAX_FILE_MB + " MB. Please attach a smaller resume.", "err"); return;
      }

      var btn = qs("apply-submit");
      btn.disabled = true;
      btn.textContent = "Submitting…";
      setStatus("Sending your application…", "");

      fileToBase64(file).then(function (b64) {
        return fetch("/api/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: code,
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone,
            filename: file.name,
            fileType: file.type,
            fileBase64: b64,
          }),
        });
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      }).then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          showThankYou(firstName);
        } else {
          btn.disabled = false;
          btn.textContent = "Submit application";
          setStatus((res.data && res.data.error) ||
            "Something went wrong sending your application. Please try again, or email matt@stabilesearch.com.", "err");
        }
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = "Submit application";
        setStatus("Network error. Please try again, or email matt@stabilesearch.com.", "err");
      });
    });
  }

  fetch("/api/job?code=" + encodeURIComponent(code))
    .then(function (r) {
      if (!r.ok) throw new Error("This role may have closed or been filled.");
      return r.json();
    })
    .then(function (job) {
      if (!job || !job.title) throw new Error("This role may have closed or been filled.");
      renderJob(job);
      initForm();
    })
    .catch(function (err) {
      renderError(err && err.message ? err.message : null);
    });
})();
