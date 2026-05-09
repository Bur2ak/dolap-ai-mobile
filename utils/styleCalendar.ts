import { EVENT_TYPES } from "@/constants/events";
import type { EventRecord, StyleCalendarDay, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

const DAY_MS = 86_400_000;

export function buildStyleCalendar(events: EventRecord[], items: WardrobeItem[], startDate = new Date()): StyleCalendarDay[] {
  const upcomingEvents = events
    .filter((event) => new Date(event.event_date).getTime() >= startOfDay(startDate).getTime())
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfDay(startDate).getTime() + index * DAY_MS);
    const dateKey = toDateKey(date);
    const event = upcomingEvents.find((item) => toDateKey(new Date(item.event_date)) === dateKey);

    if (event) {
      return {
        body: buildEventBody(event),
        date: dateKey,
        day_label: formatDayLabel(date, index),
        event_id: event.id,
        status: "planned",
        suggested_event_type: event.event_type,
        title: event.title,
      };
    }

    const suggestion = buildOpenDaySuggestion(items, index);

    return {
      body: suggestion.body,
      date: dateKey,
      day_label: formatDayLabel(date, index),
      event_id: null,
      status: "open",
      suggested_event_type: suggestion.eventType,
      title: suggestion.title,
    };
  });
}

function buildEventBody(event: EventRecord) {
  const eventType = EVENT_TYPES.find((type) => type.value === event.event_type)?.label ?? event.event_type;
  const location = event.location ? `, ${event.location}` : "";
  const outfitStatus = event.outfit_id ? "Kombin bagli." : "Kombin henuz secilmedi.";

  return `${eventType}${location}. ${outfitStatus}`;
}

function buildOpenDaySuggestion(items: WardrobeItem[], index: number) {
  const hasUnworn = items.some((item) => item.wear_count === 0);
  const hasFormal = items.some((item) => item.category === "dis_giyim" || normalize(item.subcategory ?? "").includes("gomlek"));
  const hasSport = items.some((item) => item.category === "spor" || normalize(item.subcategory ?? "").includes("sneaker"));
  const hasAccessories = items.some((item) => item.category === "aksesuar" || item.category === "canta");
  const suggestions = [
    {
      body: hasUnworn ? "Az kullanilan bir parcayi bugunku kombine ekle." : "Favori parcani yeni bir eslesmeyle dene.",
      eventType: "diger",
      title: "Dolap rotasyonu",
    },
    {
      body: hasFormal ? "Ofis veya toplanti icin net, sade bir kombin planla." : "Basic parcalarla duzenli bir gunluk kombin kur.",
      eventType: "is",
      title: "Net gorunum",
    },
    {
      body: hasSport ? "Hareketli gun icin rahat parcalari one al." : "Rahat kesimli parcalarla konforlu bir kombin sec.",
      eventType: "spor",
      title: "Rahat gun",
    },
    {
      body: hasAccessories ? "Aksesuari odak yapip sade parcalarla dengele." : "Kombini tamamlamak icin bir aksesuar eksigi not et.",
      eventType: "bulusma",
      title: "Kucuk dokunus",
    },
  ];

  return suggestions[index % suggestions.length];
}

function formatDayLabel(date: Date, index: number) {
  if (index === 0) {
    return "Bugun";
  }

  if (index === 1) {
    return "Yarin";
  }

  return date.toLocaleDateString("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function toDateKey(date: Date) {
  return formatDateOnly(date);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}
