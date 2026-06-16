export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return res.status(500).json({ error: "Supabase auth is not configured." });
  }

  const email = (req.body?.email || "").trim();
  const password = req.body?.password || "";
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnon,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error_description || data?.msg || data?.message || data?.error;
      return res.status(response.status).json({
        error: detail ? `Sign in failed: ${detail}` : "Sign in failed.",
        debug: {
          status: response.status,
          code: data?.code || "",
          raw: data
        }
      });
    }

    const token = data.access_token || data.session?.access_token || "";
    if (!token) {
      return res.status(500).json({ error: "No access token returned by Supabase." });
    }

    return res.status(200).json({ access_token: token });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Auth request failed" });
  }
}
