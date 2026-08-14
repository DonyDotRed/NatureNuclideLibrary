# NatureNuclideLibrary

검출기별 측정에너지–핵종 판독 Excel 데이터북을 기반으로 만든 GitHub Pages용 정적 웹 애플리케이션입니다.

## 주요 기능

- 에너지 입력 기반 핵종 후보 검색
- 감마선 라인 마스터 다중 필터
- 검출기별 적소 카드 및 비교
- 발생원–화학형–시료–검출기 경로 탐색
- 비감마 핵종 측정경로
- 화학형 포집사전
- 인접선 간섭맵
- FWHM/분해능 계산기
- 원본 Excel 11개 시트 전체 조회
- Excel 수식 표시
- CSV 내보내기
- 즐겨찾기
- Light/Dark 테마
- 세션 단위 비밀번호 게이트

## 비밀번호

기본 접근 비밀번호는 `redpass`입니다.

> GitHub Pages는 정적 호스팅이므로 이 비밀번호 기능은 간단한 사용자 확인용입니다. 저장소/개발자도구에 접근 가능한 사용자를 막는 보안 인증은 아닙니다.

## 로컬 실행

브라우저에서 `index.html`을 직접 열어도 대부분 동작하지만, 로컬 HTTP 서버 사용을 권장합니다.

```bash
python -m http.server 8080
```

그 후 브라우저에서 `http://localhost:8080`으로 접속합니다.

## GitHub Pages 배포

1. 이 폴더의 파일을 GitHub 저장소 루트에 업로드합니다.
2. **Settings → Pages**로 이동합니다.
3. **Deploy from a branch**를 선택합니다.
4. `main` 브랜치와 `/ (root)`를 선택합니다.
5. 저장합니다.

## 데이터 원본

- Source: `검출기별_측정에너지_핵종판독_Model.xlsx`
- SHA-256: `cb7453eac2279d89f321b036d39edb68bfb34db534340335c1ff63c5f746e8b3`
- 시트 수: 11
- 감마 라인 수: 88
- 고유 핵종 수: 53

상세 구조와 판정 로직은 [DESIGN.md](DESIGN.md)를 참고하십시오.
"# NatureNuclideLibrary" 
