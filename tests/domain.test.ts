import test from "node:test";
import assert from "node:assert/strict";
import { classifyEvidence, summarize } from "../lib/domain.ts";
import type { Evidence, PurchaseRequest } from "../lib/domain.ts";

const request: PurchaseRequest = {
  item: "공기청정기",
  quantity: 10,
  budget: 10000000,
  minSpec: 80,
  installation: true,
  maintenance: false,
  method: "purchase",
};
const base: Evidence = {
  id: "a",
  title: "가상",
  agency: "가상기관",
  date: "2026-09-01",
  unitPrice: 600000,
  quantity: 10,
  spec: 100,
  method: "purchase",
  installation: "included",
  maintenance: "excluded",
  vat: "included",
  source: "award",
  url: null,
  isDemo: true,
  description: "가상",
  unit: "대",
  mixed: false,
};

test("임대·복합 구성·미달 사양을 낮은 가격이라는 이유로 비교에 포함하지 않는다", () => {
  for (const change of [
    { method: "rental" },
    { mixed: true },
    { spec: 50 },
    { unit: "세트" },
    { installation: "excluded" },
  ]) {
    assert.equal(
      classifyEvidence({ ...base, ...change } as Evidence, request).status,
      "excluded",
    );
  }
});
test("미확인 가격·부가세·사양·수량은 조건부로 남는다", () => {
  for (const change of [
    { unitPrice: null },
    { unitPrice: -1 },
    { unitPrice: NaN },
    { vat: "excluded" },
    { vat: "unknown" },
    { spec: null },
    { quantity: null },
    { installation: "unknown" },
  ]) {
    assert.equal(
      classifyEvidence({ ...base, ...change } as Evidence, request).status,
      "conditional",
    );
  }
});
test("유지관리 포함 요청은 미포함 사례를 제외한다", () => {
  assert.equal(
    classifyEvidence(base, { ...request, maintenance: true }).status,
    "excluded",
  );
});
test("검증된 비교 사례만 중앙값·소요액에 반영하고 중복을 제거한다", () => {
  const result = summarize(request, [
    base,
    base,
    { ...base, id: "b", unitPrice: 800000 },
    { ...base, id: "c", unitPrice: 10000, method: "rental" },
    { ...base, id: "d", vat: "unknown" },
  ]);
  assert.deepEqual(result, {
    count: 2,
    min: 600000,
    max: 800000,
    median: 700000,
    total: 7000000,
    balance: 3000000,
    unknownCount: 1,
  });
});
test("비교 가능한 사례가 없으면 0원 대신 미산출로 반환한다", () => {
  assert.equal(summarize(request, []).total, null);
  assert.equal(summarize(request, []).median, null);
});
test("잘못된 수량으로 소요액을 산출하지 않는다", () => {
  assert.equal(summarize({ ...request, quantity: -2 }, [base]).total, null);
  assert.equal(summarize({ ...request, quantity: 1.5 }, [base]).total, null);
});
