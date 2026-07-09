import { formatCurrency } from "@/lib/utils";
import { BILLING_FREQUENCY_LABELS, type BillingFrequency, type ContractSection } from "@/types/documents";

export const CONTRACT_TEMPLATE_VERSION = 1;

export interface ContractTemplateBillingItem {
  concept: string;
  amount: number;
  frequency: BillingFrequency | string;
}

export interface ContractTemplateData {
  clientName: string;
  contractTitle: string;
  startDate: string;
  endDate?: string;
  proposalReference?: string;
  scope?: string;
  deliverables?: string;
  billingItems: ContractTemplateBillingItem[];
}

const PIXELTEC_LEGAL_NAME = "PixelTEC";

function frequencyLabel(frequency: BillingFrequency | string): string {
  return (BILLING_FREQUENCY_LABELS as Record<string, string>)[frequency] ?? frequency;
}

function investmentList(items: ContractTemplateBillingItem[]): string {
  if (items.length === 0) {
    return "El monto de la inversión queda por definir; se detallará al confirmar los conceptos de cobro del contrato.";
  }
  const lines = items.map(
    (item) => `- ${item.concept}: ${formatCurrency(item.amount)} (${frequencyLabel(item.frequency)})`,
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return [
    "Los conceptos incluidos en este contrato son:",
    ...lines,
    "",
    `Inversión total registrada: ${formatCurrency(total)}.`,
  ].join("\n");
}

/**
 * Plantilla base fija y versionada — la estructura legal es siempre la misma
 * para todos los clientes; solo cambian los datos dinámicos interpolados
 * abajo. Redacción profesional y clara, sin lenguaje legal complejo.
 */
export function buildContractSections(data: ContractTemplateData): ContractSection[] {
  const vigenciaBody = data.endDate
    ? `Este contrato inicia el ${data.startDate} y concluye el ${data.endDate}, salvo renovación o cancelación anticipada conforme a las cláusulas siguientes.`
    : `Este contrato inicia el ${data.startDate} y tiene vigencia indefinida, sujeta a renovación o cancelación conforme a las cláusulas siguientes.`;

  return [
    {
      key: "partes",
      title: "Partes involucradas",
      body: `Este contrato se celebra entre ${PIXELTEC_LEGAL_NAME} ("el proveedor") y ${data.clientName} ("el cliente"), quienes de mutuo acuerdo establecen los términos que se describen a continuación.`,
    },
    {
      key: "objeto",
      title: "Objeto del contrato",
      body: data.proposalReference
        ? `El presente contrato formaliza los servicios descritos en la propuesta ${data.proposalReference}, aceptada por el cliente, y establece las condiciones bajo las cuales ${PIXELTEC_LEGAL_NAME} prestará dichos servicios.`
        : `El presente contrato formaliza la prestación de servicios profesionales de ${PIXELTEC_LEGAL_NAME} al cliente, bajo los términos y condiciones aquí descritos.`,
    },
    {
      key: "alcance",
      title: "Alcance del servicio",
      body:
        data.scope?.trim() ||
        "El alcance del servicio corresponde a lo acordado entre las partes y se detalla en la propuesta relacionada o en los anexos de este contrato.",
    },
    {
      key: "entregables",
      title: "Entregables",
      body:
        data.deliverables?.trim() ||
        "Los entregables específicos de este contrato se detallan en la propuesta relacionada o se acordarán por escrito entre las partes.",
    },
    {
      key: "obligaciones_pixeltec",
      title: "Obligaciones de PixelTEC",
      body: `${PIXELTEC_LEGAL_NAME} se compromete a prestar los servicios contratados con profesionalismo, dentro de los tiempos acordados, manteniendo comunicación clara con el cliente y entregando los resultados conforme a lo especificado en el alcance del servicio.`,
    },
    {
      key: "obligaciones_cliente",
      title: "Obligaciones del cliente",
      body: "El cliente se compromete a proporcionar la información, accesos y materiales necesarios para la prestación del servicio en tiempo y forma, así como a cubrir la inversión acordada conforme a la forma de pago establecida.",
    },
    {
      key: "inversion",
      title: "Inversión",
      body: investmentList(data.billingItems),
    },
    {
      key: "forma_pago",
      title: "Forma de pago",
      body: "Los pagos se realizarán conforme a la periodicidad y montos indicados en la sección de Inversión, mediante efectivo, transferencia bancaria o tarjeta. Cada pago quedará registrado con su fecha, monto y método correspondiente.",
    },
    {
      key: "vigencia",
      title: "Vigencia",
      body: vigenciaBody,
    },
    {
      key: "renovacion",
      title: "Renovación",
      body: "Al concluir la vigencia, este contrato podrá renovarse por acuerdo escrito entre las partes, manteniendo o actualizando las condiciones aquí descritas.",
    },
    {
      key: "cancelacion",
      title: "Cancelación",
      body: "Cualquiera de las partes podrá solicitar la cancelación de este contrato notificando por escrito con al menos 30 días de anticipación. Los servicios prestados y pagos pendientes hasta la fecha de cancelación permanecen exigibles.",
    },
    {
      key: "confidencialidad",
      title: "Confidencialidad",
      body: "Ambas partes se comprometen a mantener bajo confidencialidad la información sensible compartida durante la relación contractual, y a no divulgarla a terceros sin autorización previa.",
    },
    {
      key: "propiedad_intelectual",
      title: "Propiedad intelectual",
      body: "Los entregables desarrollados específicamente para el cliente le pertenecen una vez cubierta la inversión pactada. Las herramientas, metodologías y componentes reutilizables propiedad de PixelTEC previos a este contrato permanecen bajo su titularidad.",
    },
    {
      key: "soporte",
      title: "Soporte",
      body: "PixelTEC brindará soporte relacionado con los entregables de este contrato conforme a los canales y tiempos de respuesta acordados con el cliente.",
    },
    {
      key: "aprobacion",
      title: "Aprobación",
      body: "Este contrato se considera aprobado una vez confirmado por ambas partes, quedando registrado el detalle de cliente, propuesta relacionada, servicios, entregables e inversión descritos en las secciones anteriores.",
    },
  ];
}

/** Aplana las secciones a texto plano para `contracts.content` (compat PDF). */
export function flattenSections(sections: ContractSection[]): string {
  return sections.map((s) => `${s.title}\n\n${s.body}`).join("\n\n---\n\n");
}
