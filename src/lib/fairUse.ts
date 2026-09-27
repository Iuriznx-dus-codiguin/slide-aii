// Limites de uso citados nos Termos de Uso (Política de Uso Justo) e na
// Central de Ajuda. Os valores espelham o que os servidores aplicam — ao
// mudar um limite numa edge function, atualize aqui e nos Termos.
import { PLAN_MONTHLY_CREDITS } from "@/lib/cakto";

/** generate-presentation: check_rate_limit(_max_per_hour: 12) por conta. */
export const FAIR_USE_HOURLY_GENERATIONS = 12;

/** Teto mensal do plano MAX ("uso ilimitado" dentro do uso justo). */
export const FAIR_USE_MAX_MONTHLY_CREDITS = PLAN_MONTHLY_CREDITS.max_mensal;

/** chat-editor: MAX_CHAT_MESSAGES / MAX_COMPLEX_EDITS por apresentação. */
export const CHAT_EDIT_MESSAGES_PER_PRESENTATION = 10;
export const CHAT_COMPLEX_EDITS_PER_PRESENTATION = 3;

/** regenerate-speeches: MAX_SPEECH_REGENS por apresentação (só com falas pagas). */
export const SPEECH_REGENS_PER_PRESENTATION = 5;

/** fetch-image: imagens geradas por IA sob demanda, por hora e por conta. */
export const AI_IMAGES_PER_HOUR = 15;
