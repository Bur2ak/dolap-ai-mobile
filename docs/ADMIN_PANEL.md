# Local Admin Panel

Görsel admin paneli — tamamen kendi bilgisayarında çalışır, internete açılmaz.
Service role key makinenden çıkmaz (güvenli).

## Çalıştırma

### 1. Service role key'i al
Supabase Dashboard → **Project Settings → API → Project API keys → `service_role`** (secret)
(Bu key gizlidir, kimseyle paylaşma, git'e koyma!)

### 2. Paneli başlat
Terminal'de proje klasöründe:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...senin_keyin node scripts/admin-dashboard.mjs
```

### 3. Tarayıcıda aç
```
http://localhost:4321
```

Durdurmak için terminal'de `Ctrl+C`.

## Ne Gösterir?

- **Aktivasyon oranı** (kuzey yıldızı): 5+ parça ekleyen kullanıcı %'si — hedef %30+
- **Kullanıcılar**: toplam, son 7 gün, bugün, premium
- **İçerik**: dolabı olan kullanıcı, toplam kıyafet/kombin/günlük kaydı
- **AI kullanımı (bugün)**: kaç kullanıcı, kaç Gemini çağrısı → maliyet izleme

Yenilemek için F5.

## Alternatif: Supabase Studio
Key'le uğraşmak istemezsen, aynı verileri Supabase Dashboard → SQL Editor'de görebilirsin:
```sql
SELECT * FROM admin_metrics;
SELECT * FROM admin_activation;
```

## Güvenlik Notu
- Bu script `scripts/` altında, web sitesine dahil DEĞİL, deploy edilmez.
- Key'i terminal'e her seferinde elle girersin — dosyaya kaydetme.
- İstersen `.zshrc`'ye alias ekle (key'i environment'ta tut):
  ```bash
  alias shipirio-admin='SUPABASE_SERVICE_ROLE_KEY=eyJ... node ~/Desktop/TestVault/scripts/admin-dashboard.mjs'
  ```
