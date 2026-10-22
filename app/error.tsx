"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main style={{ margin: 0, width: "100%", padding: 40 }}>
      <h1>화면을 불러오지 못했어요.</h1>
      <p style={{ margin: "20px 0" }}>
        작업 백업이 있다면 보관한 뒤 다시 시도해주세요. 오류가 반복되면
        브라우저의 사이트 저장자료를 확인하세요.
      </p>
      <button className="primary" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
