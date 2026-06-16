module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || "elhubv@gmail.com").toLowerCase();
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }
  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({ error: "Supabase auth is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRole,
        Authorization: `Bearer ${token}`
      }
    });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid session." });
    const user = await userRes.json();
    const email = (user?.email || "").toLowerCase();
    if (email !== adminEmail) {
      return res.status(403).json({ error: "Access denied." });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message || "Auth check failed." });
  }

  const { model, max_tokens, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 4000,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.message || "Anthropic API error"
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};
