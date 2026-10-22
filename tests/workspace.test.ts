import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkspace } from "../lib/workspace.ts";

const fixture = () => ({
  request: {
    item: "공기청정기",
    quantity: 10,
    budget: 10000000,
    minSpec: 80,
    installation: true,
    maintenance: false,
    method: "purchase",
  },
  evidence: [
    {
      id: "demo-1",
      title: "합성 사례",
      agency: "가상기관",
      date: "2026-10-01",
      unitPrice: 500000,
      quantity: 10,
      spec: 100,
      method: "purchase",
      installation: "included",
      maintenance: "unknown",
      vat: "included",
      source: "bid",
      url: null,
      isDemo: true,
      description: "합성 자료",
      unit: "대",
      mixed: false,
    },
  ],
  mode: "demo",
  checks: ["사양 확인"],
  logs: ["검토 시작"],
  report: "검토서 초안",
});

test("valid demo and live workspaces round trip with independent validated objects", () => {
  const value = fixture(),
    parsed = parseWorkspace(value);
  assert.deepEqual(parsed, value);
  assert.notEqual(parsed.request, value.request);
  value.mode = "live";
  value.evidence[0].isDemo = false;
  assert.equal(parseWorkspace(value).mode, "live");
});

test("malformed fields and unsafe numbers are rejected before rendering", () => {
  for (const bad of [
    null,
    [],
    {},
    { ...fixture(), checks: "text" },
    { ...fixture(), report: undefined },
    { ...fixture(), logs: [1] },
    { ...fixture(), mode: "other" },
  ])
    assert.throws(() => parseWorkspace(bad));
  for (const value of [NaN, Infinity, -1, 0, 1.5, 100001, "10"])
    assert.throws(() =>
      parseWorkspace({
        ...fixture(),
        request: { ...fixture().request, quantity: value },
      }),
    );
  for (const value of [-1, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.1])
    assert.throws(() =>
      parseWorkspace({
        ...fixture(),
        request: { ...fixture().request, budget: value },
      }),
    );
  for (const fields of [
    { vat: "other" },
    { source: "bad" },
    { mixed: "false" },
    { method: null },
    { url: "javascript:alert(1)" },
    { url: "http://example.com/" },
    { url: "https://user:password@example.com" },
    { unitPrice: Infinity },
    { unitPrice: Number.MAX_SAFE_INTEGER },
    { title: "" },
    { description: "x".repeat(10001) },
  ])
    assert.throws(() =>
      parseWorkspace({
        ...fixture(),
        evidence: [{ ...fixture().evidence[0], ...fields }],
      }),
    );
});

test("mixed provenance, duplicate IDs and oversized collections are rejected", () => {
  assert.throws(() => parseWorkspace({ ...fixture(), mode: "live" }));
  assert.throws(() =>
    parseWorkspace({
      ...fixture(),
      evidence: [{ ...fixture().evidence[0], isDemo: false }],
    }),
  );
  assert.throws(() =>
    parseWorkspace({
      ...fixture(),
      evidence: [fixture().evidence[0], fixture().evidence[0]],
    }),
  );
  assert.throws(() =>
    parseWorkspace({
      ...fixture(),
      evidence: Array.from({ length: 201 }, (_, i) => ({
        ...fixture().evidence[0],
        id: String(i),
      })),
    }),
  );
});
