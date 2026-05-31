// Shipirio — k6 Load Test
// Kurulum: brew install k6
// Çalıştırma: k6 run docs/load-test.js
//
// Bu script health endpoint'ini ve (token verilirse) recommend-outfit'i yükler.
// 0 kullanıcıyla launch öncesi altyapı kapasitesini ölçmek için.

import http from "k6/http";
import { check, sleep } from "k6";

const SUPABASE_URL = "https://mdvasffuseqkyhiegsck.supabase.co";
// Gerçek kullanıcı JWT'si ile auth'lu endpoint testi için doldur (opsiyonel):
const USER_JWT = __ENV.USER_JWT || "";

export const options = {
  scenarios: {
    // Senaryo 1: 100 eşzamanlı kullanıcı, 1 dakika
    rampup_100: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"], // %95 istek < 2sn
    http_req_failed: ["rate<0.05"],    // hata oranı < %5
  },
};

export default function () {
  // Health endpoint (auth'suz) — altyapı ısınma testi
  const health = http.get(`${SUPABASE_URL}/functions/v1/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health db up": (r) => r.json("db") === "up",
  });

  // Auth'lu AI endpoint (sadece JWT verilirse)
  if (USER_JWT) {
    const payload = JSON.stringify({ event: "ofis", mood: "rahat", weather: { temp: 18, description: "parçalı bulutlu" } });
    const res = http.post(`${SUPABASE_URL}/functions/v1/recommend-outfit`, payload, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${USER_JWT}` },
    });
    check(res, {
      "outfit 200/429": (r) => r.status === 200 || r.status === 429, // 429 = rate limit çalışıyor (iyi)
    });
  }

  sleep(1);
}

/*
NE İZLENMELİ:
- p95 latency < 2sn olmalı (Gemini çağrıları yavaşsa cache devreye girmeli)
- http_req_failed < %5
- 429 görmek İYİdir → rate limit çalışıyor demek
- Supabase dashboard → Edge Functions → invocation/error grafiği

SENARYO GENİŞLETME:
- 1000 kullanıcı: stages target'ı 1000 yap. Gemini'nin kendi kotası takılabilir.
- 10000 kullanıcı: cache hit oranını izle; düşükse queue gerekir.
*/
