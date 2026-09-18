import { describe, expect, it } from "vitest";

import {
  buildQuoteMessage,
  buildWhatsAppQuoteUrl,
  formatQuoteDate,
  type QuoteRequest,
} from "../../src/lib/whatsapp";

const quote: QuoteRequest = {
  name: "Ana  López",
  phone: "+52 427 555 0101",
  email: "ana@example.com",
  eventType: "boda",
  eventDate: "2026-12-15",
  guests: 140,
  space: "ruedo",
  packageOption: "premium",
  comments: "Ceremonia al atardecer\ncon cena.",
};

describe("buildQuoteMessage", () => {
  it("creates a readable Spanish message with labels and contact data", () => {
    const message = buildQuoteMessage(quote);

    expect(message).toContain("Nombre: Ana López");
    expect(message).toContain("Teléfono: +52 427 555 0101");
    expect(message).toContain("Correo: ana@example.com");
    expect(message).toContain("Tipo de evento: Boda");
    expect(message).toContain("Fecha: 15/12/2026");
    expect(message).toContain("Espacio: Ruedo");
    expect(message).toContain("Paquete: Premium");
  });

  it("omits optional empty fields", () => {
    const message = buildQuoteMessage({
      ...quote,
      phone: " ",
      space: "",
      packageOption: "",
      comments: "",
    });

    expect(message).not.toContain("Teléfono:");
    expect(message).not.toContain("Espacio:");
    expect(message).not.toContain("Paquete:");
    expect(message).not.toContain("Comentarios:");
  });
});

describe("buildWhatsAppQuoteUrl", () => {
  it("targets El Lienzo and safely encodes the complete message", () => {
    const url = buildWhatsAppQuoteUrl(quote);
    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://wa.me/524271032890",
    );
    expect(parsed.searchParams.get("text")).toBe(buildQuoteMessage(quote));
    expect(url).toContain("%0A");
    expect(url).toContain("cotizar+un+evento");
  });
});

describe("formatQuoteDate", () => {
  it("formats an ISO calendar value without time-zone drift", () => {
    expect(formatQuoteDate("2026-12-15")).toBe("15/12/2026");
  });
});
