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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const user = await getUserFromToken(supabaseUrl, supabaseServiceRole, token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    return res.status(200).json({ user: { id: user.id, email: user.email || "" } });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Auth check failed" });
  }
}
