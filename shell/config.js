/* 교육 사이트 웹판 설정. 화면과 서비스 워커가 함께 읽는다. 값은 모두 공개값이다(설계서 v0.2 2.4).
   supabaseUrl·publishableKey는 실제 프로젝트가 생기면 넣는다(13장 B1). 관리 키는 여기에 두지 않는다.
   중괄호 안은 JSON 꼴로 둔다. 올리기·검사 스크립트가 그대로 읽는다. */
self.EDU_CONFIG = {
  "base": "/ai-work-course-shell/",
  "supabaseUrl": "https://qqeuygmarwzikyxyfaun.supabase.co",
  "publishableKey": "sb_publishable_FcLuX2PEQ-IbcFePc59CXg__JvYD33F",
  "bucket": "edu-content",
  "authDomain": "edu.invalid",
  "stores": { "basic": "aipc.v1.", "advanced": "aiadv.v1." },
  "courseLabels": { "basic": "기초 과정", "advanced": "심화 과정" }
};
