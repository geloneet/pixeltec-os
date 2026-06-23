export interface PortalRequest {
  id: string;
  uid: string;
  clientId: string;
  token: string;
  type: "solicitud" | "incidencia" | "mejora";
  title: string;
  description: string;
  status: "recibida" | "en_progreso" | "resuelta";
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}
