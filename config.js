/* 실시간 공유 저장소 (Supabase)
   ────────────────────────────────────────────────────────
   켜져 있으면 → 입력이 즉시 클라우드에 저장되고, 링크를 연 모든 사람이 같은 기록을 봅니다.
   url·key를 비우면 → 내 브라우저(localStorage)에만 저장됩니다. (사이트는 그대로 동작)

   프로젝트  : SJGPT's Org / pano-hire (ap-southeast-1)
   대시보드  : https://supabase.com/dashboard/project/owlpajgaghozhmxtaeww
   key       : publishable 키 — 브라우저에 넣으라고 만든 공개용 키입니다.
   ⚠ 채용 종료 후 이 프로젝트를 삭제하세요.
*/
window.SB = {
  url: 'https://owlpajgaghozhmxtaeww.supabase.co',
  key: 'sb_publishable_U8KeA6kEI_jGzgzIHb72uA_hYuNhTTc',
  table: 'interviews',
  pollMs: 15000   // 다른 사람 변경사항 가져오는 주기 (ms)
};
