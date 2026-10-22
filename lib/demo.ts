import type { Evidence } from "./domain";

export function getDemoEvidence(item: string): Evidence[] {
  const laptop = item.includes("노트북");
  const chair = item.includes("의자");
  const name = laptop ? "노트북" : chair ? "사무용 의자" : "공기청정기";
  const prices = laptop
    ? [1250000, 1320000, 1410000, 990000, 65000, 1190000, 1380000]
    : chair
      ? [220000, 245000, 265000, 150000, 15000, 210000, 240000]
      : [620000, 680000, 730000, 420000, 35000, 590000, 650000];
  const spec = laptop ? 16 : chair ? 120 : 100;
  const base = (i: number): Evidence => ({
    id: `demo-${laptop ? "laptop" : chair ? "chair" : "air"}-${i + 1}`,
    title: `[가상] ${name} ${i + 1}번 구매 사례`,
    agency: `가상기관 ${String.fromCharCode(65 + i)}`,
    date: `2026-0${9 - i}-15`,
    unitPrice: prices[i],
    quantity: [10, 15, 8, 20, 10, 12, 9][i],
    spec,
    method: "purchase",
    installation: "included",
    maintenance: "excluded",
    vat: "included",
    source: i % 3 === 0 ? "bid" : i % 3 === 1 ? "award" : "shopping",
    url: null,
    isDemo: true,
    unit: chair ? "개" : "대",
    mixed: false,
    description:
      "화면과 계산을 체험하기 위한 합성 데이터입니다. 실제 공고·계약·가격이 아닙니다.",
  });
  const rows = Array.from({ length: 7 }, (_, i) => base(i));
  rows[3] = {
    ...rows[3],
    spec: laptop ? 8 : chair ? 80 : 50,
    title: `[가상] ${name} 최소 사양 미달 사례`,
  };
  rows[4] = {
    ...rows[4],
    method: "rental",
    title: `[가상] ${name} 월 임대 사례`,
    description: "월 임대료입니다. 구매 단가와 비교할 수 없습니다.",
  };
  rows[5] = {
    ...rows[5],
    installation: "unknown",
    vat: "unknown",
    title: `[가상] ${name} 조건 미확인 사례`,
  };
  rows[6] = {
    ...rows[6],
    mixed: true,
    unit: "세트",
    title: `[가상] ${name} 외 복합 구성 사례`,
  };
  return rows;
}
