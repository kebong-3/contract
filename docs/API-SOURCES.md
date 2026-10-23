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
