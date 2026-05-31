import { publicEnv } from "@/lib/env";

/**
 * Affiliate parametre enjeksiyonu.
 * Pazaryeri linklerine affiliate tracking parametresi ekler.
 *
 * Kullanım: Burak affiliate programlarına (Trendyol, Gelir Ortakları vb.) kaydolunca
 * sadece .env'e ID'leri girer → tüm uygulama linkleri otomatik monetize olur.
 * Kullanıcıdan para almadan gelir = Türkiye pazarı için ideal model.
 *
 * Env örneği:
 *   EXPO_PUBLIC_TRENDYOL_AFFILIATE_ID=12345
 *   EXPO_PUBLIC_DOLAP_PARTNER_ID=shipirio
 */

type Marketplace = "Trendyol" | "Dolap" | "Gardrops" | "Modacruz" | "Google Shopping" | string;

export function applyAffiliate(url: string, marketplace: Marketplace): string {
  try {
    const u = new URL(url);

    switch (marketplace) {
      case "Trendyol": {
        const id = publicEnv.trendyolAffiliateId;
        if (id) {
          // Trendyol Gelir Ortakları parametresi
          u.searchParams.set("utm_source", "shipirio");
          u.searchParams.set("utm_medium", "affiliate");
          u.searchParams.set("adjust_tracker", id);
        }
        break;
      }
      case "Dolap": {
        const id = publicEnv.dolapPartnerId;
        if (id) {
          u.searchParams.set("utm_source", "shipirio");
          u.searchParams.set("partner", id);
        }
        break;
      }
      default: {
        // Diğer pazaryerleri için genel UTM (atıf takibi)
        u.searchParams.set("utm_source", "shipirio");
        u.searchParams.set("utm_medium", "referral");
      }
    }

    return u.toString();
  } catch {
    return url; // URL parse edilemezse orijinali döndür
  }
}

/** Affiliate aktif mi (en az bir program bağlı mı)? — UI'da "sponsorlu" etiketi için */
export function hasActiveAffiliate(): boolean {
  return Boolean(publicEnv.trendyolAffiliateId || publicEnv.dolapPartnerId);
}
