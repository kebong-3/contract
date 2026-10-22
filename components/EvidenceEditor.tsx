"use client";

import { useState } from "react";
import type { Evidence } from "@/lib/domain";

export default function EvidenceEditor({
  evidence,
  onSave,
}: {
  evidence: Evidence;
  onSave: (e: Evidence, reason: string) => void;
}) {
  const [price, setPrice] = useState(evidence.unitPrice?.toString() ?? "");
  const [quantity, setQuantity] = useState(evidence.quantity?.toString() ?? "");
  const [spec, setSpec] = useState(evidence.spec?.toString() ?? "");
  const [draft, setDraft] = useState(evidence);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = price.trim() ? Number(price) : null;
    const count = quantity.trim() ? Number(quantity) : null;
    const specification = spec.trim() ? Number(spec) : null;
    if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0))
      return setError("단가는 0보다 큰 정수로 입력하거나 비워 두세요.");
    if (count !== null && (!Number.isSafeInteger(count) || count <= 0))
      return setError("수량은 0보다 큰 정수로 입력하거나 비워 두세요.");
    if (
      specification !== null &&
      (!Number.isFinite(specification) || specification < 0)
    )
      return setError("사양은 0 이상의 숫자로 입력하거나 비워 두세요.");
    if (!reason.trim())
      return setError("확인한 원문 위치와 변경 사유를 입력해 주세요.");
    // Identity and provenance remain those of the original source record.
    onSave(
      {
        ...evidence,
        unitPrice: amount,
        quantity: count,
        spec: specification,
        method: draft.method,
        mixed: draft.mixed,
        unit: draft.unit,
        vat: draft.vat,
        installation: draft.installation,
        maintenance: draft.maintenance,
        description: draft.description,
      },
      reason.trim(),
    );
    setError("");
    setSaved(true);
  }
  const fieldStyle = { display: "grid", gap: 6, fontSize: 13 };
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #dce3e0",
    borderRadius: 10,
    background: "#fff",
    color: "#253a35",
  };
  return (
    <form
      onSubmit={save}
      style={{
        marginTop: 24,
        padding: 20,
        border: "1px solid #dce3e0",
        borderRadius: 16,
        background: "#f6f9f7",
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <strong>원문 확인 후 비교 조건 보완</strong>
        <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 0 }}>
          원자료를 변경하는 기능이 아닙니다. 이 검토에서 사용할 확인값과 사유를
          기록합니다. 원문에서 확인되지 않는 항목은 비워 두거나 ‘미확인’으로
          남겨 주세요. 예시 자료도 편집할 수 있지만 실제 근거가 되지는 않습니다.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <label style={fieldStyle}>
          확인 단가(원)
          <input
            style={inputStyle}
            inputMode="numeric"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setSaved(false);
            }}
            placeholder="미확인"
          />
        </label>
        <label style={fieldStyle}>
          거래 수량
          <input
            style={inputStyle}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setSaved(false);
            }}
            placeholder="미확인"
          />
        </label>
        <label style={fieldStyle}>
          대표 사양값
          <input
            style={inputStyle}
            inputMode="decimal"
            value={spec}
            onChange={(e) => {
              setSpec(e.target.value);
              setSaved(false);
            }}
            placeholder="미확인"
          />
        </label>
        <label style={fieldStyle}>
          계약 방식
          <select
            style={inputStyle}
            value={draft.method}
            onChange={(e) =>
              setDraft({
                ...draft,
                method: e.target.value as Evidence["method"],
              })
            }
          >
            <option value="purchase">구매</option>
            <option value="rental">임대</option>
          </select>
        </label>
        <label style={fieldStyle}>
          단위
          <select
            style={inputStyle}
            value={draft.unit}
            onChange={(e) =>
              setDraft({ ...draft, unit: e.target.value as Evidence["unit"] })
            }
          >
            <option value="대">대</option>
            <option value="개">개</option>
            <option value="세트">세트</option>
          </select>
        </label>
        {(["vat", "installation", "maintenance"] as const).map((key) => (
          <label key={key} style={fieldStyle}>
            {key === "vat"
              ? "부가세"
              : key === "installation"
                ? "설치"
                : "유지관리"}
            <select
              style={inputStyle}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            >
              <option value="unknown">미확인</option>
              <option value="included">포함</option>
              <option value="excluded">별도·미포함</option>
            </select>
          </label>
        ))}
      </div>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <input
          type="checkbox"
          checked={draft.mixed}
          onChange={(e) => setDraft({ ...draft, mixed: e.target.checked })}
          style={{ marginTop: 4 }}
        />
        여러 품목이 섞였거나 단품 구성·가격 분리가 확인되지 않았습니다.
      </label>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
        실시간 자료는 안전한 비교를 위해 복합 구성으로 시작할 수 있습니다. 단품
        단가와 구성을 직접 확인한 경우에만 위 항목을 해제하세요.
      </p>
      <label style={fieldStyle}>
        확인 내용
        <textarea
          style={inputStyle}
          rows={3}
          maxLength={3000}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label style={fieldStyle}>
        변경 사유 및 확인 위치(필수)
        <textarea
          style={inputStyle}
          rows={3}
          maxLength={1000}
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSaved(false);
          }}
          placeholder="예: 규격서 2쪽에서 단품 수량과 설치 포함 조건 확인"
        />
      </label>
      {error && (
        <p role="alert" style={{ color: "#a33232", margin: 0 }}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" style={{ color: "#236d55", margin: 0 }}>
          확인값과 변경 사유를 반영했습니다. 비교 분류는 조건에 따라 다시
          계산됩니다.
        </p>
      )}
      <button
        type="submit"
        style={{
          padding: "12px 16px",
          background: "#245f4d",
          color: "white",
          border: 0,
          borderRadius: 10,
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        확인값 승인·반영
      </button>
      <small style={{ lineHeight: 1.6, color: "#61736c" }}>
        이 승인은 입력값 확인 기록이며 계약·발주 결재가 아닙니다. 원자료의
        기관·날짜·출처와 예시 여부는 유지됩니다.
      </small>
    </form>
  );
}
