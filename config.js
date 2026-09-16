/* 실시간 공유 저장소 설정 (Supabase)
   ────────────────────────────────────────────────────────
   아래 두 값이 채워지면 → 입력이 즉시 클라우드에 저장되고, 링크를 연 모든 사람이 같은 기록을 봅니다.
   비어 있으면 → 예전처럼 내 브라우저(localStorage)에만 저장됩니다. (사이트는 그대로 동작)

   url : Supabase 프로젝트 URL      예) https://abcdefgh.supabase.co
   key : Project API keys의 anon public 키 (공개용 키라 노출돼도 됩니다)
*/
window.SB = {
  url: '',
  key: '',
  table: 'interviews',
  pollMs: 20000   // 다른 사람 변경사항 가져오는 주기 (ms)
};
