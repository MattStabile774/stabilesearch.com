/* Stabile Search job board — pulls live roles from /api/jobs (Crelate). */
(function () {
  var PORTAL_URL = "https://jobs.crelate.com/portal/stabilesearchllc";

  function money(n) {
    if (n == null || isNaN(n)) return null;
    if (n >= 1e6) {
      var m = n / 1e6;
      return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
    }
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + n;
  }

  function compRange(job) {
    var lo = money(job.compMin);
    var hi = money(job.compMax);
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

  function location(job) {
    return [job.city, job.state].filter(Boolean).join(", ");
  }

  function truncate(s, n) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;
  }

  function cardHTML(job, compact) {
    var comp = compRange(job);
    var loc = location(job);
    return (
      '<article class="job-card">' +
        "<div>" +
          "<h3>" + esc(job.title) + "</h3>" +
          '<div class="job-facts">' +
            (loc ? '<span class="job-fact">📍 ' + esc(loc) + "</span>" : "") +
            (comp ? '<span class="job-fact comp">' + esc(comp) + " total comp</span>" : "") +
            '<span class="job-fact">Confidential client</span>' +
          "</div>" +
          (compact ? "" : '<p class="desc">' + esc(truncate(job.summary, 260)) + "</p>") +
        "</div>" +
        '<div class="job-side">' +
          '<span class="job-date">Posted ' + esc(fmtDate(job.postedOn)) + "</span>" +
          '<a class="btn btn-solid" href="' + esc(job.applyUrl) + '" target="_blank" rel="noopener">View &amp; Apply</a>' +
        "</div>" +
      "</article>"
    );
  }

  function errorHTML() {
    return (
      '<div class="job-empty">' +
        "<p>We couldn't load live roles just now.</p>" +
        '<p style="margin-top:10px;"><a class="btn" href="' + PORTAL_URL + '" target="_blank" rel="noopener">View all open roles on our job portal</a></p>' +
      "</div>"
    );
  }

  function getJobs() {
    return fetch("/api/jobs").then(function (r) {
      if (!r.ok) throw new Error("API error " + r.status);
      return r.json();
    }).then(function (data) {
      if (!data || !data.jobs) throw new Error("Bad payload");
      return data;
    });
  }

  /* ----- Full board (jobs.html) ----- */
  var board = document.getElementById("job-board");
  if (board) {
    var search = document.getElementById("job-search");
    var locSel = document.getElementById("job-location");
    var meta = document.getElementById("board-meta");
    var all = [];

    var render = function () {
      var q = (search.value || "").toLowerCase();
      var lf = locSel.value;
      var shown = all.filter(function (j) {
        var hay = (j.title + " " + j.summary + " " + location(j)).toLowerCase();
        return (!q || hay.indexOf(q) !== -1) && (!lf || location(j) === lf);
      });
      board.innerHTML = shown.length
        ? shown.map(function (j) { return cardHTML(j, false); }).join("")
        : '<div class="job-empty"><p>No roles match your search. Try clearing the filters — or <a href="/contact.html">reach out directly</a>; many searches are never posted publicly.</p></div>';
      if (meta) meta.textContent = shown.length + " of " + all.length + " open roles";
    };

    getJobs().then(function (data) {
      all = data.jobs;
      var locs = [];
      all.forEach(function (j) {
        var l = location(j);
        if (l && locs.indexOf(l) === -1) locs.push(l);
      });
      locs.sort().forEach(function (l) {
        var opt = document.createElement("option");
        opt.value = l; opt.textContent = l;
        locSel.appendChild(opt);
      });
      search.addEventListener("input", render);
      locSel.addEventListener("change", render);
      render();
    }).catch(function () {
      board.innerHTML = errorHTML();
      if (meta) meta.textContent = "";
    });
  }

  /* ----- Featured roles (home page) ----- */
  var featured = document.getElementById("featured-jobs");
  if (featured) {
    getJobs().then(function (data) {
      featured.innerHTML = data.jobs.slice(0, 3).map(function (j) { return cardHTML(j, true); }).join("");
    }).catch(function () {
      featured.innerHTML = errorHTML();
    });
  }
})();
