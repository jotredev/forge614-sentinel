import { en } from "./en";
import { es } from "./es";
import type { Locale, MessageKey, MessageParams } from "./types";
const catalogs = { es, en } as const;
export function renderMessage(key: MessageKey, params: MessageParams, locale: Locale): string {
  return catalogs[locale][key](params);
}
export function renderBoth(key: MessageKey, params: MessageParams): { es: string; en: string } {
  return { es: renderMessage(key, params, "es"), en: renderMessage(key, params, "en") };
}
