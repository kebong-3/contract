"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCheck, ClipboardList } from "lucide-react";
import type { PurchaseRequest } from "@/lib/domain";
import {
  evaluateQuote,
  formatWon,
  type Quote,
  type Decision,
} from "@/lib/review";

export default function QuoteBoard({
  request,
  quotes,
  decision,
  onChange,
  onDecision,
}: {
  request: PurchaseRequest;
  quotes: Quote[];
  decision: Decision | null;
  onChange: (quotes: Quote[]) => void;
  onDecision: (d: Decision | null) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [reason, setReason] = useState(decision?.reason || "");
  const [candidate, setCandidate] = useState(decision?.quoteId || "");
  const [error, setError] = useState("");
  useEffect(() => {
    if (decision) {
      setReason(decision.reason);
      setCandidate(decision.quoteId);
    }
  }, [decision]);
  const active = quotes.find((q) => q.id === editing);
  const update = (field: Partial<Quote>) => {
    if (active)
      onChange(
        quotes.map((q) => (q.id === active.id ? { ...q, ...field } : q)),
      );
  };
  function add() {
    if (quotes.length >= 20) {
      setError("한 검토에서 견적은 최대 20건까지 등록할 수 있어요.");
      return;
    }
    const q: Quote = {
      id: crypto.randomUUID(),
      supplier: "",
      model: request.item,
      quantity: request.quantity,
      unit: request.unit || "대",
      unitPrice: null,
      vat: "unknown",
      vatAmount: null,
      deliveryCost: null,
      installationCost: null,
      maintenanceCost: null,
      maintenanceScope: "",
      validUntil: "",
      sourceNote: "",
      requirementsConfirmed: false,
      taxBasisConfirmed: false,
    };
    onChange([...quotes, q]);
    setEditing(q.id);
  }
  function record() {
    const q = quotes.find((q) => q.id === candidate);
    if (!q || !evaluateQuote(q, request).eligible) {
      setError("필수 조건을 확인한 견적을 선택해주세요.");
      return;
    }
    if (reason.trim().length < 10) {
      setError(
        "선택 이유를 10자 이상 기록해주세요. 가격 외 납기·보증·사양도 고려하세요.",
      );
      return;
    }
    onDecision({ quoteId: q.id, reason: reason.trim() });
    setError("");
  }
  const numberField = (
    label: string,
    key:
      | "unitPrice"
      | "vatAmount"
      | "deliveryCost"
      | "installationCost"
      | "maintenanceCost",
  ) => (
    <label className="field-label" key={key}>
      {label}
      <input
        type="number"
        min="0"
        step="1"
        aria-label={label}
        value={active?.[key] ?? ""}
        placeholder="미확인 (없음 확인 시 0)"
        onChange={(e) => {
          const n = e.target.value === "" ? null : Number(e.target.value);
          if (n === null || (Number.isSafeInteger(n) && n >= 0))
            update({ [key]: n });
        }}
      />
    </label>
  );
  return (
    <section className="white-card quote-board">
      <div className="section-title">
        <h2>
          <ClipboardList size={18} /> 받은 견적 비교{" "}
          <span>참고 시세와 실제 견적을 구분해요</span>
        </h2>
        <button className="primary" onClick={add}>
          <Plus size={15} /> 견적 등록
        </button>
      </div>
      <p className="hint">
        견적서에서 확인한 값만 입력하세요. 추가 비용이 없으면 0원, 모르면
        빈칸으로 남깁니다. 파일을 외부 AI에 자동 전송하지 않습니다.
      </p>
      {!quotes.length ? (
        <div className="quote-empty">
          받은 견적이 있다면 업체별 총비용과 빠진 조건을 여기서 비교해보세요.
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>업체·제품</th>
                <th>본체 금액</th>
                <th>부대비용 포함 총액</th>
                <th>확인 상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const r = evaluateQuote(q, request);
                return (
                  <tr key={q.id}>
                    <td>
                      <strong>{q.supplier || "업체명 미입력"}</strong>
                      <small>
                        {q.model} · {q.quantity}
                        {q.unit}
                      </small>
                    </td>
                    <td>{formatWon(r.base)}</td>
                    <td>
                      <b>{formatWon(r.total)}</b>
                      <small>
                        {r.balance !== null
                          ? r.balance < 0
                            ? `예산 ${formatWon(-r.balance)} 초과`
                            : `예산 잔액 ${formatWon(r.balance)}`
                          : "미확인 비용을 0원으로 보지 않아요"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${r.eligible ? "comparable" : "conditional"}`}
                      >
                        {r.eligible
                          ? "입력 조건 확인됨"
                          : `확인 ${r.reasons.length}건`}
                      </span>
                      {decision?.quoteId === q.id && (
                        <small>담당자 검토 대안</small>
                      )}
                    </td>
                    <td>
                      <div className="button-group">
                        <button
                          className="secondary"
                          onClick={() => setEditing(q.id)}
                        >
                          편집
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${q.supplier || "미입력 업체"} 견적 삭제`}
                          onClick={() => {
                            if (
                              confirm(
                                "이 견적을 삭제할까요? 백업이 없으면 복원할 수 없습니다.",
                              )
                            ) {
                              onChange(quotes.filter((x) => x.id !== q.id));
                              if (decision?.quoteId === q.id) onDecision(null);
                              if (editing === q.id) setEditing(null);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {active && (
        <form
          className="quote-form"
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(null);
          }}
        >
          <div className="section-title">
            <h3>견적 조건 입력</h3>
            <button className="secondary" type="submit">
              입력 마치기
            </button>
          </div>
          <div className="quote-fields">
            <label className="field-label">
              업체명
              <input
                maxLength={200}
                value={active.supplier}
                onChange={(e) => update({ supplier: e.target.value })}
              />
            </label>
            <label className="field-label">
              제품·규격명
              <input
                maxLength={500}
                value={active.model}
                onChange={(e) => update({ model: e.target.value })}
              />
            </label>
            <label className="field-label">
              견적 수량
              <input
                type="number"
                min="1"
                max="100000"
                value={active.quantity}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n > 0 && n <= 100000)
                    update({ quantity: n });
                }}
              />
            </label>
            <label className="field-label">
              견적 단위
              <select
                value={active.unit}
                onChange={(e) =>
                  update({ unit: e.target.value as Quote["unit"] })
                }
              >
                <option>대</option>
                <option>개</option>
                <option>세트</option>
              </select>
            </label>
            {numberField("본체 단가 (원)", "unitPrice")}
            <label className="field-label">
              입력 금액의 부가세 기준
              <select
                value={active.vat}
                onChange={(e) =>
                  update({ vat: e.target.value as Quote["vat"] })
                }
              >
                <option value="unknown">미확인</option>
                <option value="included">모두 부가세 포함</option>
                <option value="excluded">모두 부가세 별도</option>
              </select>
            </label>
            {active.vat === "excluded" &&
              numberField("견적서의 부가세 총액 (원)", "vatAmount")}
            {numberField("추가 배송비 총액 (원)", "deliveryCost")}
            {numberField("추가 설치비 총액 (원)", "installationCost")}
            {numberField("추가 유지관리비 총액 (원)", "maintenanceCost")}
            <label className="field-label">
              유지관리 범위·기간
              <input
                maxLength={1000}
                value={active.maintenanceScope}
                placeholder="예: 필터 교체 포함 12개월 / 없음"
                onChange={(e) => update({ maintenanceScope: e.target.value })}
              />
            </label>
            <label className="field-label">
              견적 유효기한
              <input
                type="date"
                value={active.validUntil}
                onChange={(e) => update({ validUntil: e.target.value })}
              />
            </label>
          </div>
          <label className="field-label">
            견적서 확인 위치
            <input
              maxLength={2000}
              value={active.sourceNote}
              placeholder="예: 공개 견적서 A, 2쪽 (민감정보 입력 금지)"
              onChange={(e) => update({ sourceNote: e.target.value })}
            />
          </label>
          <div className="quote-checks">
            <label>
              <input
                type="checkbox"
                checked={active.requirementsConfirmed}
                onChange={(e) =>
                  update({ requirementsConfirmed: e.target.checked })
                }
              />
              필수 사양·납기·보증과 유지관리 범위가 요청 조건에 맞는지
              확인했습니다.
            </label>
            <label>
              <input
                type="checkbox"
                checked={active.taxBasisConfirmed}
                onChange={(e) =>
                  update({ taxBasisConfirmed: e.target.checked })
                }
              />
              본체·배송·설치·유지비가 모두 같은 부가세 기준이고 중복 합산되지
              않음을 확인했습니다.
            </label>
          </div>
          <div className="quote-gaps">
            <strong>추가 확인 사항</strong>
            {evaluateQuote(active, request).reasons.map((r) => (
              <p key={r}>• {r}</p>
            ))}
            {evaluateQuote(active, request).eligible && (
              <p>
                입력된 비교 조건을 확인했습니다. 실제 계약·결재 승인을 뜻하지
                않습니다.
              </p>
            )}
          </div>
        </form>
      )}
      {!!quotes.length && (
        <div className="decision-box">
          <h3>
            <CheckCheck size={17} /> 검토할 대안과 이유 남기기
          </h3>
          <p className="hint">
            최저가를 자동 선정하지 않습니다. 조건이 확인된 견적 중 담당자가 검토
            대안을 기록하세요.
          </p>
          <div className="button-group">
            <select
              aria-label="검토 대안"
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
            >
              <option value="">견적 선택</option>
              {quotes
                .filter((q) => evaluateQuote(q, request).eligible)
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.supplier} · {formatWon(evaluateQuote(q, request).total)}
                  </option>
                ))}
            </select>
            <button className="secondary" onClick={record}>
              선택 이유 기록
            </button>
          </div>
          <textarea
            aria-label="대안 선택 이유"
            maxLength={2000}
            rows={2}
            value={reason}
            placeholder="가격·필수 사양·납기·유지관리 조건을 고려한 검토 이유"
            onChange={(e) => setReason(e.target.value)}
          />
          {decision && (
            <p className="decision-saved">
              기록됨: {quotes.find((q) => q.id === decision.quoteId)?.supplier}{" "}
              — {decision.reason}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
