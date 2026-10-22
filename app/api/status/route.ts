export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      groq: Boolean(process.env.GROQ_API_KEY),
      gemma: Boolean(process.env.GEMINI_API_KEY),
      publicData: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
      bid: Boolean(
        process.env.DATA_GO_KR_SERVICE_KEY && process.env.PROCUREMENT_BID_URL,
      ),
      award: Boolean(
        process.env.DATA_GO_KR_SERVICE_KEY && process.env.PROCUREMENT_AWARD_URL,
      ),
      shopping: Boolean(
        process.env.DATA_GO_KR_SERVICE_KEY &&
        process.env.PROCUREMENT_SHOPPING_URL,
      ),
      accessProtected: Boolean(process.env.APP_ACCESS_TOKEN),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
