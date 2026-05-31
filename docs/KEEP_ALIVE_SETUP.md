# Supabase'i Bedava Uyanık Tutma (Pro'ya Gerek Yok)

Free tier projesi 1 hafta istek almazsa uyur. UptimeRobot (ücretsiz) health endpoint'ini
düzenli pingleyerek projeyi sürekli aktif tutar. **Aylık $0.**

## Health Endpoint
Deploy edildi ✅:
```
https://mdvasffuseqkyhiegsck.supabase.co/functions/v1/health
```
Test: tarayıcıda aç → `{"status":"ok","db":"up",...}` görmelisin.

## UptimeRobot Kurulumu (2 dakika, ücretsiz)

1. https://uptimerobot.com → ücretsiz hesap aç
2. **+ New Monitor**
3. Ayarlar:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Shipirio Supabase`
   - URL: `https://mdvasffuseqkyhiegsck.supabase.co/functions/v1/health`
   - Monitoring Interval: **5 minutes** (ücretsiz planda min)
4. **Create Monitor**

Artık her 5 dakikada bir ping atılacak → proje hiç uyumayacak.

## Bonus: Uptime İzleme
UptimeRobot ayrıca:
- Site/API down olursa **e-posta bildirimi** gönderir
- Uptime % istatistiği tutar (yatırımcıya gösterebilirsin: "%99.9 uptime")
- shipirio.com için de ayrı bir monitor ekleyebilirsin

## Ne Zaman Pro'ya Geçmeli?
- İlk ödeyen kullanıcılar gelince (gelir Pro'yu karşılar)
- Veya: günlük aktif kullanıcı > 100 olunca (free tier limitleri zorlanır)
- O zamana kadar **bu kurulum yeterli.**
