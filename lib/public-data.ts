import { ServiceError } from "./providers.ts";
import type { Evidence } from "./domain.ts";

export type ProcurementKind = "bid" | "award" | "shopping";
export type ProcurementItem = Evidence;

// Verified against the official data.go.kr Swagger pages and their reference
// documents on 2026-10-23. These are public service addresses, not credentials.
export const DEFAULT_PROCUREMENT_URLS: Record<ProcurementKind, string> = {
  bid: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch?inqryDiv=1&bidNtceNm={query}&inqryBgnDt={from}&inqryEndDt={to}",
  award:
    "https://apis.data.go.kr/1230000/as/ScsbidInfoService/getScsbidListSttusThngPPSSrch?inqryDiv=2&bidNtceNm={query}&inqryBgnDt={from}&inqryEndDt={to}",
  shopping:
    "https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getShoppingMallPrdctInfoList?inqryDiv=1&prdctClsfcNoNm={query}&inqryBgnDate={catalogFromDate}&inqryEndDate={toDate}&regtCncelYn=N",
};

const sources = {
  bid: {
    label: "나라장터 입찰공고정보서비스",
    url: "https://www.data.go.kr/data/15129394/openapi.do",
  },
  award: {
    label: "나라장터 낙찰정보서비스",
    url: "https://www.data.go.kr/data/15129397/openapi.do",
  },
  shopping: {
    label: "나라장터쇼핑몰 품목정보 서비스",
    url: "https://www.data.go.kr/data/15129471/openapi.do",
  },
};

function scalar(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (
      (typeof value === "string" || typeof value === "number") &&
      String(value).trim()
    )
      return String(value);
  }
  return "";
}

function safeLink(value: string, fallback: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* Use official source when detail URL is unavailable. */
  }
  return fallback;
}

