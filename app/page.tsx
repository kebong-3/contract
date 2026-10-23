"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  AlertCircle,
  RotateCcw,
  SlidersHorizontal,
  ExternalLink,
  Trash2,
} from "lucide-react";
import {
  classifyEvidence,
  summarize,
  type Evidence,
  type PurchaseRequest,
} from "@/lib/domain";
import { getDemoEvidence } from "@/lib/demo";
import EvidenceEditor from "@/components/EvidenceEditor";
import { parseWorkspace } from "@/lib/workspace";
import QuoteBoard from "@/components/QuoteBoard";
import ProcurementLines from "@/components/ProcurementLines";
import {
  quoteReport,
  reviewCsv,
  mergeEvidence,
  type Quote,
  type Decision,
  type QueryReceipt,
} from "@/lib/review";

type View = "dashboard" | "review" | "reports" | "settings";
const initial: PurchaseRequest = {
  item: "공기청정기",
  quantity: 10,
  budget: 10000000,
  minSpec: 80,
  installation: true,
  maintenance: false,
  method: "purchase",
  unit: "대",
};
const won = (n: number | null | undefined) =>
  n == null ? "산출 불가" : `${Math.round(n).toLocaleString("ko-KR")}원`;
const labels = {
  comparable: "비교 가능",
  conditional: "확인 필요",
  excluded: "비교 제외",
};
const sources = { bid: "입찰공고", award: "낙찰정보", shopping: "쇼핑몰 품목" };
function download(
  name: string,
  body: string,
  type = "text/plain;charset=utf-8",
) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob(["\ufeff", body], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [request, setRequest] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState("");
  const [provider, setProvider] = useState("groq");
  const [ai, setAi] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [token, setToken] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [report, setReport] = useState("");
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [kind, setKind] = useState<"bid" | "award" | "shopping">("bid");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [receipts, setReceipts] = useState<QueryReceipt[]>([]);
  const [days, setDays] = useState(30);
  const [queryError, setQueryError] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("procurement-workspace-v1");
      if (saved) {
        const s = parseWorkspace(JSON.parse(saved));
        if (s.request && Array.isArray(s.evidence)) {
          setRequest(s.request);
          setDraft(s.request);
          setEvidence(s.evidence);
          setMode(s.mode === "live" ? "live" : "demo");
          setChecks(s.checks || []);
          setLogs(s.logs || []);
          setReport(s.report || "");
          setQuotes(s.quotes || []);
          setDecision(s.decision || null);
          setReceipts(s.receipts || []);
        }
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          "procurement-workspace-v1",
          JSON.stringify({
            request,
            evidence,
            checks,
            logs,
            report,
            mode,
            quotes,
            decision,
            receipts,
          }),
        );
      } catch {}
    }
  }, [
    request,
    evidence,
    checks,
    logs,
    report,
    mode,
    quotes,
    decision,
    receipts,
    ready,
  ]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const rows = useMemo(
    () =>
      evidence.map((e) => ({
        ...e,
        classification: classifyEvidence(e, request),
      })),
    [evidence, request],
  );
  const summary = useMemo(
    () => summarize(request, evidence),
    [request, evidence],
  );
  const counts = {
    comparable: rows.filter((r) => r.classification.status === "comparable")
      .length,
    conditional: rows.filter((r) => r.classification.status === "conditional")
      .length,
    excluded: rows.filter((r) => r.classification.status === "excluded").length,
  };
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.classification.status === filter) &&
      `${r.title} ${r.agency}`.includes(search),
  );
  const addLog = (text: string) =>
    setLogs((l) =>
      [`${new Date().toLocaleString("ko-KR")} · ${text}`, ...l].slice(0, 50),
    );
  function demo(item = request.item) {
    if (!["공기청정기", "노트북", "사무용 의자"].includes(item)) {
      setToast(
        "예시는 공기청정기·노트북·사무용 의자만 지원해요. 구매 조건에서 품목을 선택해주세요.",
      );
      setDraft(request);
      setModal(true);
      return;
    }
    if (
      (evidence.some((e) => !e.isDemo) || quotes.length) &&
      !confirm(
        "예시를 불러오면 비교자료가 합성 사례로 바뀝니다. 받은 견적은 유지됩니다. 계속할까요?",
      )
    )
      return;
    const next: PurchaseRequest = {
      ...request,
      item,
      minSpec: item === "공기청정기" ? 80 : item === "노트북" ? 16 : 0,
      unit: item === "사무용 의자" ? "개" : ("대" as PurchaseRequest["unit"]),
    };
    setRequest(next);
    setDraft(next);
    setEvidence(getDemoEvidence(item));
    setMode("demo");
    setChecks([]);
    setReceipts([]);
    setDecision(null);
    setQueryError("");
    setAi("");
    setReport("");
    setView("review");
    addLog(`${item} 합성 예시 자료 불러오기`);
    setToast("합성 예시 자료를 불러왔어요. 실제 계약·시세 자료가 아닙니다.");
  }
  function saveRequest() {
    if (
      !draft.item.trim() ||
      !Number.isSafeInteger(draft.quantity) ||
      draft.quantity <= 0 ||
      draft.quantity > 100000 ||
      !Number.isSafeInteger(draft.budget) ||
      draft.budget < 0 ||
      !Number.isFinite(draft.minSpec) ||
      draft.minSpec < 0
    ) {
      setToast("품목, 수량(양의 정수), 예산, 사양을 확인해주세요.");
      return;
    }
    const changed = draft.item !== request.item;
    if (
      changed &&
      (evidence.length || quotes.length) &&
      !confirm(
        "품목을 바꾸면 현재 비교자료와 견적이 비워집니다. 필요한 작업을 백업했나요?",
      )
    )
      return;
    setRequest(draft);
    if (changed) {
      setEvidence([]);
      setMode("demo");
      setQuotes([]);
      setReceipts([]);
    }
    setReport("");
    setAi("");
    setChecks([]);
    setDecision(null);
    setQueryError("");
    setModal(false);
    setView("review");
    addLog("구매 조건 저장 · 비교 결과 재계산");
    setToast("구매 조건을 저장했어요.");
  }
  function makeReport() {
    const text = `구매 검토서 초안\n${!evidence.length ? "[참고사례 없음 · 견적은 사용자 입력값이며 원문 확인 필요]" : mode === "demo" ? "[참고사례는 합성 예시 — 실제 계약·가격 근거로 사용 불가 / 견적은 별도 사용자 입력]" : "[공공 API 조회 참고사례 · 견적은 별도 사용자 입력 · 담당자 확인 필요]"}\n작성일: ${new Date().toLocaleString("ko-KR")}\n\n1. 구매 조건\n품목: ${request.item}\n수량: ${request.quantity}${request.unit || "대"}\n예산 상한: ${won(request.budget)}\n최소 사양: ${request.minSpec}\n설치 포함: ${request.installation ? "필수" : "미지정"} / 유지관리 포함: ${request.maintenance ? "필수" : "미지정"}\n방식: ${request.method === "purchase" ? "구매" : "임대"}\n\n2. 비교 사례 (${rows.length}건)\n${rows.map((e) => `${e.title} [${e.isDemo ? "합성 예시" : sources[e.source]}]\n제공기관: ${e.agency} / 자료일: ${e.date}\n표시 단가: ${won(e.unitPrice)} / 단위 ${e.unit} / 수량 ${e.quantity ?? "미확인"}\n가격 구분: ${e.priceBasis || "담당자 확인값"} / 조회 시각 ${e.retrievedAt || "미기록"}\n분류: ${labels[e.classification.status]}\n사유: ${e.classification.reasons.join(", ")}\n출처: ${e.url || "합성 예시 또는 원문 링크 미제공"}\n`).join("\n")}\n3. 비교 산출\n비교 가능 사례: ${counts.comparable}건\n중앙 단가: ${won(summary.median)}\n단순 산출: ${won(summary.median)} × ${request.quantity} = ${won(summary.total)}\n예산 잔액: ${won(summary.balance)}\n※ 비교 가능한 확인 단가의 중앙값을 이용한 참고 산출이며, 적정가격·계약가격의 확정이 아닙니다. 비교 가능 사례가 3건 미만이면 대표 시세로 해석하지 마세요.\n\n4. 담당자 확인\n${["사양과 단위 일치", "부가세·설치비·배송비 확인", "소모품·유지관리 조건 확인", "출처·조회 시점 확인"].map((c) => `[${checks.includes(c) ? "확인" : "미확인"}] ${c}`).join("\n")}\n\n5. 변경 기록\n${logs.join("\n")}\n\n6. AI 검토 메모\n${ai || "AI 검토 미실행. 규칙 기반 비교 결과입니다."}\n\n담당자 최종 검토 전 초안`;
    setReport(text + quoteReport(request, quotes, decision, receipts));
    setView("reports");
    addLog("구매 검토서 초안 생성");
  }
  async function analyze() {
    if (!evidence.length && !quotes.length) {
      setToast("먼저 참고자료 또는 받은 견적을 등록해주세요.");
      return;
    }
    setBusy(true);
    try {
      const prompt = `당신은 공공 구매 검토 보조자입니다. 아래 자료만 근거로 1. 주요 비교 차이 2. 추가 확인 사항 3. 담당자 검토 의견 초안을 한국어로 간결히 작성하세요. 합성자료는 반드시 합성이라 표시하고 법률 적법성·가격 적정성을 단정하지 마세요. 공고단가·낙찰총액·쇼핑몰 계약단가·업체견적을 같은 가격으로 취급하지 마세요. 수치를 새로 만들지 마세요.\n${JSON.stringify({ request, mode, summary, quoteSummary: quoteReport(request, quotes.slice(0, 5), decision, []), totalEvidence: rows.length, evidence: rows.slice(0, 10).map(({ description, ...row }) => ({ ...row, description: description.slice(0, 250) })) })}`;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 연결 실패");
      setAi(data.text);
      addLog(`${data.model} AI 검토 생성`);
      setToast("AI 검토 메모가 준비됐어요.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "AI 요청 실패");
    } finally {
      setBusy(false);
    }
  }
  async function live(nextPage = 1) {
    setLiveBusy(true);
    setQueryError("");
    try {
      const res = await fetch(
        `/api/procurement?query=${encodeURIComponent(request.item)}&kind=${kind}&page=${nextPage}&days=${days}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "공공 API 조회 실패");
      if (!Array.isArray(data.items))
        throw new Error("응답 형식을 확인할 수 없습니다.");
      const incoming = parseWorkspace({
        request,
        evidence: data.items,
        checks: [],
        logs: [],
        report: "",
        mode: "live",
      }).evidence;
      setEvidence((previous) =>
        mode === "live" ? mergeEvidence(previous, incoming) : incoming,
      );
      setMode("live");
      setAi("");
      setReport("");
      setChecks([]);
      setDecision(null);
      const receipt: QueryReceipt = {
        id: crypto.randomUUID(),
        kind,
        query: request.item,
        queriedAt: data.queriedAt,
        page: data.page || nextPage,
        days: data.days || days,
        totalCount: data.totalCount ?? null,
        returnedCount: data.items.length,
        note: data.note || "",
      };
      setReceipts((r) => [receipt, ...r].slice(0, 100));
      addLog(
        `공공 API 조회 ${data.items.length}건 · ${data.queriedAt || ""} · ${data.note || ""}`,
      );
      setToast(
        data.items.length
          ? "실제 조회자료를 불러왔어요. 누락 조건을 확인하세요."
          : "검색 결과가 없습니다. 검색어 또는 조회 조건을 바꿔주세요.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "조회 실패";
      setQueryError(message);
      setToast(message);
    } finally {
      setLiveBusy(false);
    }
  }
  function updateQuotes(next: Quote[]) {
    if (next.length !== quotes.length)
      addLog(`받은 견적 ${next.length}건으로 변경`);
    setQuotes(next);
    setDecision(null);
    setAi("");
    setReport("");
  }
  function addDetail(e: Evidence) {
    const validated = parseWorkspace({
      request,
      evidence: [e],
      checks: [],
      logs: [],
      report: "",
      mode: "live",
    }).evidence[0];
    setEvidence((items) => mergeEvidence(items, [validated]));
    setReport("");
    setAi("");
    setChecks([]);
    addLog(`${e.title} 공고 품목 상세 추가 (낙찰 단가 아님)`);
    setToast(
      "공고 품목을 참고자료에 추가했어요. 계획 단가와 실제 계약 단가를 구분해주세요.",
    );
  }
  const lastReceipt = receipts.find(
    (r) =>
      r.kind === kind &&
      r.query === request.item &&
      (kind === "shopping" || r.days === days),
  );
  const nextPage = lastReceipt ? lastReceipt.page + 1 : 1;
  const canMore =
    mode === "live" &&
    lastReceipt &&
    lastReceipt.returnedCount === 30 &&
    nextPage <= 7 &&
    evidence.length < 200 &&
    (lastReceipt.totalCount === null ||
      lastReceipt.page * 30 < lastReceipt.totalCount);
  const nav = [
    { id: "dashboard", icon: LayoutDashboard, label: "워크스페이스" },
    { id: "review", icon: Search, label: "구매 검토하기" },
    { id: "reports", icon: FileText, label: "검토서 보관함" },
    { id: "settings", icon: Settings2, label: "연결 및 설정" },
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("dashboard");
          }}
        >
          <span className="brand-symbol">
            <LayersIcon />
          </span>
          <span>
            조달근거<small>PROCUREMENT WORKSPACE</small>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="avatar-mini">공</span>
          <div>
            우리 부서 작업공간<small>공공 구매 검토 워크스페이스</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "reports" && report && (
                <span className="nav-count">1</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-guide">
          <span className="guide-icon">
            <ShieldCheck size={21} />
          </span>
          <strong>좋은 검토는, 좋은 근거에서</strong>
          <p>
            확인된 사실과 미확인 조건을
            <br />
            나누어 더 안심하고 검토하세요.
          </p>
          <button
            onClick={() =>
              setToast(
                "구매 조건 입력 → 예시 체험 또는 API 조회 → 근거 확인 → 검토서 작성 순서로 사용하세요.",
              )
            }
          >
            이용 가이드 <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="user-avatar">담</span>
          <div>
            구매 업무 담당자<small>이 브라우저에 자동 저장</small>
          </div>
          <CircleHelp size={18} />
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            내 작업공간 <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className="private-label">
              <ShieldCheck size={14} /> 검토를 돕는 업무공간
            </span>
            <button
              className="icon-button"
              aria-label="이용 안내"
              onClick={() =>
                setToast(
                  "입력 내용은 이 브라우저에 저장됩니다. AI 검토 버튼을 누를 때 비교자료가 외부 AI로 전송됩니다.",
                )
              }
            >
              <CircleHelp size={19} />
            </button>
            <span className="user-avatar small">담</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div className="eyebrow">EVERY DECISION, WITH EVIDENCE</div>
            <div className="heading-row">
              <div>
                <h1>
                  {view === "dashboard"
                    ? "구매 검토, 근거부터 차근차근."
                    : view === "review"
                      ? "비교할수록, 근거는 또렷하게."
                      : view === "reports"
                        ? "검토의 과정을 한 장에."
                        : "연결은 간단하게, 키는 안전하게."}
                </h1>
                <p>
                  {view === "dashboard"
                    ? "흩어진 조달자료를 모으고, 비교하고, 설명할 수 있는 검토서로 완성하세요."
                    : view === "review"
                      ? "같아 보이는 가격도 조건은 다를 수 있어요. 비교 가능한 근거부터 확인해보세요."
                      : view === "reports"
                        ? "비교 조건과 출처, 확인할 사항까지 빠짐없이 남겨보세요."
                        : "실제 API 연결은 서버 환경변수로 관리합니다. 브라우저에는 비밀키를 저장하지 않아요."}
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setDraft(request);
                  setModal(true);
                }}
              >
                <Plus size={17} /> 새 구매 검토
              </button>
            </div>
          </div>
          {view === "dashboard" && (
            <>
              <section className="hero-card">
                <div className="hero-copy">
                  <span className="pill lavender">
                    <Sparkles size={13} /> 더 가벼워지는 구매 업무
                  </span>
                  <h2>
                    검색에서 검토서까지,
                    <br />
                    <span>근거가 이어지는 한 공간.</span>
                  </h2>
                  <p>
                    비교할 수 있는 사례를 골라내고, 놓치기 쉬운 조건을 확인해요.
                    <br />
                    최종 판단은 담당자에게, 번거로운 정리는 조달근거에게.
                  </p>
                  <div className="hero-buttons">
                    <button
                      className="primary"
                      onClick={() => {
                        setDraft(request);
                        setModal(true);
                      }}
                    >
                      구매 검토 시작하기 <ArrowRight size={16} />
                    </button>
                    <button className="text-button" onClick={() => demo()}>
                      예시로 먼저 둘러보기 <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="hero-illustration" aria-hidden="true">
                  <div className="orbit one" />
                  <div className="orbit two" />
                  <div className="floating-note">
                    <span className="note-icon mint">
                      <CheckCheck size={18} />
                    </span>
                    비교 조건 확인 완료
                  </div>
                  <div className="illustration-paper">
                    <div className="paper-head">
                      <span className="brand-symbol">
                        <LayersIcon />
                      </span>
                      <span>
                        구매 검토서<small>근거와 함께, 더 명확하게</small>
                      </span>
                      <span className="paper-dot" />
                    </div>
                    <div className="paper-line long" />
                    <div className="paper-line" />
                    <div className="paper-chart">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="paper-bottom">
                      <Check size={13} /> 근거가 연결된 검토
                    </div>
                  </div>
                  <div className="floating-proof">
                    <span>
                      <Link2 size={16} />
                    </span>
                    <div>
                      출처까지 한 번에<small>확인 가능한 검토 근거</small>
                    </div>
                  </div>
                </div>
              </section>
              <section className="stats-grid">
                <Stat
                  icon={<FolderOpen size={20} />}
                  label="현재 검토 사례"
                  value={String(evidence.length)}
                  unit="건"
                  note="현재 작업의 비교 자료"
                  tone="purple"
                />
                <Stat
                  icon={<CheckCheck size={20} />}
                  label="비교 가능한 근거"
                  value={String(counts.comparable)}
                  unit="건"
                  note="필수 조건이 확인된 사례"
                  tone="mint"
                />
                <Stat
                  icon={<AlertCircle size={20} />}
                  label="추가 확인 필요"
                  value={String(counts.conditional)}
                  unit="건"
                  note="놓치기 쉬운 조건 확인"
                  tone="peach"
                />
                <Stat
                  icon={<FileCheck2 size={20} />}
                  label="작성한 검토서"
                  value={report ? "1" : "0"}
                  unit="건"
                  note="이 브라우저의 최근 초안"
                  tone="blue"
                />
              </section>
              <section className="workflow-section">
                <div className="section-title">
                  <h2>
                    이렇게 검토해요 <span>네 단계면 충분해요</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setView("review")}
                  >
                    검토 화면 열기 <ArrowRight size={14} />
                  </button>
                </div>
                <div className="workflow-grid">
                  {[
                    {
                      icon: ClipboardList,
                      title: "구매 조건 정리",
                      text: "품목·수량·예산과 필요한 사양을 알려주세요.",
                    },
                    {
                      icon: Search,
                      title: "비교 근거 찾기",
                      text: "공고·낙찰·품목정보를 출처와 함께 살펴봐요.",
                    },
                    {
                      icon: SlidersHorizontal,
                      title: "차이와 누락 확인",
                      text: "가격보다 먼저, 같은 조건인지 확인해요.",
                    },
                    {
                      icon: FileText,
                      title: "검토서 완성",
                      text: "비교표와 확인 사항이 담긴 초안을 만들어요.",
                    },
                  ].map((s, i) => (
                    <button
                      className="workflow-card"
                      key={s.title}
                      onClick={() =>
                        i === 0
                          ? (setDraft(request), setModal(true))
                          : i === 3
                            ? makeReport()
                            : setView("review")
                      }
                    >
                      <div className="step-top">
                        <span>
                          <s.icon size={21} />
                        </span>
                        <small>0{i + 1}</small>
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                      <ArrowUpRight className="step-arrow" size={17} />
                    </button>
                  ))}
                </div>
              </section>
              <div className="bottom-grid">
                <section className="white-card">
                  <div className="section-title">
                    <h2>최근 작업</h2>
                    <span className="muted">이 브라우저에 보관</span>
                  </div>
                  {evidence.length || quotes.length ? (
                    <button
                      className="recent-row"
                      onClick={() => setView("review")}
                    >
                      <span className="document-icon">
                        <FileText size={22} />
                      </span>
                      <div>
                        <strong>
                          {request.item} {request.quantity}
                          {request.unit || "대"} 구매 검토
                        </strong>
                        <small>
                          {mode === "demo" ? "합성 예시" : "API 조회"} · 비교
                          사례 {evidence.length}건 · 견적 {quotes.length}건
                        </small>
                      </div>
                      <span className="pill mint">검토 중</span>
                      <ChevronRight size={17} />
                    </button>
                  ) : (
                    <div className="empty-inline">
                      <FolderOpen size={30} />
                      <div>
                        아직 진행 중인 검토가 없어요.
                        <small>
                          새 구매 검토를 시작하거나 예시를 체험해보세요.
                        </small>
                      </div>
                    </div>
                  )}
                </section>
                <section className="tip-card">
                  <span className="pill peach">
                    <Sparkles size={12} /> 오늘의 검토 팁
                  </span>
                  <h3>
                    최저가를 찾기 전에,
                    <br />
                    같은 조건인지 먼저 확인하세요.
                  </h3>
                  <p>
                    설치비·부가세·유지관리 포함 여부가 다르면
                    <br />
                    단가를 바로 비교하기 어려워요.
                  </p>
                </section>
              </div>
            </>
          )}
          {view === "review" && (
            <>
              <div className={`mode-banner ${mode === "live" ? "live" : ""}`}>
                <ShieldCheck size={17} />
                <div>
                  <strong>
                    {!evidence.length
                      ? "참고자료 조회·견적 검토"
                      : mode === "demo"
                        ? "예시 자료 체험 모드"
                        : "공공 API 조회 자료"}
                  </strong>
                  <span>
                    {!evidence.length
                      ? "공개 참고자료를 조회하거나 받은 견적을 등록해 검토를 시작하세요."
                      : mode === "demo"
                        ? "합성 자료는 실제 계약·시세의 근거로 사용할 수 없어요."
                        : "원자료의 가격 성격과 누락 조건을 확인한 뒤 활용하세요."}
                  </span>
                </div>
                <button onClick={() => setView("settings")}>
                  연결 설정 <ArrowUpRight size={14} />
                </button>
              </div>
              <section className="request-card">
                <div>
                  <span className="eyebrow">PURCHASE BRIEF</span>
                  <h2>
                    {request.item}{" "}
                    <span>
                      {request.quantity}
                      {request.unit || "대"} 구매 검토
                    </span>
                  </h2>
                  <div className="brief-tags">
                    <span>예산 {won(request.budget)}</span>
                    <span>
                      최소 사양 {request.minSpec}
                      {request.item === "공기청정기"
                        ? "㎡"
                        : request.item === "노트북"
                          ? "GB"
                          : ""}
                    </span>
                    <span>
                      {request.installation
                        ? "설치 포함 필수"
                        : "설치 조건 미지정"}
                    </span>
                    <span>
                      {request.maintenance
                        ? "유지관리 포함 필수"
                        : "유지관리 별도 확인"}
                    </span>
                  </div>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setDraft(request);
                    setModal(true);
                  }}
                >
                  <Settings2 size={15} /> 조건 변경
                </button>
              </section>
              <div className="review-layout">
                <section className="white-card evidence-card">
                  <div className="section-title">
                    <h2>
                      비교 근거 <span>{evidence.length}건</span>
                    </h2>
                    <div className="button-group">
                      <button className="secondary" onClick={() => demo()}>
                        예시 불러오기
                      </button>
                      <select
                        aria-label="조회할 자료 종류"
                        value={kind}
                        onChange={(e) =>
                          setKind(
                            e.target.value as "bid" | "award" | "shopping",
                          )
                        }
                      >
                        <option value="bid">입찰공고</option>
                        <option value="award">낙찰정보</option>
                        <option value="shopping">쇼핑몰 품목</option>
                      </select>
                      <button
                        className="primary small-btn"
                        onClick={() => live(1)}
                        disabled={liveBusy}
                      >
                        {liveBusy ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Search size={15} />
                        )}{" "}
                        실제 자료 조회
                      </button>
                    </div>
                  </div>
                  <div className="query-controls">
                    <label>
                      조회 기간{" "}
                      <select
                        aria-label="조회 기간"
                        value={days}
                        disabled={kind === "shopping"}
                        onChange={(e) => setDays(Number(e.target.value))}
                      >
                        <option value={7}>최근 7일</option>
                        <option value={30}>최근 30일</option>
                      </select>
                    </label>
                    <span>
                      {kind === "shopping"
                        ? "쇼핑몰: 최근 364일 등록·현재 등재 품목"
                        : "한 번에 30건 · 최대 7페이지 · 근거 200건 보관"}
                    </span>
                    <button
                      className="secondary"
                      disabled={!evidence.length && !quotes.length}
                      onClick={() =>
                        download(
                          "조달근거_비교표.csv",
                          "\uFEFF" + reviewCsv(request, evidence, quotes),
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      비교표 CSV 저장
                    </button>
                  </div>
                  {queryError && (
                    <div className="query-error" role="alert">
                      <strong>조회하지 못했어요</strong>
                      <p>{queryError}</p>
                      <button
                        className="secondary"
                        onClick={() => live(1)}
                        disabled={liveBusy}
                      >
                        다시 조회
                      </button>
                    </div>
                  )}
                  {lastReceipt && (
                    <p className="query-receipt">
                      {lastReceipt.note} 반환 {lastReceipt.returnedCount}건 /
                      전체 {lastReceipt.totalCount ?? "미제공"}건 ·{" "}
                      {new Date(lastReceipt.queriedAt).toLocaleString("ko-KR")}
                      {canMore && (
                        <button
                          className="secondary"
                          onClick={() => live(nextPage)}
                          disabled={liveBusy}
                        >
                          다음 30건 더 보기
                        </button>
                      )}
                    </p>
                  )}
                  <div className="table-tools">
                    <div className="filter-tabs">
                      {[
                        ["all", "전체", evidence.length],
                        ["comparable", "비교 가능", counts.comparable],
                        ["conditional", "확인 필요", counts.conditional],
                        ["excluded", "비교 제외", counts.excluded],
                      ].map(([id, label, count]) => (
                        <button
                          key={id}
                          className={filter === id ? "selected" : ""}
                          onClick={() => setFilter(String(id))}
                        >
                          {label} <span>{count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="table-search">
                      <Search size={14} />
                      <input
                        aria-label="사례 검색"
                        placeholder="사례 검색"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>비교 사례 / 출처</th>
                          <th>확인 단가</th>
                          <th>검토 상태</th>
                          <th aria-label="상세" />
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((e) => (
                          <tr
                            key={e.id}
                            onClick={() => setSelected(e)}
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") setSelected(e);
                            }}
                          >
                            <td>
                              <strong>{e.title}</strong>
                              <small>
                                {e.isDemo ? "합성 예시" : e.agency} ·{" "}
                                {sources[e.source]}
                                <br />
                                {e.date}
                              </small>
                            </td>
                            <td>
                              <b>{won(e.unitPrice)}</b>
                              <small>
                                {e.priceBasis === "notice"
                                  ? "공고 계획 단가"
                                  : e.priceBasis === "catalog-unit"
                                    ? "쇼핑몰 계약단가"
                                    : e.priceBasis === "award-total"
                                      ? "낙찰 총액·단가 미확인"
                                      : "담당자 확인 필요"}
                              </small>
                              <small>
                                {e.unit}당 · 부가세{" "}
                                {e.vat === "included"
                                  ? "포함"
                                  : e.vat === "excluded"
                                    ? "별도"
                                    : "미확인"}
                              </small>
                            </td>
                            <td>
                              <span
                                className={`status-badge ${e.classification.status}`}
                              >
                                <i />
                                {labels[e.classification.status]}
                              </span>
                              <small className="reason-preview">
                                {e.classification.reasons[0]}
                              </small>
                            </td>
                            <td>
                              <ChevronRight size={16} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visible.length && (
                      <div className="empty-state">
                        <Search size={32} />
                        <h3>
                          {evidence.length
                            ? "일치하는 사례가 없어요"
                            : "비교 자료를 불러와주세요"}
                        </h3>
                        <p>
                          예시로 사용 흐름을 확인하거나 API를 연결해 실제 자료를
                          조회하세요.
                        </p>
                        <button className="secondary" onClick={() => demo()}>
                          예시 자료로 체험
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="table-foot">
                    <Link2 size={13} /> 사례를 선택하면 비교 사유와 원자료를
                    확인할 수 있어요.
                  </div>
                </section>
                <aside className="review-summary">
                  <section className="white-card">
                    <span className="eyebrow">REVIEW SUMMARY</span>
                    <h2>한눈에 보는 검토</h2>
                    <div className="summary-price">
                      <span>비교 가능 사례의 중앙 단가</span>
                      <strong>{won(summary.median)}</strong>
                      <small>
                        확인된 비교 가능 사례 {counts.comparable}건 기준
                      </small>
                    </div>
                    {counts.comparable < 3 && (
                      <p className="sample-warning">
                        비교 가능 사례가 3건 미만입니다. 대표 시세로 해석하지
                        말고 규격·수량·시점 차이를 추가 확인하세요.
                      </p>
                    )}
                    <div className="summary-line">
                      <span>요청 수량</span>
                      <b>
                        {request.quantity}
                        {request.unit || "대"}
                      </b>
                    </div>
                    <div className="summary-line">
                      <span>참고 구매비</span>
                      <b>{won(summary.total)}</b>
                    </div>
                    <div className="summary-line balance">
                      <span>
                        {summary.balance !== null && summary.balance < 0
                          ? "예산 초과액"
                          : "예산 대비 잔액"}
                      </span>
                      <b
                        style={
                          summary.balance !== null && summary.balance < 0
                            ? { color: "#b65f65" }
                            : {}
                        }
                      >
                        {won(
                          summary.balance === null
                            ? null
                            : Math.abs(summary.balance),
                        )}
                      </b>
                    </div>
                    <p className="hint">
                      단가 × 수량의 참고 산출이에요. 미확인 부대비용과 실제
                      견적은 별도 확인이 필요해요.
                    </p>
                    <button
                      className="primary full"
                      onClick={makeReport}
                      disabled={!evidence.length && !quotes.length}
                    >
                      <FileText size={16} /> 검토서 초안 만들기
                    </button>
                  </section>
                  <section className="check-card">
                    <h3>
                      <ShieldCheck size={17} /> 마지막으로 확인해요
                    </h3>
                    {[
                      "사양과 단위 일치",
                      "부가세·설치비·배송비 확인",
                      "소모품·유지관리 조건 확인",
                      "출처·조회 시점 확인",
                    ].map((c) => (
                      <label key={c}>
                        <input
                          type="checkbox"
                          checked={checks.includes(c)}
                          onChange={(e) => {
                            setChecks((v) =>
                              e.target.checked
                                ? [...v, c]
                                : v.filter((x) => x !== c),
                            );
                            addLog(
                              `${c} ${e.target.checked ? "확인" : "확인 해제"}`,
                            );
                          }}
                        />
                        {c}
                      </label>
                    ))}
                  </section>
                </aside>
              </div>
              <QuoteBoard
                key={request.item}
                request={request}
                quotes={quotes}
                decision={decision}
                onChange={updateQuotes}
                onDecision={(d) => {
                  setDecision(d);
                  setReport("");
                  addLog("담당자 검토 대안과 선택 사유 기록");
                }}
              />
              <section className="ai-card">
                <div>
                  <span className="ai-spark">
                    <Sparkles size={22} />
                  </span>
                  <div>
                    <h3>AI와 한 번 더 살펴볼까요?</h3>
                    <p>
                      현재 구매 조건·비교자료·입력 견적을 선택한 외부 AI에 보내
                      검토 메모를 작성해요.
                    </p>
                  </div>
                </div>
                <div className="button-group">
                  <select
                    aria-label="AI 모델 선택"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option value="groq">GPT-OSS · Groq</option>
                    <option value="gemma">Gemma · Google</option>
                  </select>
                  <button className="primary" onClick={analyze} disabled={busy}>
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}{" "}
                    AI 검토 요청
                  </button>
                </div>
                {ai && <div className="ai-result">{ai}</div>}
              </section>
            </>
          )}
          {view === "reports" && (
            <section className="white-card report-card">
              <div className="section-title">
                <h2>
                  구매 검토서 <span>담당자 확인 전 초안</span>
                </h2>
                <div className="button-group">
                  <button
                    className="secondary"
                    disabled={!evidence.length && !quotes.length}
                    onClick={makeReport}
                  >
                    <RotateCcw size={15} /> 현재 조건으로 갱신
                  </button>
                  <button
                    className="primary"
                    disabled={!report}
                    onClick={() => download("조달근거_구매검토서.txt", report)}
                  >
                    <ArrowDownToLine size={16} /> 내려받기
                  </button>
                  <button
                    className="secondary"
                    disabled={!report}
                    onClick={() => window.print()}
                  >
                    PDF 인쇄
                  </button>
                </div>
              </div>
              {report ? (
                <>
                  <p className="hint">
                    내용을 직접 수정할 수 있어요. 조건 변경 후에는 ‘현재
                    조건으로 갱신’을 눌러주세요. 갱신 시 직접 수정한 내용은
                    대체됩니다.
                  </p>
                  <textarea
                    className="report-editor"
                    aria-label="구매 검토서 편집"
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                  />
                  <pre className="print-report">{report}</pre>
                </>
              ) : (
                <div className="empty-state">
                  <FileText size={36} />
                  <h3>근거가 모이면, 검토서가 완성돼요.</h3>
                  <p>구매 검토에서 자료를 확인하고 초안을 생성해보세요.</p>
                  <button className="primary" onClick={() => setView("review")}>
                    구매 검토로 이동 <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="white-card">
                <div className="section-title">
                  <h2>API 연결 상태</h2>
                  <button
                    className="secondary"
                    onClick={() =>
                      fetch("/api/status")
                        .then((r) => r.json())
                        .then(setStatus)
                        .then(() =>
                          setToast("연결 설정 상태를 새로 확인했어요."),
                        )
                    }
                  >
                    <RotateCcw size={14} /> 새로고침
                  </button>
                </div>
                <p className="hint">
                  키 입력은 Vercel → Settings → Environment Variables에서
                  진행합니다. 아래는 설정 유무이며 실제 호출 성공을 뜻하지
                  않습니다.
                </p>
                <p className="hint">
                  공공데이터는 인증키 하나를 등록하면 입찰·낙찰·품목의 공식
                  조회주소가 자동 적용됩니다. 주소 세 개를 따로 입력할 필요가
                  없어요. 공공데이터포털에서 세 서비스의 활용승인은 각각
                  필요합니다.
                </p>
                {[
                  ["GPT-OSS · Groq", "GROQ_API_KEY", "groq"],
                  ["Gemma · Google", "GEMINI_API_KEY", "gemma"],
                  ["공공데이터포털", "DATA_GO_KR_SERVICE_KEY", "publicData"],
                ].map(([name, key, id]) => (
                  <div className="connection-row" key={key}>
                    <span className="connection-icon">
                      <Link2 size={19} />
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <small>{key}</small>
                    </div>
                    <span className={`pill ${status[id] ? "mint" : "neutral"}`}>
                      {status[id] ? "키 설정됨" : "설정 필요"}
                    </span>
                  </div>
                ))}
                <label className="field-label">
                  보호된 배포의 접속 토큰 (설정한 경우만)
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="서버 APP_ACCESS_TOKEN과 같은 값"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </label>
                <p className="hint">
                  접속 토큰은 현재 화면의 메모리에만 보관됩니다.
                </p>
              </section>
              <section className="white-card">
                <h2>내 작업 관리</h2>
                <p className="hint">
                  현재 구매 조건과 자료, 검토서가 이 브라우저에 자동 저장돼요.
                  공용 PC에서는 작업 후 초기화해주세요.
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      "조달근거_작업백업.json",
                      JSON.stringify(
                        {
                          request,
                          evidence,
                          checks,
                          logs,
                          report,
                          mode,
                          quotes,
                          decision,
                          receipts,
                        },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  <ArrowDownToLine size={16} /> 작업 백업 내려받기
                </button>
                <label className="file-import">
                  백업 파일 불러오기
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 2000000) throw new Error();
                        const s = parseWorkspace(JSON.parse(await f.text()));
                        if (
                          !s.request ||
                          !Array.isArray(s.evidence) ||
                          s.evidence.length > 200 ||
                          !Number.isInteger(s.request.quantity) ||
                          s.request.quantity <= 0
                        )
                          throw new Error();
                        setRequest(s.request);
                        setDraft(s.request);
                        setEvidence(s.evidence);
                        setQuotes(s.quotes || []);
                        setDecision(s.decision || null);
                        setReceipts(s.receipts || []);
                        setQueryError("");
                        setChecks(s.checks || []);
                        setLogs(s.logs || []);
                        setReport(s.report || "");
                        setMode(s.mode === "live" ? "live" : "demo");
                        setAi("");
                        setToast("백업을 불러왔어요.");
                      } catch {
                        setToast("올바른 작업 백업 파일인지 확인해주세요.");
                      }
                    }}
                  />
                </label>
                <button
                  className="danger-button"
                  onClick={() => {
                    if (confirm("이 브라우저의 작업 내용을 모두 지울까요?")) {
                      localStorage.removeItem("procurement-workspace-v1");
                      setRequest(initial);
                      setDraft(initial);
                      setEvidence([]);
                      setQuotes([]);
                      setDecision(null);
                      setReceipts([]);
                      setQueryError("");
                      setChecks([]);
                      setLogs([]);
                      setReport("");
                      setAi("");
                      setToast("현재 브라우저의 작업을 초기화했어요.");
                    }
                  }}
                >
                  <Trash2 size={15} /> 현재 작업 초기화
                </button>
                <div className="settings-note">
                  <BookOpen size={19} />
                  <p>
                    운영·연결 방법은 GitHub 저장소의 README를 확인하세요. 실제
                    사용자 검증과 기관별 계약 절차 검토는 별도로 필요합니다.
                  </p>
                </div>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-dot" /> 근거를 정리하고, 판단을 돕습니다.
            </span>
            <span>조달근거 · 구매 검토 지원 도구</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-title">
              <h2 id="modal-title">어떤 구매를 검토할까요?</h2>
              <button
                className="icon-button"
                aria-label="닫기"
                onClick={() => setModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              기본 조건을 입력하면, 같은 기준으로 사례를 비교해요.
            </p>
            <label className="field-label">
              구매 품목
              <input
                value={draft.item}
                onChange={(e) => setDraft({ ...draft, item: e.target.value })}
              />
            </label>
            <div className="quick-picks">
              {["공기청정기", "노트북", "사무용 의자"].map((x) => (
                <button
                  key={x}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      item: x,
                      unit: x === "사무용 의자" ? "개" : "대",
                      minSpec:
                        x === "공기청정기" ? 80 : x === "노트북" ? 16 : 0,
                    })
                  }
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label className="field-label">
                수량
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft({ ...draft, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label className="field-label">
                단위
                <select
                  aria-label="구매 단위"
                  value={draft.unit || "대"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      unit: e.target.value as PurchaseRequest["unit"],
                    })
                  }
                >
                  <option>대</option>
                  <option>개</option>
                  <option>세트</option>
                </select>
              </label>
              <label className="field-label">
                예산 상한 (원)
                <input
                  type="number"
                  min="0"
                  value={draft.budget}
                  onChange={(e) =>
                    setDraft({ ...draft, budget: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="field-label">
              최소 사양{" "}
              {draft.item === "공기청정기"
                ? "(사용면적 ㎡)"
                : draft.item === "노트북"
                  ? "(메모리 GB)"
                  : "(품목별 수치, 미지정은 0)"}
              <input
                type="number"
                min="0"
                value={draft.minSpec}
                onChange={(e) =>
                  setDraft({ ...draft, minSpec: Number(e.target.value) })
                }
              />
            </label>
            <label className="field-label">
              구매 방식
              <select
                value={draft.method}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    method: e.target.value as "purchase" | "rental",
                  })
                }
              >
                <option value="purchase">구매</option>
                <option value="rental">임대 (기간·총액 추가 확인 필요)</option>
              </select>
            </label>
            <div className="form-checks">
              <label>
                <input
                  type="checkbox"
                  checked={draft.installation}
                  onChange={(e) =>
                    setDraft({ ...draft, installation: e.target.checked })
                  }
                />{" "}
                설치 포함 필수
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.maintenance}
                  onChange={(e) =>
                    setDraft({ ...draft, maintenance: e.target.checked })
                  }
                />{" "}
                유지관리 포함 필수
              </label>
            </div>
            <div className="modal-footer">
              <button className="secondary" onClick={() => setModal(false)}>
                취소
              </button>
              <button className="primary" onClick={saveRequest}>
                조건 저장하고 검토하기 <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="overlay drawer-overlay"
          onClick={() => setSelected(null)}
        >
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="비교 근거 상세"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-title">
              <span className="pill lavender">근거 상세</span>
              <button
                className="icon-button"
                aria-label="닫기"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2>{selected.title}</h2>
            <p className="muted">
              {selected.isDemo
                ? "합성 예시 · 실제 계약 자료 아님"
                : selected.agency}
            </p>
            <div className="detail-price">
              {won(selected.unitPrice)}
              <small>{selected.unit}당 확인 단가</small>
            </div>
            <dl>
              {[
                ["자료 유형", sources[selected.source]],
                ["기준일", selected.date],
                ["방식", selected.method === "purchase" ? "구매" : "임대"],
                [
                  "설치",
                  selected.installation === "included"
                    ? "포함"
                    : selected.installation === "excluded"
                      ? "별도"
                      : "미확인",
                ],
                [
                  "유지관리",
                  selected.maintenance === "included"
                    ? "포함"
                    : selected.maintenance === "excluded"
                      ? "별도"
                      : "미확인",
                ],
                [
                  "부가세",
                  selected.vat === "included"
                    ? "포함"
                    : selected.vat === "excluded"
                      ? "별도"
                      : "미확인",
                ],
                ["혼합 품목", selected.mixed ? "단가 환산 불가" : "아니오"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="detail-reasons">
              <h3>비교 판단 근거</h3>
              {classifyEvidence(selected, request).reasons.map((r) => (
                <p key={r}>
                  <AlertCircle size={14} />
                  {r}
                </p>
              ))}
            </div>
            <p className="hint">{selected.description}</p>
            {selected.url && /^https:\/\//.test(selected.url) ? (
              <a
                className="primary full"
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                공식 원자료 열기 <ExternalLink size={15} />
              </a>
            ) : (
              <div className="mode-banner">
                {selected.isDemo
                  ? "합성 사례에는 실제 공고번호나 원문 링크가 없습니다."
                  : "제공된 원문 링크가 없습니다. 출처를 추가 확인해주세요."}
              </div>
            )}
            <ProcurementLines
              key={selected.id}
              evidence={selected}
              token={token}
              onAdd={addDetail}
            />
            <EvidenceEditor
              key={selected.id}
              evidence={selected}
              onSave={(updated, reason) => {
                setEvidence((items) =>
                  items.map((e) => (e.id === updated.id ? updated : e)),
                );
                setSelected(updated);
                setDecision(null);
                setAi("");
                setReport("");
                setChecks([]);
                addLog(
                  `${updated.title} 확인값 수정: ${reason} · 단가 ${won(updated.unitPrice)}, 수량 ${updated.quantity ?? "미확인"}, 사양 ${updated.spec ?? "미확인"}, 방식 ${updated.method}, 단품구성 ${!updated.mixed}, VAT ${updated.vat}, 설치 ${updated.installation}, 유지관리 ${updated.maintenance}`,
                );
                setToast("확인값을 저장하고 비교 결과를 다시 계산했어요.");
              }}
            />
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <AlertCircle size={18} />
          {toast}
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  unit,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  note: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{note}</p>
    </div>
  );
}
function LayersIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none">
      <path d="m4 10 10-6 10 6-10 6-10-6Z" fill="currentColor" />
      <path
        d="m4 15 10 6 10-6M4 20l10 6 10-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
