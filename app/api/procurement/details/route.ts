import { checkAccess, errorResponse } from "../../../../lib/providers.ts";
import { getNoticeProducts } from "../../../../lib/public-data.ts";
export const runtime = "nodejs";
export const maxDuration = 25;
export async function GET(request: Request) {
  try {
    checkAccess(request);
    const p = new URL(request.url).searchParams;
    return Response.json(
      await getNoticeProducts(
        p.get("noticeNo") || "",
        p.get("noticeOrder") || "",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
