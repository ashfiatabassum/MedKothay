// Health check: confirms the app runs and can reach Supabase with the public key.
// Returns no secrets. Used after setup and after each deploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return Response.json(
      { app: "ok", supabase: "not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    return Response.json(
      { app: "ok", supabase: res.ok ? "ok" : `error ${res.status}` },
      { status: res.ok ? 200 : 503 },
    );
  } catch {
    return Response.json(
      { app: "ok", supabase: "unreachable" },
      { status: 503 },
    );
  }
}
