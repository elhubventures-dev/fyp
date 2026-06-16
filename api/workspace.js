const TABLE = "workspace_states";

function getHeaders() {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

async function supabaseFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.message || data?.error || "Supabase request failed";
    throw new Error(message);
  }
  return data;
}

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || "elhubv@gmail.com").toLowerCase();
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    });
  }

  const tool = req.query.tool || req.body?.tool;
  if (!tool) {
    return res.status(400).json({ error: "tool is required" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Authentication required." });
  let ownerId = "";
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`
      }
    });
    if (!userResponse.ok) return res.status(401).json({ error: "Invalid session." });
    const user = await userResponse.json();
    const email = (user?.email || "").toLowerCase();
    if (email !== adminEmail) return res.status(403).json({ error: "Access denied." });
    ownerId = user?.id || "";
  } catch (err) {
    return res.status(500).json({ error: err.message || "Auth check failed." });
  }
  if (!ownerId) return res.status(401).json({ error: "Invalid session." });

  try {
    if (req.method === "GET") {
      const url =
        `${supabaseUrl}/rest/v1/${TABLE}` +
        `?id=eq.${encodeURIComponent(ownerId)}` +
        `&tool=eq.${encodeURIComponent(tool)}` +
        `&select=id,tool,payload,updated_at&limit=1`;
      const data = await supabaseFetch(url, {
        method: "GET",
        headers: getHeaders()
      });
      return res.status(200).json({ state: data?.[0] || null });
    }

    if (req.method === "POST") {
      const payload = req.body?.payload;
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "payload object is required" });
      }

      const url = `${supabaseUrl}/rest/v1/${TABLE}?on_conflict=id,tool`;
      const body = [
        {
          id: ownerId,
          tool,
          payload,
          updated_at: new Date().toISOString()
        }
      ];

      const data = await supabaseFetch(url, {
        method: "POST",
        headers: {
          ...getHeaders(),
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(body)
      });
      return res.status(200).json({ state: data?.[0] || null });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Workspace API error" });
  }
};
