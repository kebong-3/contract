# Vercel 배포 안내

## API 키 없이 먼저 배포

1. Vercel에서 `kebong-3/contract`를 Import합니다.
2. Framework: **Next.js**, Root Directory: **저장소 최상위**.
3. Node.js는 **24.x** 권장(테스트에 타입 제거 기능 사용).
4. Build Command: `pnpm build`, Output Directory는 기본값 유지.
5. Deploy합니다. 예시 체험·조건 비교·보고서 생성은 키 없이 작동합니다.

`packageManager`와 `pnpm-lock.yaml`이 패키지 관리자를 지정합니다. Vercel이 pnpm 11을 찾지 못하면 프로젝트 환경변수 `ENABLE_EXPERIMENTAL_COREPACK=1`을 등록한 후 재배포하거나 Vercel의 현재 Corepack 안내에 따라 버전을 활성화하세요.

## 실제 AI 연결

Settings → Environment Variables에 `.env.example`에 적힌 이름으로 등록합니다.

- `GROQ_API_KEY`: GPT-OSS용. 선택적으로 `GROQ_MODEL` 변경.
- `GEMINI_API_KEY`: Gemma용. 선택적으로 `GEMMA_MODEL` 변경.
- `APP_ACCESS_TOKEN`: 공유 배포 시 긴 임의 접속 암호를 설정하는 것을 권장합니다. 이용자는 앱의 ‘연결 및 설정’에서 같은 암호를 입력합니다. 앱 자체의 사용자별 계정·권한 관리 기능은 아닙니다.

변경 후 재배포합니다. 앱 설정 화면은 **키 설정 여부만** 보여줍니다. 주요 기능의 실제 구동 입증은 해당 계정의 키로 두 모델을 각각 호출해야 합니다. 무료·유료 여부는 실제 제공자 계정 플랜을 확인하세요.

## 공공데이터 API 연결

1. `.env.example`의 공식 링크에서 API 3종을 각각 활용신청합니다.
2. `DATA_GO_KR_SERVICE_KEY`를 등록합니다.
3. **주소 세 개는 입력하지 않아도 됩니다.** 공식 조회주소와 검색조건이 앱에 기본 내장되어 있습니다. 이전에 `PROCUREMENT_BID_URL`, `PROCUREMENT_AWARD_URL`, `PROCUREMENT_SHOPPING_URL`에 키나 임시 주소를 넣었다면 해당 세 환경변수를 삭제하세요. 인증키 변수는 유지합니다.
4. 변경 후 Vercel에서 재배포합니다. GitHub 자동 배포가 연결된 경우 최신 커밋의 배포를 확인합니다.
5. 앱의 ‘구매 검토하기’에서 자료 종류를 선택해 조회합니다.

2026-10-23 공식 공공데이터포털 Swagger와 참고문서로 조회주소·검색조건을 확인했습니다. 내장 기본값은 다음과 같습니다. 아래 주소는 개발 참고용이며 Vercel 입력이 필수가 아닙니다.

| 자료 | 내장 오퍼레이션                                                                                | 검색·날짜                                                                 |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 입찰 | `https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch`      | `bidNtceNm`, `inqryDiv=1`, 최근 30일 공고게시일시(12자리)                 |
| 낙찰 | `https://apis.data.go.kr/1230000/as/ScsbidInfoService/getScsbidListSttusThngPPSSrch`           | `bidNtceNm`, `inqryDiv=2`, 최근 30일 개찰일시(12자리)                     |
| 품목 | `https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getShoppingMallPrdctInfoList` | `prdctClsfcNoNm`, `inqryDiv=1`, 최근 364일 등록일자(8자리), 등록해지 제외 |

앱이 서비스키·검색어·조회기간·JSON 형식·페이지 번호를 자동으로 붙입니다. 최초 페이지 최대 30건이며 전체 검색이 아닙니다. 쇼핑몰의 등록일자는 상품 계약일과 다를 수 있고, 이전 등록 상품은 기본 범위 밖일 수 있습니다. 검색 결과 없음과 활용승인·인증 오류는 구분해서 확인하세요.

운영 키로 실제 데이터가 반환되는지는 해당 계정의 승인·한도 상태에 따라 별도 확인해야 합니다. 공식 주소 확인과 모의 응답 테스트를 통과했다고 실제 계정의 호출 성공을 의미하지는 않습니다.

고급 사용자만 `PROCUREMENT_*_URL`로 기본값을 덮어쓸 수 있습니다. `{query}`는 필수, `{from}`/`{to}`는 12자리, `{fromDate}`/`{toDate}`는 8자리(최근 30일), `{catalogFromDate}`는 364일 전입니다. 서비스키는 URL에 직접 넣지 마세요.

실조회 결과의 총액을 단가로 자동 환산하지 않습니다. 사례 상세에서 원문을 확인하고 단가·수량·사양·단품 구성·부가세 등을 보완하면 비교 분류가 다시 계산됩니다. 여러 API의 같은 계약을 공고번호로 자동 결합하는 기능은 이번 버전에 포함하지 않았습니다. 자료 종류별 검색 결과를 추가 수집하고 검토하는 방식입니다.

## 배포 후 확인

- 예시 자료 7건 → 비교 가능 3건 확인
- 수량 10에서 20으로 변경 → 참고 구매비 갱신
- 사례 상세 → 확인값 수정 → 변경 사유 기록
- 검토서 생성 → 편집·TXT 내려받기·PDF 인쇄
- 작업 백업 → 초기화 → 백업 복원
- 두 모델의 실제 응답과 키 미설정 안내 확인
- API 3종 승인·조회·원문 링크 확인

단일 브라우저 작업공간입니다. 서버 영구저장·기관별 계정·권한·자동 결재·첨부문서 자동 판독은 포함하지 않습니다. 비공개 자료를 투입하지 말고, 기관에서 정식 운영하기 전 별도 보안·실무 검증을 진행해야 합니다.
