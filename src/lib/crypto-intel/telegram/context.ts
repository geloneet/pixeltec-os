// Tipo de contexto compartido. Importar desde aquí para evitar ciclos.
import { Context, SessionFlavor } from "grammy";
import type { AlertRule } from "../types";

export interface SessionData {
  flow?: "new_alert";
  draft?: Partial<AlertRule> & { step?: number };
}

export type BotContext = Context & SessionFlavor<SessionData> & {
  isAdmin: boolean;
};
