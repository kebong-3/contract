import type { Evidence, PurchaseRequest } from "./domain.ts";
import { classifyEvidence } from "./domain.ts";

export type Quote = {
  id: string;
  supplier: string;
  model: string;
  quantity: number;
  unit: "대" | "개" | "세트";
  unitPrice: number | null;
  vat: "included" | "excluded" | "unknown";
  vatAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  maintenanceCost: number | null;
  maintenanceScope: string;
  validUntil: string;
  sourceNote: string;
  requirementsConfirmed: boolean;
  taxBasisConfirmed: boolean;
};
export type Decision = { quoteId: string; reason: string };
export type QueryReceipt = {
  id: string;
  kind: "bid" | "award" | "shopping";
  query: string;
  queriedAt: string;
  page: number;
  days: number;
  totalCount: number | null;
  returnedCount: number;
  note: string;
};
const money = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export const formatWon = (n: number | null | undefined) =>
  n == null ? "미산출" : `${n.toLocaleString("ko-KR")}원`;
export function evaluateQuote(
  q: Quote,
  request: PurchaseRequest,
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
) {
  const reasons: string[] = [];
  if (!q.supplier.trim()) reasons.push("업체명이 없습니다.");
  if (!q.model.trim()) reasons.push("제품·규격명을 확인하세요.");
  if (
    !Number.isSafeInteger(q.quantity) ||
    q.quantity <= 0 ||
    q.quantity !== request.quantity
  )
    reasons.push("견적 수량이 구매 요청과 다릅니다.");
  if (q.unit !== (request.unit || "대"))
    reasons.push("견적 단위가 구매 요청과 다릅니다.");
  if (request.method !== "purchase")
    reasons.push(
      "견적 비교는 물품 구매 기준입니다. 임대 기간·월액 비교는 별도 검토하세요.",
    );
  if (!q.requirementsConfirmed)
    reasons.push("필수 사양·납기·보증 조건을 확인하세요.");
  if (!q.sourceNote.trim())
    reasons.push("견적서 파일명·페이지 등 확인 위치를 기록하세요.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(q.validUntil) ||
    Number.isNaN(Date.parse(q.validUntil)) ||
    new Date(q.validUntil).toISOString().slice(0, 10) !== q.validUntil
  )
    reasons.push("견적 유효기한을 확인하세요.");
  else if (q.validUntil < today)
    reasons.push("견적 유효기한이 지났습니다. 재견적이 필요합니다.");
  if (!q.taxBasisConfirmed)
    reasons.push("본체·부대비용의 부가세 기준이 같은지 확인하세요.");
  if (q.vat === "unknown") reasons.push("부가세 포함 여부를 확인하세요.");
  const base =
    money(q.unitPrice) &&
    q.unitPrice > 0 &&
    Number.isSafeInteger(q.quantity) &&
    q.quantity > 0
      ? q.unitPrice * q.quantity
      : null;
  if (base === null || !Number.isSafeInteger(base))
    reasons.push("유효한 본체 단가·수량이 필요합니다.");
  const fees = [
    ["배송비", q.deliveryCost],
    ["설치비", q.installationCost],
    ["유지관리비", q.maintenanceCost],
  ] as const;
  fees.forEach(([label, value]) => {
    if (!money(value))
      reasons.push(
        `${label}를 확인하세요. 추가 비용이 없으면 0원을 입력하세요.`,
      );
  });
  if (q.maintenanceCost !== 0 && !q.maintenanceScope.trim())
    reasons.push("유지관리 범위와 기간을 기록하세요.");
  if (request.maintenance && !q.maintenanceScope.trim())
    reasons.push("필수 유지관리의 범위와 기간을 확인하세요.");
  if (q.vat === "excluded" && !money(q.vatAmount))
    reasons.push(
      "견적서에 기재된 부가세액을 입력하세요. 자동으로 10%를 가산하지 않습니다.",
    );
  const tax =
    q.vat === "included"
      ? 0
      : q.vat === "excluded" && money(q.vatAmount)
        ? q.vatAmount
        : null;
  const calculated =
    base !== null && tax !== null && fees.every(([, v]) => money(v))
      ? base +
        tax +
        (q.deliveryCost || 0) +
        (q.installationCost || 0) +
        (q.maintenanceCost || 0)
      : null;
  const total =
    calculated !== null && Number.isSafeInteger(calculated) ? calculated : null;
  if (calculated !== null && total === null)
    reasons.push("금액이 안전한 계산 범위를 초과합니다.");
  return {
    base: base !== null && Number.isSafeInteger(base) ? base : null,
    tax,
    total,
    balance: total === null ? null : request.budget - total,
    eligible: reasons.length === 0 && total !== null,
    reasons: [...new Set(reasons)],
  };
}
export function quoteReport(
  request: PurchaseRequest,
  quotes: Quote[],
  decision: Decision | null,
  receipts: QueryReceipt[],
) {
  if (!quotes.length && !receipts.length) return "";
  return `\n\n7. 받은 견적의 동일 조건 비교\n${
    quotes.length
      ? quotes
          .map((q) => {
            const r = evaluateQuote(q, request);
            return `${q.supplier} / ${q.model}\n본체: ${formatWon(q.unitPrice)} × ${q.quantity}${q.unit} = ${formatWon(r.base)}\n부가세: ${q.vat === "included" ? "포함" : q.vat === "excluded" ? formatWon(q.vatAmount) : "미확인"}\n배송: ${formatWon(q.deliveryCost)} / 설치: ${formatWon(q.installationCost)} / 유지관리: ${formatWon(q.maintenanceCost)}\n유지관리 범위: ${q.maintenanceScope || "미기록"}\n총비용: ${formatWon(r.total)} / 예산 차액: ${formatWon(r.balance)}\n유효기한: ${q.validUntil || "미확인"}\n확인 위치: ${q.sourceNote || "미기록"}\n조건 확인: ${r.eligible ? "입력된 조건 확인됨" : r.reasons.join(" / ")}`;
          })
          .join("\n\n")
      : "등록된 견적 없음"
  }\n\n8. 담당자의 검토 대안\n${
    decision
      ? `${quotes.find((q) => q.id === decision.quoteId)?.supplier || "알 수 없는 견적"}\n선택 이유: ${decision.reason}\n현재 조건 재검토: ${(() => {
          const q = quotes.find((q) => q.id === decision.quoteId);
          return q && evaluateQuote(q, request).eligible
            ? "입력 조건 확인됨"
            : "조건 변경 또는 미확인 사항 있음";
        })()}`
      : "대안 미선택"
  }\n※ 최저가 자동 선정·계약 적법성 판정·결재를 뜻하지 않습니다.\n\n9. 실제 조회 범위\n${receipts.map((r) => `${r.queriedAt} | ${r.kind} | 검색어 ${r.query} | ${r.page}페이지 / 반환 ${r.returnedCount}건 / 전체 ${r.totalCount ?? "미제공"}건\n${r.note}`).join("\n") || "실제 조회 이력 없음"}\n`;
}
// Neutralize spreadsheet formulas when user-provided strings are opened in Excel.
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function reviewCsv(
  request: PurchaseRequest,
  evidence: Evidence[],
  quotes: Quote[],
) {
  const rows: unknown[][] = [
    [
      "구분",
      "명칭",
      "기관·업체",
      "가격",
      "수량",
      "단위",
      "상태",
      "확인사항·위치",
      "출처",
      "자료구분",
      "가격의 성격",
    ],
  ];
  evidence.forEach((e) => {
    const c = classifyEvidence(e, request);
    rows.push([
      "참고사례",
      e.title,
      e.agency,
      e.unitPrice,
      e.quantity,
      e.unit,
      c.status,
      c.reasons.join(" / "),
      e.url || "",
      e.isDemo ? "합성 예시" : "실제 조회",
      e.priceBasis || "담당자 확인값",
    ]);
  });
  quotes.forEach((q) => {
    const r = evaluateQuote(q, request);
    rows.push([
      "입력 견적",
      q.model,
      q.supplier,
      r.total,
      q.quantity,
      q.unit,
      r.eligible ? "조건 확인됨" : "확인 필요",
      `${q.sourceNote} / ${r.reasons.join(" / ")}`,
      "",
      "사용자 입력",
      "부대비용 포함 견적 총액",
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function mergeEvidence(current: Evidence[], incoming: Evidence[]) {
  const map = new Map(current.map((e) => [e.id, e]));
  incoming.forEach((e) => {
    if (!map.has(e.id)) map.set(e.id, e);
  });
  return [...map.values()].slice(0, 200);
}
