import {
  analyze,
  checkAccess,
  errorResponse,
  ServiceError,
} from "../../../lib/providers.ts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    checkAccess(request);
    if (Number(request.headers.get("content-length")) > 64000)
      throw new ServiceError("입력 자료가 너무 큽니다.", 413);
    let body;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("올바른 요청 형식이 아닙니다.", 400);
    }
    if (
      !body ||
      typeof body.prompt !== "string" ||
      !body.prompt.trim() ||
      body.prompt.length > 12000
    )
      throw new ServiceError("검토 요청은 1~12,000자로 입력해 주세요.", 400);
    if (body.provider !== "groq" && body.provider !== "gemma")
      throw new ServiceError("지원하는 모델을 선택해 주세요.", 400);
    return Response.json(await analyze(body.prompt, body.provider), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
