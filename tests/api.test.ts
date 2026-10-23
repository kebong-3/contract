import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/analyze/route.ts";
import { GET as procurement } from "../app/api/procurement/route.ts";
import { GET as status } from "../app/api/status/route.ts";
import { getProcurement } from "../lib/public-data.ts";

test("API validation, missing keys and protected access return explicit errors", async () => {
  const names = [
    "APP_ACCESS_TOKEN",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "DATA_GO_KR_SERVICE_KEY",
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  names.forEach((name) => delete process.env[name]);
  const req = (body: unknown, token?: string) =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await POST(req({ prompt: "", provider: "groq" }))).status,
      400,
    );
    assert.equal(
      (await POST(req({ prompt: "x".repeat(12001), provider: "groq" }))).status,
      400,
    );
    assert.equal(
      (await POST(req({ prompt: "자료 검토", provider: "other" }))).status,
      400,
    );
    assert.equal(
      (await POST(req({ prompt: "자료 검토", provider: "groq" }))).status,
      503,
    );
    assert.equal(
      (await POST(req({ prompt: "자료 검토", provider: "gemma" }))).status,
      503,
    );
    assert.equal(
      (
        await procurement(
          new Request("http://localhost/api/procurement?query=a"),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await procurement(
          new Request("http://localhost/api/procurement?query=가구&kind=no"),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await procurement(
          new Request("http://localhost/api/procurement?query=가구"),
        )
      ).status,
      503,
    );
    process.env.APP_ACCESS_TOKEN = "test-private-token";
    assert.equal(
      (await POST(req({ prompt: "자료 검토", provider: "groq" }))).status,
      401,
    );
    assert.equal(
      (await POST(req({ prompt: "자료 검토", provider: "groq" }, "wrong")))
        .status,
      401,
    );
    assert.equal(
      (
        await POST(
          req({ prompt: "자료 검토", provider: "groq" }, "test-private-token"),
        )
      ).status,
      503,
    );
    assert.equal(
      (
        await procurement(
          new Request("http://localhost/api/procurement?query=가구"),
        )
      ).status,
      401,
    );
    process.env.GROQ_API_KEY = "secret-should-not-leak";
    const response = await status();
    const text = await response.text();
    assert.equal(JSON.parse(text).groq, true);
    assert.equal(JSON.parse(text).accessProtected, true);
    assert.ok(!text.includes("secret-should-not-leak"));
    assert.ok(!text.includes("test-private-token"));
  } finally {
    names.forEach((name) => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  }
});

test("official defaults work without URL settings and use service-specific search/date parameters", async () => {
  const names = [
    "DATA_GO_KR_SERVICE_KEY",
    "PROCUREMENT_BID_URL",
    "PROCUREMENT_AWARD_URL",
    "PROCUREMENT_SHOPPING_URL",
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const originalFetch = globalThis.fetch;
  names.forEach((name) => delete process.env[name]);
  process.env.DATA_GO_KR_SERVICE_KEY = "only-test-key";
  const called: URL[] = [];
  globalThis.fetch = async (input) => {
    called.push(new URL(String(input)));
    return Response.json({
      response: { header: { resultCode: "00" }, body: { items: [] } },
    });
  };
  try {
    for (const kind of ["bid", "award", "shopping"] as const) {
      const result = await getProcurement("공기청정기", kind);
      assert.deepEqual(result.items, []);
      assert.ok(!JSON.stringify(result).includes("only-test-key"));
    }
    assert.equal(
      called[0].pathname,
      "/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch",
    );
    assert.equal(
      called[1].pathname,
      "/1230000/as/ScsbidInfoService/getScsbidListSttusThngPPSSrch",
    );
    assert.equal(
      called[2].pathname,
      "/1230000/at/ShoppingMallPrdctInfoService/getShoppingMallPrdctInfoList",
    );
    for (const url of called.slice(0, 2)) {
      assert.equal(url.searchParams.get("bidNtceNm"), "공기청정기");
      assert.match(url.searchParams.get("inqryBgnDt")!, /^\d{12}$/);
      assert.match(url.searchParams.get("inqryEndDt")!, /^\d{12}$/);
    }
    assert.equal(called[0].searchParams.get("inqryDiv"), "1");
    assert.equal(called[1].searchParams.get("inqryDiv"), "2");
    assert.equal(called[2].searchParams.get("prdctClsfcNoNm"), "공기청정기");
    assert.equal(called[2].searchParams.get("inqryDiv"), "1");
    assert.equal(called[2].searchParams.get("regtCncelYn"), "N");
    assert.match(called[2].searchParams.get("inqryBgnDate")!, /^\d{8}$/);
    assert.match(called[2].searchParams.get("inqryEndDate")!, /^\d{8}$/);
    for (const url of called) {
      assert.equal(url.hostname, "apis.data.go.kr");
      assert.equal(url.searchParams.get("serviceKey"), "only-test-key");
      assert.equal(url.searchParams.get("type"), "json");
      assert.equal(url.searchParams.get("numOfRows"), "30");
      assert.ok(!url.href.includes("%7B"));
    }
    const config = await (await status()).json();
    assert.equal(config.bid, true);
    assert.equal(config.award, true);
    assert.equal(config.shopping, true);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name) => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  }
});

test("catalog mapping preserves product identity, specification, supplier and unverified price", async () => {
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.DATA_GO_KR_SERVICE_KEY;
  const savedUrl = process.env.PROCUREMENT_SHOPPING_URL;
  process.env.DATA_GO_KR_SERVICE_KEY = "catalog-test-key";
  delete process.env.PROCUREMENT_SHOPPING_URL;
  globalThis.fetch = async () =>
    Response.json({
      response: {
        header: { resultCode: "00" },
        body: {
          items: {
            item: [
              {
                shopngCntrctNo: "TEST-CONTRACT",
                shopngCntrctSno: "1",
                prdctIdntNo: "TEST-ID",
                prdctSpecNm: "공기청정기, 규격 A",
                cntrctCorpNm: "테스트 공급자",
                cntrctPrceAmt: "780000",
              },
              {
                shopngCntrctNo: "TEST-CONTRACT",
                shopngCntrctSno: "2",
                prdctIdntNo: "TEST-ID",
                prdctSpecNm: "공기청정기, 규격 B",
                cntrctCorpNm: "테스트 공급자",
                cntrctPrceAmt: "810000",
              },
            ],
          },
        },
      },
    });
  try {
    const result = await getProcurement("공기청정기", "shopping");
    assert.equal(result.items.length, 2);
    assert.notEqual(result.items[0].id, result.items[1].id);
    assert.equal(result.items[0].title, "공기청정기, 규격 A");
    assert.equal(result.items[0].agency, "테스트 공급자");
    assert.ok(result.items[0].description.includes("780,000"));
    assert.equal(result.items[0].unitPrice, null);
    assert.equal(result.items[0].isDemo, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedKey === undefined) delete process.env.DATA_GO_KR_SERVICE_KEY;
    else process.env.DATA_GO_KR_SERVICE_KEY = savedKey;
    if (savedUrl === undefined) delete process.env.PROCUREMENT_SHOPPING_URL;
    else process.env.PROCUREMENT_SHOPPING_URL = savedUrl;
  }
});

test("live response never promotes an unverified total into a comparable unit price", async () => {
  const originalFetch = globalThis.fetch;
  const names = [
    "APP_ACCESS_TOKEN",
    "DATA_GO_KR_SERVICE_KEY",
    "PROCUREMENT_BID_URL",
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  delete process.env.APP_ACCESS_TOKEN;
  process.env.DATA_GO_KR_SERVICE_KEY = "test%2Bkey";
  process.env.PROCUREMENT_BID_URL =
    "https://apis.data.go.kr/approved/operation?bidNtceNm={query}";
  let calledUrl = "";
  globalThis.fetch = async (input) => {
    calledUrl = String(input);
    return Response.json({
      response: {
        header: { resultCode: "00" },
        body: {
          items: [
            {
              bidNtceNo: "2026-1",
              bidNtceNm: "공기청정기 구매",
              dminsttNm: "공개기관",
              asignBdgtAmt: "10000000",
              bidNtceDtlUrl: "javascript:alert(1)",
            },
          ],
        },
      },
    });
  };
  try {
    const response = await procurement(
      new Request("http://localhost/api/procurement?query=공기청정기"),
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(
      new URL(calledUrl).searchParams.get("bidNtceNm"),
      "공기청정기",
    );
    assert.equal(new URL(calledUrl).searchParams.get("serviceKey"), "test+key");
    const item = data.items[0];
    assert.equal(item.agency, "공개기관");
    assert.equal(item.unitPrice, null);
    assert.equal(item.quantity, null);
    assert.equal(item.mixed, true);
    assert.equal(item.isDemo, false);
    assert.equal(item.source, "bid");
    assert.equal(item.vat, "unknown");
    assert.ok(item.description.includes("단가 아님"));
    assert.ok(item.url.startsWith("https://www.data.go.kr/"));
    assert.ok(!JSON.stringify(data).includes("test+key"));
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name) => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  }
});
