export default function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
}
