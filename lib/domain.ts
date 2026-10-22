export type PurchaseRequest = {
  item: string;
  quantity: number;
  budget: number;
  minSpec: number;
  installation: boolean;
  maintenance: boolean;
  method: "purchase" | "rental";
};

export type Evidence = {
  id: string;
  title: string;
  agency: string;
  date: string;
  unitPrice: number | null;
  quantity: number | null;
  spec: number | null;
  method: "purchase" | "rental";
  installation: "included" | "excluded" | "unknown";
  maintenance: "included" | "excluded" | "unknown";
  vat: "included" | "excluded" | "unknown";
  source: "bid" | "award" | "shopping";
  url: string | null;
  isDemo: boolean;
  description: string;
  unit: "대" | "개" | "세트";
  mixed: boolean;
};

export type Classification = {
  status: "comparable" | "conditional" | "excluded";
  reasons: string[];
};

export function classifyEvidence(
  e: Evidence,
  request: PurchaseRequest,
): Classification {
  const excluded: string[] = [];
  const pending: string[] = [];
  if (e.method === "rental")
    pending.push("임대 기간과 월액·총액 기준을 추가 확인해야 합니다.");
  if (e.method !== request.method) excluded.push("구매·임대 방식이 다릅니다.");
  if (e.mixed)
    excluded.push("여러 품목이 섞여 있어 단품 가격으로 비교할 수 없습니다.");
  if (e.unit === "세트")
    excluded.push("세트 구성과 요청 품목의 환산 기준이 확인되지 않았습니다.");
  if (e.spec !== null && e.spec < request.minSpec)
    excluded.push("요청한 최소 사양에 미달합니다.");
  if (e.spec === null) pending.push("최소 사양 충족 여부를 확인해야 합니다.");
  if (e.unitPrice === null || !Number.isFinite(e.unitPrice) || e.unitPrice <= 0)
    pending.push("유효한 단가를 확인해야 합니다.");
  if (e.quantity === null || !Number.isFinite(e.quantity) || e.quantity <= 0)
    pending.push("거래 수량을 확인해야 합니다.");
  if (e.vat !== "included")
    pending.push(
      e.vat === "excluded"
        ? "부가세가 별도여서 동일한 가격 기준 확인이 필요합니다."
        : "부가세 포함 여부를 확인해야 합니다.",
    );
  if (request.installation && e.installation === "excluded")
    excluded.push("필수 조건인 설치가 포함되지 않았습니다.");
  if (request.installation && e.installation === "unknown")
    pending.push("설치 포함 여부를 확인해야 합니다.");
  if (request.maintenance && e.maintenance === "excluded")
    excluded.push("필수 조건인 유지관리가 포함되지 않았습니다.");
  if (request.maintenance && e.maintenance === "unknown")
    pending.push("유지관리 범위·기간을 확인해야 합니다.");
  // Extra services can inflate prices even when they are not requested.
  if (!request.maintenance && e.maintenance === "included")
    pending.push(
      "요청하지 않은 유지관리 비용이 포함되어 분리 확인이 필요합니다.",
    );
  if (excluded.length)
    return { status: "excluded", reasons: [...excluded, ...pending] };
  if (pending.length) return { status: "conditional", reasons: pending };
  return {
    status: "comparable",
    reasons: [
      "입력된 사양·계약 방식·단가 조건이 일치하는 참고 사례입니다. 수량·시점 차이는 별도 검토하세요.",
    ],
  };
}

export function summarize(request: PurchaseRequest, evidence: Evidence[]) {
  const unique = [...new Map(evidence.map((e) => [e.id, e])).values()];
  const prices = unique
    .filter((e) => classifyEvidence(e, request).status === "comparable")
    .map((e) => e.unitPrice as number)
    .sort((a, b) => a - b);
  const count = prices.length;
  const median = count
    ? count % 2
      ? prices[Math.floor(count / 2)]
      : (prices[count / 2 - 1] + prices[count / 2]) / 2
    : null;
  const computed =
    median !== null &&
    Number.isSafeInteger(request.quantity) &&
    request.quantity > 0
      ? Math.round(median * request.quantity)
      : null;
  const total =
    computed !== null && Number.isSafeInteger(computed) ? computed : null;
  return {
    count,
    min: count ? prices[0] : null,
    max: count ? prices[count - 1] : null,
    median,
    total,
    balance: total === null ? null : request.budget - total,
    unknownCount: unique.filter(
      (e) => classifyEvidence(e, request).status === "conditional",
    ).length,
  };
}
