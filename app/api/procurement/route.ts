import {
  checkAccess,
  errorResponse,
  ServiceError,
} from "../../../lib/providers.ts";
import { getProcurement } from "../../../lib/public-data.ts";

export const runtime = "nodejs";
export const maxDuration = 25;

export async function GET(request: Request) {
  try {
    checkAccess(request);
    const params = new URL(request.url).searchParams;
    const query = params.get("query")?.trim() ?? "";
    const kind = params.get("kind") ?? "bid";
    if (query.length < 2 || query.length > 100)
      throw new ServiceError("검색어를 2~100자로 입력해 주세요.", 400);
    if (kind !== "bid" && kind !== "award" && kind !== "shopping")
      throw new ServiceError("지원하지 않는 자료 종류입니다.", 400);
    return Response.json(await getProcurement(query, kind), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
