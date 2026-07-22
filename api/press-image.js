/**
 * /api/press-image — Vercel serverless function.
 *
 * Serves press-article images for the In the Media page from an
 * allowlisted set of publisher CDN URLs, proxied through our own
 * domain and cached at Vercel's edge for a year (s-maxage=31536000).
 *
 * Requested as /images/press/<file> via the rewrite in vercel.json.
 * If real image files are ever committed to images/press/, the
 * filesystem takes precedence and this function is bypassed.
 */

const IMAGES = {
  "bi-2026-college-grads.jpg": "https://i.insider.com/69a9aae3fd4fbd083f2993d4?width=800&format=jpeg",
  "bi-2025-dei.jpg": "https://i.insider.com/67feb2a03fe8d39283632385?width=800&format=jpeg",
  "bi-2024-ai-hiring.jpg": "https://i.insider.com/677d39142be30c194fc536de?width=800&format=jpeg",
  "bi-2021-tech-talent-war.jpg": "https://i.insider.com/61658b12991f6b00186551de?width=800&format=jpeg",
  "bi-2021-data-science-deals.jpg": "https://i.insider.com/617b0a7d46a50c0018d41d73?width=800&format=jpeg",
  "bi-2021-fintech-poach.jpg": "https://i.insider.com/60ec7535ca74780018ae8e5b?width=800&format=jpeg",
  "dice-2022-degree.jpg": "https://www.dice.com/binaries/large/content/gallery/dice/insights/2022/04/shutterstock_1774612388.jpg",
};

module.exports = async (req, res) => {
  try {
    const file = (req.query.f || "").toString();
    const url = IMAGES[file];
    if (!url) {
      res.status(404).end("Not found");
      return;
    }
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StabileSearchBot/1.0)" },
    });
    if (!upstream.ok) {
      res.status(502).end("Upstream error");
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800"
    );
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).end("Error");
  }
};
