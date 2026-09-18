export const WHATSAPP_NUMBER = "524271032890";
export const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export interface QuoteRequest {
  name: string;
  phone?: string;
  email?: string;
  eventType: string;
  eventDate: string;
  guests: string | number;
  space?: string;
  packageOption?: string;
  comments?: string;
  promotion?: string;
}

const EVENT_LABELS: Record<string, string> = {
  boda: "Boda",
  xv: "XV años",
  cumpleanos: "Cumpleaños",
  familiar: "Celebración familiar",
  corporativo: "Evento corporativo",
  otro: "Otro",
};

const SPACE_LABELS: Record<string, string> = {
  terrazas: "Terrazas",
  establos: "Establos",
  salon: "Salón",
  ruedo: "Ruedo",
  "por-definir": "Aún no lo sé",
};

const PACKAGE_LABELS: Record<string, string> = {
  basico: "Básico",
  completo: "Completo",
  premium: "Premium",
  "por-definir": "Aún no lo sé",
};

function normalizeSingleLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComments(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function optionLabel(value: unknown, labels: Record<string, string>): string {
  const normalized = normalizeSingleLine(value);
  return labels[normalized] ?? normalized;
}

export function formatQuoteDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function buildQuoteMessage(quote: QuoteRequest): string {
  const lines = [
    "Hola, quiero cotizar un evento en El Lienzo.",
    "",
    `Nombre: ${normalizeSingleLine(quote.name)}`,
  ];

  const phone = normalizeSingleLine(quote.phone);
  const email = normalizeSingleLine(quote.email);
  if (phone) {
    lines.push(`Teléfono: ${phone}`);
  }
  if (email) {
    lines.push(`Correo: ${email}`);
  }

  lines.push(
    `Tipo de evento: ${optionLabel(quote.eventType, EVENT_LABELS)}`,
    `Fecha: ${formatQuoteDate(normalizeSingleLine(quote.eventDate))}`,
    `Invitados: ${normalizeSingleLine(quote.guests)}`,
  );

  const space = optionLabel(quote.space, SPACE_LABELS);
  const packageOption = optionLabel(quote.packageOption, PACKAGE_LABELS);
  const promotion = normalizeSingleLine(quote.promotion);
  const comments = normalizeComments(quote.comments);

  if (space) {
    lines.push(`Espacio: ${space}`);
  }

  if (packageOption) {
    lines.push(`Paquete: ${packageOption}`);
  }

  if (promotion) {
    lines.push(`Promoción: ${promotion}`);
  }

  if (comments) {
    lines.push("", `Comentarios: ${comments}`);
  }

  return lines.join("\n");
}

export function buildWhatsAppQuoteUrl(quote: QuoteRequest): string {
  const url = new URL(WHATSAPP_BASE_URL);
  url.searchParams.set("text", buildQuoteMessage(quote));
  return url.toString();
}
