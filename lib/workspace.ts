import type { Evidence, PurchaseRequest } from "./domain.ts";

export type Workspace = {
  request: PurchaseRequest;
  evidence: Evidence[];
  checks: string[];
  logs: string[];
  report: string;
  mode: "demo" | "live";
};

function invalid(): never {
  throw new Error(
    "올바른 작업 백업 파일인지 확인해 주세요. 입력값 또는 자료 구분이 유효하지 않습니다.",
  );
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    return invalid();
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") return invalid();
  return value;
}
function number(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    return invalid();
  return value;
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T))
    return invalid();
  return value as T;
}
function strings(value: unknown, maxRows: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxRows) return invalid();
  return value.map((item) => string(item, maxLength));
}
function link(value: unknown): string | null {
  if (value === null) return null;
  const text = string(value, 4000);
  try {
    const url = new URL(text);
    if (url.protocol === "https:" && !url.username && !url.password)
      return text;
  } catch {
    /* Reject malformed URL below. */
  }
  return invalid();
}

export function parseWorkspace(value: unknown): Workspace {
  const root = object(value),
    input = object(root.request);
  const mode = choice(root.mode, ["demo", "live"] as const);
  const request: PurchaseRequest = {
    item: string(input.item, 200, true),
    quantity: number(input.quantity, 1, 100000, true),
    budget: number(input.budget, 0, Number.MAX_SAFE_INTEGER, true),
    minSpec: number(input.minSpec, 0, Number.MAX_SAFE_INTEGER),
    installation: bool(input.installation),
    maintenance: bool(input.maintenance),
    method: choice(input.method, ["purchase", "rental"] as const),
  };
  if (!Array.isArray(root.evidence) || root.evidence.length > 200)
    return invalid();
  const ids = new Set<string>();
  const evidence: Evidence[] = root.evidence.map((raw) => {
    const row = object(raw),
      id = string(row.id, 300, true);
    if (ids.has(id)) return invalid();
    ids.add(id);
    const isDemo = bool(row.isDemo);
    if (isDemo !== (mode === "demo")) return invalid();
    return {
      id,
      title: string(row.title, 500, true),
      agency: string(row.agency, 300),
      date: string(row.date, 100),
      // Keep the eventual unitPrice × request.quantity calculation a safe integer.
      unitPrice:
        row.unitPrice === null
          ? null
          : number(
              row.unitPrice,
              0,
              Math.floor(Number.MAX_SAFE_INTEGER / request.quantity),
              true,
            ),
      quantity:
        row.quantity === null ? null : number(row.quantity, 1, 100000, true),
      spec:
        row.spec === null ? null : number(row.spec, 0, Number.MAX_SAFE_INTEGER),
      method: choice(row.method, ["purchase", "rental"] as const),
      installation: choice(row.installation, [
        "included",
        "excluded",
        "unknown",
      ] as const),
      maintenance: choice(row.maintenance, [
        "included",
        "excluded",
        "unknown",
      ] as const),
      vat: choice(row.vat, ["included", "excluded", "unknown"] as const),
      source: choice(row.source, ["bid", "award", "shopping"] as const),
      url: link(row.url),
      isDemo,
      description: string(row.description, 10000),
      unit: choice(row.unit, ["대", "개", "세트"] as const),
      mixed: bool(row.mixed),
    };
  });
  return {
    request,
    evidence,
    mode,
    checks: strings(root.checks, 200, 1000),
    logs: strings(root.logs, 1000, 2000),
    report: string(root.report, 100000),
  };
}
