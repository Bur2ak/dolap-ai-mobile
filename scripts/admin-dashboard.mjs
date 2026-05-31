// Shipirio — Local Admin Dashboard
// Tamamen local çalışır, internete deploy EDİLMEZ, service key makineden çıkmaz.
//
// Çalıştırma:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/admin-dashboard.mjs
// Sonra tarayıcıda: http://localhost:4321
//
// Service role key: Supabase Dashboard → Project Settings → API → service_role (secret)

import { createServer } from "node:http";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://mdvasffuseqkyhiegsck.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = 4321;

if (!SERVICE_KEY) {
  console.error("\n❌ SUPABASE_SERVICE_ROLE_KEY eksik.\n");
  console.error("Şöyle çalıştır:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/admin-dashboard.mjs\n");
  console.error("Key'i şuradan al: Supabase Dashboard → Settings → API → service_role\n");
  process.exit(1);
}

async function fetchView(view) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}?select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`${view}: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] ?? {};
}

function card(label, value, sub = "") {
  return `<div class="card"><div class="val">${value}</div><div class="lbl">${label}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}

async function renderHtml() {
  let metrics = {}, activation = {}, error = "";
  try {
    [metrics, activation] = await Promise.all([fetchView("admin_metrics"), fetchView("admin_activation")]);
  } catch (e) {
    error = e.message;
  }

  const activationRate = activation.total_users > 0
    ? Math.round((activation.activated_users_5plus / activation.total_users) * 100)
    : 0;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shipirio Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { background:#F5EFE8; color:#1D2235; font-family:-apple-system,system-ui,sans-serif; padding:32px; }
  h1 { font-size:28px; margin-bottom:4px; }
  .muted { color:#6B6860; margin-bottom:24px; font-size:14px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:16px; margin-bottom:32px; }
  .card { background:#fff; border:1px solid #E2D9CF; border-radius:16px; padding:20px; }
  .val { font-size:32px; font-weight:700; color:#1D2235; }
  .lbl { font-size:13px; color:#6B6860; margin-top:4px; }
  .sub { font-size:11px; color:#8B83C8; margin-top:6px; font-weight:600; }
  .section { font-size:13px; font-weight:700; color:#8B83C8; text-transform:uppercase; letter-spacing:1px; margin:8px 0 12px; }
  .err { background:#F5DDD9; color:#C0392B; padding:16px; border-radius:12px; margin-bottom:24px; }
  .refresh { color:#6B6860; font-size:12px; margin-top:24px; }
  .big { grid-column:span 2; background:#1D2235; color:#fff; }
  .big .val,.big .lbl { color:#fff; }
  .big .val { font-size:40px; }
</style></head><body>
<h1>📊 Shipirio Admin</h1>
<div class="muted">Local panel · ${new Date().toLocaleString("tr-TR")}</div>
${error ? `<div class="err">⚠️ ${error}</div>` : ""}

<div class="section">Kuzey Yıldızı — Aktivasyon</div>
<div class="grid">
  ${card("Aktivasyon oranı", `%${activationRate}`, activationRate >= 30 ? "✓ PMF sinyali" : "hedef: %30+")}
  ${card("5+ parça ekleyen", activation.activated_users_5plus ?? 0)}
  ${card("1+ parça ekleyen", activation.users_with_1plus_item ?? 0)}
</div>

<div class="section">Kullanıcılar</div>
<div class="grid">
  ${card("Toplam kullanıcı", metrics.total_users ?? 0)}
  ${card("Son 7 gün yeni", metrics.new_users_7d ?? 0)}
  ${card("Bugün yeni", metrics.new_users_1d ?? 0)}
  ${card("Premium", metrics.premium_users ?? 0, "ödeyen")}
</div>

<div class="section">İçerik & Kullanım</div>
<div class="grid">
  ${card("Dolabı olan kullanıcı", metrics.users_with_items ?? 0)}
  ${card("Toplam kıyafet", metrics.total_items ?? 0)}
  ${card("Toplam kombin", metrics.total_outfits ?? 0)}
  ${card("Günlük kayıt", metrics.total_diary_entries ?? 0)}
</div>

<div class="section">AI Kullanımı (Bugün) — Maliyet İzleme</div>
<div class="grid">
  ${card("Bugün AI kullanan", metrics.active_ai_users_today ?? 0)}
  ${card("Bugün AI çağrısı", metrics.ai_vision_calls_today ?? 0, "Gemini maliyeti")}
</div>

<div class="refresh">↻ Yenilemek için sayfayı tazele (F5)</div>
</body></html>`;
}

createServer(async (req, res) => {
  if (req.url === "/favicon.ico") { res.writeHead(204); return res.end(); }
  try {
    const html = await renderHtml();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Hata: " + e.message);
  }
}).listen(PORT, () => {
  console.log(`\n✅ Shipirio Admin paneli çalışıyor:\n   http://localhost:${PORT}\n`);
  console.log("   Durdurmak için Ctrl+C\n");
});
