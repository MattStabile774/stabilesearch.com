/**
 * /api/apply — Vercel serverless function.
 *
 * Receives a job application from the on-site apply form and forwards it to
 * Crelate's candidate-portal Apply API — the exact JSON request Crelate's own
 * portal makes (captured from the live portal). Because the only per-job
 * variable is the job code (which comes from the live /api/jobs feed), this
 * works for every current and future job automatically, with no per-job setup.
 *
 * The browser sends JSON with the resume base64-encoded; we assemble Crelate's
 * expected payload and POST it as application/json.
 *
 * Expected JSON body from the browser:
 *   { code, firstName, lastName, email, phone, filename, fileType, fileBase64,
 *     website (honeypot), elapsedMs }
 */

const APPLY_URL = "https://jobs.crelate.com/api/candidateportal/Apply";
const ORG_ID = "fad5962e-80a5-4d0d-0960-2392ffb2db08";

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

    const { code, firstName, lastName, email, phone, filename, fileType, fileBase64, website, elapsedMs } = body;

    // Spam protection: honeypot ("website" must stay empty) + timing gate.
    // Bots fill hidden fields and submit near-instantly. Pretend success so the
    // bot moves on, but never forward to Crelate.
    if ((website && String(website).trim() !== "") || (typeof elapsedMs === "number" && elapsedMs < 1500)) {
      res.status(200).json({ ok: true, applicationId: null });
      return;
    }

    if (!code || !firstName || !lastName) {
      res.status(400).json({ error: "First name, last name and job are required." });
      return;
    }
    if (!fileBase64) {
      res.status(400).json({ error: "A resume file is required." });
      return;
    }

    // Size guard: base64 length is ~4/3 of the byte size. Cap at ~5MB decoded.
    const approxBytes = Math.floor((fileBase64.length * 3) / 4);
    if (approxBytes > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Resume is too large. Please keep it under 5 MB." });
      return;
    }

    // Payload shape captured from Crelate's own portal submission.
    const payload = {
      Answers: {},
      Disability: null,
      Email: email || "",
      Ethnicity: null,
      FirstName: firstName,
      Gender: null,
      JobCode: code,
      LastName: lastName,
      OrganizationId: ORG_ID,
      Phone: phone || "",
      ReferrerCode: null,
      ReferrerUrl: "",
      UtmSource: null,
      Resume: {
        Data: fileBase64,
        FileName: filename || "resume.pdf",
        ContentType: fileType || "application/octet-stream",
      },
    };

    const upstream = await fetch(APPLY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://jobs.crelate.com",
        Referer: "https://jobs.crelate.com/portal/stabilesearchllc/job/apply/" + encodeURIComponent(code),
      },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await upstream.json();
    } catch (e) {
      data = null;
    }

    // Crelate returns { ApplicationId, Errors, InstanceId, Success }.
    const success = upstream.ok && data && data.Success === true && data.ApplicationId;

    if (success) {
      res.status(200).json({ ok: true, applicationId: data.ApplicationId });
    } else {
      const errs = data && Array.isArray(data.Errors) ? data.Errors.join("; ") : "";
      res.status(502).json({
        error: errs || "Crelate did not accept the application. Please try again.",
        status: upstream.status,
        crelate: data || null,
      });
    }
  } catch (err) {
    res.status(500).json({
      error: "The application could not be sent. Please try again.",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
