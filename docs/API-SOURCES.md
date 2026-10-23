# 공공데이터 API 기본 설정 근거

확인일: 2026-10-23. 비로그인 상태에서도 공식 페이지의 Swagger 상세기능과 참고문서를 확인할 수 있습니다.

## 입찰

- 공식 페이지: https://www.data.go.kr/data/15129394/openapi.do
- 참고문서: `조달청_OpenAPI참고자료_나라장터_입찰공고정보서비스_1.2.docx`
- 물품 일반 목록이 아닌 공고명 검색을 지원하는 `getBidPblancListInfoThngPPSSrch`를 사용합니다.
- `inqryDiv=1`: 공고게시일시. `bidNtceNm`은 공고명 일부 검색을 지원합니다.
- `inqryBgnDt`, `inqryEndDt`: YYYYMMDDHHmm.

## 낙찰

- 공식 페이지: https://www.data.go.kr/data/15129397/openapi.do
- 참고문서: `조달청_OpenAPI참고자료_나라장터_낙찰정보서비스_1.2.docx`
- `getScsbidListSttusThngPPSSrch`를 사용합니다.
- `inqryDiv=2`: 개찰일시. `bidNtceNm`은 공고명 일부 검색을 지원합니다.
- `inqryBgnDt`, `inqryEndDt`: YYYYMMDDHHmm.
- `sucsfbidAmt`는 최종낙찰금액이며 단품 단가로 추정하지 않습니다.

## 쇼핑몰

- 공식 페이지: https://www.data.go.kr/data/15129471/openapi.do
- 참고문서: `조달청_OpenAPI참고자료_조달청_나라장터쇼핑몰품목정보서비스_1.3.docx`
- `getShoppingMallPrdctInfoList`를 사용합니다.
- `inqryDiv=1`: 등록일자 검색. 조회 범위는 최대 12개월.
- `inqryBgnDate`, `inqryEndDate`: YYYYMMDD. `prdctClsfcNoNm`: 품명.
- `regtCncelYn=N`: 현재 등재된 품목 조회.
- 상품명은 `prdctSpecNm`, 공급자는 `cntrctCorpNm`, 금액은 `cntrctPrceAmt`에서 가져옵니다. 금액은 확인 전 비교 단가로 사용하지 않습니다.
- 문서상 유일 키인 `shopngCntrctNo` + `shopngCntrctSno`에 물품식별번호를 추가해 다른 계약·순번을 합치지 않습니다.

## 검증 범위

주소·변수·응답 필드는 위 공식 Swagger와 문서에서 확인했습니다. 테스트는 가짜 인증키와 모의 응답으로 검색어·날짜 형식·키 비노출·가격 보수 처리를 검증합니다. 사용자 인증키를 열람하거나 실제 계정의 활용승인·한도·실제 응답 성공을 확인한 것은 아닙니다.

## 공고 구매대상 물품 구성 (추가)

기존 입찰공고정보서비스의 `getBidPblancListInfoThngPurchsObjPrdct` 상세기능을 사용합니다. 별도 신규 서비스나 인증키를 추가하지 않습니다.

- `inqryDiv=2`, `bidNtceNo`, `bidNtceOrd`로 공고번호·차수를 지정합니다. 일치하는 응답만 최대 100건 표시합니다.
- `qty`, `unit`, `uprc`, `prdctSpecNm`, `dlvryCndtnNm`, `dlvrTmlmtDt`를 표시합니다.
- `uprc`는 공고 구매대상 물품의 계획 단가이며 낙찰·계약 단가가 아닙니다. 참고자료로 추가해도 중앙값 비교 대상이 되지 않습니다.
- 소스: 위 입찰 서비스의 공식 참고문서 1.2, 구매대상물품조회 상세기능.

## 조회·가격 처리 범위

입찰·낙찰 검색은 최근 7일 또는 30일, 쇼핑몰은 최근 364일 등록·현재 등재 자료를 조회합니다. 페이지당 30건, 사용자가 수동으로 최대 7페이지를 조회할 수 있으며 작업에는 최대 200개 근거를 보관합니다. 전체 시장을 조사했다는 의미가 아닙니다. 응답에 전체 건수가 있으면 함께 표시합니다. 상세 구매대상 조회는 별도 최대 100건이며 전체 품목 완전성은 보장하지 않습니다.

쇼핑몰의 `cntrctPrceAmt`는 표시 단가로 읽되, 부가세·규격·설치·유지관리 및 단위를 담당자가 확인하기 전에는 자동 비교하지 않습니다. 공고·낙찰 총액을 수량으로 나누어 단가를 만들지 않습니다.
