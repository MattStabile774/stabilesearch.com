/**
 * /api/job?code=JOBCODE — Vercel serverless function.
 *
 * Returns full details for a single job from Crelate's public candidate-portal
 * API (GetJob), cleaned for on-site rendering. Powers the on-site job detail
 * page (job.html) so applicants never leave stabilesearch.com.
 *
 * Cached at Vercel's edge for 1 hour.
 */

/**
 * Crelate stores descriptions as HTML with hardcoded black text / fixed fonts
 * (e.g. style="color:#000000;font-size:12pt"). On our dark theme that would be
 * invisible, so we strip inline styles and <font> tags and let the text inherit
 * the site's colors. Structural tags (p, ul, li, strong, br, etc.) are kept.
 */
function sanitize(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\/?(script|style)[^>]*>/gi, "")
    .replace(/\sstyle\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/\sstyle\s*=\s*'(?:[^'\\]|\\.)*'/gi, "")
    .replace(/<\/?font[^>]*>/gi, "")
    .replace(/\sclass\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

module.exports = async (req, res) => {
  const code = (req.query && req.query.code ? String(req.query.code) : "").trim();
  if (!code) {
    res.status(400).json({ error: "Missing job code" });
    return;
  }

  try {
    const envelope = encodeURIComponent(JSON.stringify({ JobCode: code }));
    const upstream = await fetch(
      `https://jobs.crelate.com/api/candidateportal/GetJob?requestEnvelope=${envelope}`,
      { headers: { Accept: "application/json" } }
    );

    if (!upstream.ok) {
      throw new Error(`Crelate responded with status ${upstream.status}`);
    }

    const data = await upstream.json();
    if (data.IsError || !data.Job) {
      throw new Error(data.ErrorMessage || "Job not found");
    }

    const j = data.Job;
    const up = j.UserProfile || {};

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      id: j.Id,
      code: j.JobCode,
      title: j.Title,
      company: j.CompanyName,
      city: j.City,
      state: j.State,
      country: j.Country,
      compMin: j.CompensationMinimum,
      compMax: j.CompensationMaximum,
      description: sanitize(j.Description),
      postedOn: j.LastPostedOnDate,
      recruiter: {
        name: up.Name || null,
        jobTitle: up.JobTitle || null,
        phone: up.PhoneNumber || null,
        imageUrl: up.ImageUrl || null,
      },
    });
  } catch (err) {
    res.status(502).json({
      error: "Unable to load job from Crelate",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
