import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateQuote,
  reviewCsv,
  mergeEvidence,
  type Quote,
} from "../lib/review.ts";
import {
  classifyEvidence,
  summarize,
  type PurchaseRequest,
  type Evidence,
} from "../lib/domain.ts";
import { parseWorkspace } from "../lib/workspace.ts";
const request: PurchaseRequest = {
  item: "공개 테스트 물품",
  quantity: 10,
  unit: "대",
  budget: 2000000,
  minSpec: 0,
  method: "purchase",
  installation: true,
  maintenance: false,
};
const quote: Quote = {
  id: "q1",
  supplier: "가상 테스트업체",
  model: "테스트",
  quantity: 10,
  unit: "대",
  unitPrice: 100000,
  vat: "included",
  vatAmount: null,
  deliveryCost: 0,
  installationCost: 50000,
  maintenanceCost: 0,
  maintenanceScope: "없음",
  validUntil: "2099-12-31",
  sourceNote: "공개 테스트 견적 1쪽",
  requirementsConfirmed: true,
  taxBasisConfirmed: true,
};
const evidence: Evidence = {
  id: "ref1",
  title: "참고",
  agency: "가상",
  date: "2026-10-01",
  unitPrice: 100000,
  quantity: 10,
  spec: null,
  method: "purchase",
  installation: "included",
  maintenance: "excluded",
  vat: "included",
  source: "shopping",
  url: null,
  isDemo: true,
  description: "가상",
  unit: "대",
  mixed: false,
};
test("동일 조건의 견적은 본체·추가 비용을 한 번 합산하고 예산 차액을 계산한다", () => {
  const r = evaluateQuote(quote, request);
  assert.equal(r.total, 1050000);
  assert.equal(r.balance, 950000);
  assert.equal(r.eligible, true);
});
test("미확인 비용·부가세는 0원으로 계산하지 않고 별도 부가세는 명시 금액만 쓴다", () => {
  assert.equal(
    evaluateQuote({ ...quote, deliveryCost: null }, request).total,
    null,
  );
  assert.equal(
    evaluateQuote({ ...quote, vat: "unknown" }, request).total,
    null,
  );
  assert.equal(
    evaluateQuote({ ...quote, vat: "excluded" }, request).total,
    null,
  );
  assert.equal(
    evaluateQuote({ ...quote, vat: "excluded", vatAmount: 80000 }, request)
      .total,
    1130000,
  );
});
test("수량·단위·유효기한·필수 조건·근거가 맞지 않으면 검토 대안이 될 수 없다", () => {
  for (const change of [
    { quantity: 9 },
    { unit: "개" },
    { validUntil: "2000-01-01" },
    { validUntil: "2026-02-30" },
    { sourceNote: "" },
    { requirementsConfirmed: false },
    { taxBasisConfirmed: false },
    { unitPrice: 0 },
    { unitPrice: Number.MAX_SAFE_INTEGER },
  ])
    assert.equal(
      evaluateQuote({ ...quote, ...change } as Quote, request).eligible,
      false,
      JSON.stringify(change),
    );
  assert.equal(
    evaluateQuote(quote, { ...request, method: "rental" }).eligible,
    false,
  );
  assert.equal(
    evaluateQuote(
      { ...quote, maintenanceScope: "" },
      { ...request, maintenance: true },
    ).eligible,
    false,
  );
});
test("공고 계획단가·낙찰총액·미확인 원자료는 중앙값 계산에서 배제하고 담당자 제외를 존중한다", () => {
  for (const change of [
    { priceBasis: "notice" },
    { priceBasis: "award-total" },
    { reviewed: false },
    { included: false },
    { unit: "개" },
  ])
    assert.notEqual(
      classifyEvidence({ ...evidence, ...change } as Evidence, request).status,
      "comparable",
    );
  assert.equal(
    summarize(request, [{ ...evidence, priceBasis: "notice" }]).median,
    null,
  );
  assert.equal(
    classifyEvidence(
      {
        ...evidence,
        priceBasis: "catalog-unit",
        reviewed: true,
        quantity: null,
      },
      request,
    ).status,
    "comparable",
  );
});
test("재조회는 담당자 수정·제외 기록을 덮어쓰지 않는다", () => {
  const edited = { ...evidence, included: false, unitPrice: 120000 };
  assert.deepEqual(
    mergeEvidence([edited], [evidence, { ...evidence, id: "ref2" }]),
    [edited, { ...evidence, id: "ref2" }],
  );
});
test("CSV는 수식 실행과 따옴표를 처리하고 합성 자료를 구분한다", () => {
  const csv = reviewCsv(
    request,
    [{ ...evidence, title: "=SUM(1,2)" }],
    [{ ...quote, supplier: '"테스트"' }],
  );
  assert.ok(csv.includes("'=SUM(1,2)"));
  assert.ok(csv.includes('""테스트""'));
  assert.ok(csv.includes("합성 예시"));
});
test("새 작업 백업은 견적·선택 사유·조회 범위를 보존하며 손상된 금액과 날짜는 거부한다", () => {
  const data = {
    request,
    evidence: [evidence],
    quotes: [quote],
    decision: { quoteId: "q1", reason: "조건과 납기를 확인한 테스트 대안" },
    receipts: [
      {
        id: "r",
        kind: "bid",
        query: request.item,
        queriedAt: "2026-10-23T00:00:00Z",
        page: 1,
        days: 30,
        totalCount: 50,
        returnedCount: 30,
        note: "첫 페이지",
      },
    ],
    checks: [],
    logs: [],
    report: "",
    mode: "demo",
  };
  assert.deepEqual(parseWorkspace(data), data);
  assert.throws(() =>
    parseWorkspace({ ...data, quotes: [{ ...quote, deliveryCost: -1 }] }),
  );
  assert.throws(() =>
    parseWorkspace({
      ...data,
      quotes: [{ ...quote, validUntil: "2026-02-30" }],
    }),
  );
});
