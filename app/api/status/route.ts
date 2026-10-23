export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      groq: Boolean(process.env.GROQ_API_KEY),
      gemma: Boolean(process.env.GEMINI_API_KEY),
      publicData: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
      bid: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
      award: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
      shopping: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
      accessProtected: Boolean(process.env.APP_ACCESS_TOKEN),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
