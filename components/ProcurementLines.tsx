"use client";
import { useState } from "react";
import type { Evidence } from "@/lib/domain";
import { formatWon } from "@/lib/review";
export default function ProcurementLines({
  evidence,
  token,
  onAdd,
}: {
  evidence: Evidence;
  token: string;
  onAdd: (e: Evidence) => void;
}) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  if (evidence.isDemo || !evidence.noticeNumber || !evidence.noticeOrder)
    return null;
  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/procurement/details?noticeNo=${encodeURIComponent(evidence.noticeNumber!)}&noticeOrder=${encodeURIComponent(evidence.noticeOrder!)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "품목 구성 조회 실패");
      setItems(d.items);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-reasons">
      <h3>이 공고의 품목 구성</h3>
      <p className="hint">
        기존 나라장터 API로 수량·규격·단가를 더 확인합니다. 낙찰 자료에서 열어도
        이 정보는 공고 단계의 계획입니다.
      </p>
      <button className="secondary" onClick={load} disabled={busy}>
        {busy ? "조회 중…" : "공고 품목 구성 조회"}
      </button>
      {error && <p role="alert">{error}</p>}
      {loaded && !items.length && (
        <p>공고번호·차수와 일치하는 구매대상 물품이 없습니다.</p>
      )}
      {items.map((e) => (
        <article className="line-item" key={e.id}>
          <strong>{e.title}</strong>
          <p>
            {e.quantity ?? "미확인"}
            {e.unit} · 공고 단가 {formatWon(e.unitPrice)}
          </p>
          <p>{e.description}</p>
          <button
            className="secondary"
            disabled={added.includes(e.id)}
            onClick={() => {
              onAdd(e);
              setAdded([...added, e.id]);
            }}
          >
            {added.includes(e.id) ? "추가됨" : "참고자료에 추가"}
          </button>
        </article>
      ))}
    </section>
  );
}
