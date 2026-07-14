/**
 * /api/jobs — Vercel serverless function.
 *
 * Proxies the public Crelate candidate-portal API for Stabile Search LLC
 * and returns a clean JSON payload for the on-site job board.
 *
 * Caching: responses are cached at Vercel's edge for 24 hours
 * (s-maxage=86400), so the board effectively syncs with Crelate once a day.
 * To force an immediate refresh, redeploy the site from the Vercel
 * dashboard (or push any commit).
 */

const ORG_ID = "fad5962e-80a5-4d0d-0960-2392ffb2db08";
const PORTAL_BASE = "https://jobs.crelate.com/portal/stabilesearchllc/job/";

module.exports = async (req, res) => {
  try {
    const envelope = encodeURIComponent(
      JSON.stringify({
        Locations: null,
        OrganizationId: ORG_ID,
        SearchText: null,
        Tags: null,
      })
    );

    const upstream = await fetch(
      `https://jobs.crelate.com/api/candidateportal/GetAllJobs?requestEnvelope=${envelope}`,
      { headers: { Accept: "application/json" } }
    );

    if (!upstream.ok) {
      throw new Error(`Crelate responded with status ${upstream.status}`);
    }

    const data = await upstream.json();
    if (data.IsError) {
      throw new Error(data.ErrorMessage || "Crelate returned an error");
    }

    const jobs = (data.Jobs || []).map((j) => ({
      id: j.Id,
      code: j.JobCode,
      title: j.Title,
      city: j.City,
      state: j.State,
      country: j.Country,
      compMin: j.CompensationMinimum,
      compMax: j.CompensationMaximum,
      summary: (j.Description || "").replace(/ /g, " ").trim(),
      postedOn: j.LastPostedOnDate,
      applyUrl: PORTAL_BASE + j.JobCode,
    }));

    // Newest first
    jobs.sort((a, b) => new Date(b.postedOn) - new Date(a.postedOn));

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: jobs.length,
      jobs,
    });
  } catch (err) {
    res.status(502).json({
      error: "Unable to load jobs from Crelate",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
