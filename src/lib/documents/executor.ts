// Tipo compartido para funciones que aceptan `db` o un `tx` de transacción,
// para poder componerse dentro de una transacción ya abierta por el caller.
import type { DB } from "@/lib/db";

export type Executor = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];
