const express = require("express");

const app = express();
app.use(express.json({ limit: "2mb" }));

const TABLE = "workspace_states";

function getSupabaseHeaders() {
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

async function getUserFromToken(supabaseUrl, supabaseServiceRole, token) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseServiceRole,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function requireAdmin(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || "elhubv@gmail.com").toLowerCase();
  if (!supabaseUrl || !supabaseServiceRole) {
    res.status(500).json({ error: "Supabase auth is not configured." });
    return null;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  try {
    const user = await getUserFromToken(supabaseUrl, supabaseServiceRole, token);
    if (!user) {
      res.status(401).json({ error: "Invalid session." });
      return null;
    }
    const email = (user.email || "").toLowerCase();
    if (email !== adminEmail) {
      res.status(403).json({ error: "Access denied." });
      return null;
    }
    return { user, supabaseUrl, supabaseServiceRole };
  } catch (error) {
    res.status(500).json({ error: error.message || "Auth check failed." });
    return null;
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
});

app.get("/public-config", (_req, res) => {
  res.status(200).json({
    hasSupabase: Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  });
});

app.post("/signin", async (req, res) => {
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
});

app.get("/me", async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || "elhubv@gmail.com").toLowerCase();
  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const user = await getUserFromToken(supabaseUrl, supabaseServiceRole, token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const email = (user.email || "").toLowerCase();
    const isAdmin = email === adminEmail;
    return res.status(200).json({ user: { id: user.id, email: user.email || "", isAdmin } });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Auth check failed" });
  }
});

app.post("/chat", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

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
});

app.get("/workspace", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const tool = req.query.tool;
  if (!tool) return res.status(400).json({ error: "tool is required" });

  try {
    const url =
      `${auth.supabaseUrl}/rest/v1/${TABLE}` +
      `?id=eq.${encodeURIComponent(auth.user.id)}` +
      `&tool=eq.${encodeURIComponent(tool)}` +
      `&select=id,tool,payload,updated_at&limit=1`;
    const data = await supabaseFetch(url, {
      method: "GET",
      headers: getSupabaseHeaders()
    });
    return res.status(200).json({ state: data?.[0] || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Workspace API error" });
  }
});

app.post("/workspace", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const tool = req.body?.tool;
  if (!tool) return res.status(400).json({ error: "tool is required" });

  const payload = req.body?.payload;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "payload object is required" });
  }

  try {
    const url = `${auth.supabaseUrl}/rest/v1/${TABLE}?on_conflict=id,tool`;
    const body = [
      {
        id: auth.user.id,
        tool,
        payload,
        updated_at: new Date().toISOString()
      }
    ];

    const data = await supabaseFetch(url, {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(),
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(body)
    });
    return res.status(200).json({ state: data?.[0] || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Workspace API error" });
  }
});

module.exports = app;
