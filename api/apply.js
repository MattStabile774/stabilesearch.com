/**
 * /api/apply — Vercel serverless function.
 *
 * Receives a job application from the on-site apply form and forwards it to
 * Crelate's public apply endpoint as multipart/form-data — exactly the request
 * Crelate's own portal makes. Because the only per-job variable is the job code
 * (which comes straight from the live /api/jobs feed), this works for every
 * current and future job automatically, with no per-job configuration.
 *
 * The browser sends JSON with the resume base64-encoded (avoids multipart
 * parsing on the server). We rebuild it as multipart using the Node 18+ global
 * FormData / Blob / fetch, then post it to Crelate.
 *
 * Expected JSON body:
 *   { code, firstName, middleName, lastName, email, phone,
 *     filename, fileType, fileBase64 }
 */

const APPLY_BASE = "https://jobs.crelate.com/portal/stabilesearchllc/job/apply/";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};

    const {
      code,
      firstName,
      middleName,
      lastName,
      email,
      phone,
      filename,
      fileType,
      fileBase64,
    } = body;

    if (!code || !firstName || !lastName) {
      res.status(400).json({ error: "First name, last name and job are required." });
      return;
    }
    if (!fileBase64) {
      res.status(400).json({ error: "A resume file is required." });
      return;
    }

    const buffer = Buffer.from(fileBase64, "base64");
    // Guard against oversized payloads (resumes are small; cap ~5MB decoded).
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Resume is too large. Please keep it under 5 MB." });
      return;
    }

    const form = new FormData();
    form.append("firstName", String(firstName));
    form.append("middleName", middleName ? String(middleName) : "");
    form.append("lastName", String(lastName));
    form.append("email", email ? String(email) : "");
    form.append("phone", phone ? String(phone) : "");
    const blob = new Blob([buffer], { type: fileType || "application/octet-stream" });
    form.append("file-uploadResume", blob, filename || "resume.pdf");

    const applyUrl = APPLY_BASE + encodeURIComponent(code);

    const upstream = await fetch(applyUrl, {
      method: "POST",
      body: form,
      headers: {
        // Mimic the portal's own submission so any server-side origin checks pass.
        Referer: applyUrl,
        Origin: "https://jobs.crelate.com",
        "User-Agent":
          "Mozilla/5.0 (compatible; StabileSearchApply/1.0; +https://www.stabilesearch.com)",
      },
    });

    // Crelate returns 200 (or a redirect that resolves to a thank-you page) on
    // success. Treat any non-error status as accepted; the end-to-end test
    // confirms the record actually lands in Crelate.
    if (upstream.status >= 200 && upstream.status < 400) {
      res.status(200).json({ ok: true });
    } else {
      const text = await upstream.text().catch(() => "");
      res.status(502).json({
        error: "Crelate did not accept the application.",
        status: upstream.status,
        detail: text.slice(0, 300),
      });
    }
  } catch (err) {
    res.status(500).json({
      error: "The application could not be sent. Please try again.",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