function normalize(
  row: Record<string, unknown>,
  kind: ProcurementKind,
  index: number,
): ProcurementItem {
  const rawAmount = scalar(
    row,
    "sucsfbidAmt",
    "thtmSucsfbidAmt",
    "prdctUprc",
    "cntrctPrceAmt",
    "unitPrice",
    "presmptPrce",
    "asignBdgtAmt",
  ).replace(/,/g, "");
  return {
    id:
      kind === "shopping" && scalar(row, "shopngCntrctNo")
        ? `shopping:${scalar(row, "shopngCntrctNo")}:${scalar(row, "shopngCntrctSno")}:${scalar(row, "prdctIdntNo")}`
        : `${kind}:${scalar(row, "bidNtceNo", "prdctIdntNo", "prdctNo", "cntrctNo") || index}:${scalar(row, "bidNtceOrd")}:${scalar(row, "bidClsfcNo")}:${scalar(row, "rbidNo")}`,
    title:
      scalar(
        row,
        "bidNtceNm",
        "prdctNm",
        "prdctSpecNm",
        "prdctClsfcNoNm",
        "dtilPrdctClsfcNoNm",
        "cntrctNm",
      ) || "원자료에 명칭 없음",
    agency: scalar(
      row,
      "dminsttNm",
      "ntceInsttNm",
      "dmndInsttNm",
      "cntrctInsttNm",
      "corpNm",
      "cntrctCorpNm",
    ),
    date: scalar(
      row,
      "bidNtceDt",
      "fnlSucsfDate",
      "rlOpengDt",
      "opengDt",
      "cntrctDate",
      "rgstDt",
    ),
    unitPrice: null,
    quantity: null,
    spec: null,
    method: "purchase",
    mixed: true,
    installation: "unknown",
    maintenance: "unknown",
    vat: "unknown",
    isDemo: false,
    unit: "대",
    url: safeLink(
      scalar(row, "bidNtceDtlUrl", "bidNtceUrl", "prdctDtlUrl"),
      sources[kind].url,
    ),
    source: kind,
    description: [
      "구매·임대 방식, 단품 구성, 단가·수량·사양과 비용 포함 여부를 확인해야 하는 원자료입니다.",
      rawAmount && Number.isFinite(Number(rawAmount))
        ? `원자료 금액 ${Number(rawAmount).toLocaleString("ko-KR")}원 (금액 성격 미확인·단가 아님)`
        : "원자료 금액 미확인",
      scalar(row, "prdctSpecNm", "prdctSpec", "specNm"),
      scalar(row, "bidNtceOrd") ? `공고차수 ${scalar(row, "bidNtceOrd")}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export async function getProcurement(query: string, kind: ProcurementKind) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key)
    throw new ServiceError(
      "공공데이터포털 API 키가 서버에 설정되지 않았습니다. 활용신청 후 일반 인증키를 등록해 주세요.",
      503,
    );
  const template =
    process.env[`PROCUREMENT_${kind.toUpperCase()}_URL`]?.trim() ||
    DEFAULT_PROCUREMENT_URLS[kind];
  if (!template.includes("{query}"))
    throw new ServiceError(
      "공공데이터 요청주소에 검색어 자리표시자 {query}가 필요합니다.",
      503,
    );
  const now = new Date(),
    from = new Date(now.getTime() - 30 * 86400000);
  // Catalog endpoints take dates (8 digits), unlike bid/award timestamps (12).
  // Restrict to less than 12 calendar months as required by the catalog guide.
  const catalogFrom = new Date(now.getTime() - 364 * 86400000);
  const stamp = (date: Date, end: boolean) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(date)
      .replace(/-/g, "") + (end ? "2359" : "0000");
  let url: URL;
  try {
    url = new URL(
      template
        .replaceAll("{query}", encodeURIComponent(query))
        .replaceAll("{catalogFromDate}", stamp(catalogFrom, false).slice(0, 8))
        .replaceAll("{fromDate}", stamp(from, false).slice(0, 8))
        .replaceAll("{toDate}", stamp(now, true).slice(0, 8))
        .replaceAll("{from}", stamp(from, false))
        .replaceAll("{to}", stamp(now, true)),
    );
    if (
      url.protocol !== "https:" ||
      url.hostname !== "apis.data.go.kr" ||
      url.port
    )
      throw new Error();
  } catch {
    throw new ServiceError(
      "요청주소는 https://apis.data.go.kr 의 공식 API 주소여야 합니다.",
      503,
    );
  }
  // Accept both encoded and decoded data.go.kr keys without double encoding.
  let decodedKey = key;
  try {
    decodedKey = decodeURIComponent(key);
  } catch {
    /* Already a decoded key. */
  }
  url.searchParams.set("serviceKey", decodedKey);
  if (!url.searchParams.has("type")) url.searchParams.set("type", "json");
  if (!url.searchParams.has("pageNo")) url.searchParams.set("pageNo", "1");
  if (!url.searchParams.has("numOfRows"))
    url.searchParams.set("numOfRows", "30");
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok)
    throw new ServiceError(
      "공공데이터 서버가 요청을 처리하지 못했습니다. 활용승인 상태와 호출 한도를 확인해 주세요.",
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ServiceError(
      "공공데이터 서버가 JSON 대신 오류 또는 XML을 반환했습니다. 인증키와 요청주소를 확인해 주세요.",
    );
  }
  const header = data.response?.header;
  if (
    header?.resultCode != null &&
    !["00", "0", "0000"].includes(String(header.resultCode))
  )
    throw new ServiceError(
      "공공데이터 API가 오류를 반환했습니다. 활용승인, 조회 기간과 검색 매개변수를 확인해 주세요.",
    );
  const body = data.response?.body ?? data.body;
  if (!body)
    throw new ServiceError(
      "공공데이터 응답 구조를 확인할 수 없습니다. 해당 API의 응답 규격을 확인해 주세요.",
    );
  const raw = body.items?.item ?? body.items ?? body.item ?? [];
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? [raw]
      : [];
  return {
    items: rows
      .filter((row: unknown) => row && typeof row === "object")
      .slice(0, 100)
      .map((row: Record<string, unknown>, index: number) =>
        normalize(row, kind, index),
      ),
    source: sources[kind],
    queriedAt: new Date().toISOString(),
    note: `${kind === "shopping" ? "최근 364일에 등록된 현재 등재 품목" : kind === "award" ? "최근 30일 개찰일 기준" : "최근 30일 공고게시일 기준"} 최대 30건의 기본 조회 결과입니다. 전체 검색을 뜻하지 않습니다. 금액은 원자료 확인 전 단가 비교에 사용하지 마세요.`,
  };
}
