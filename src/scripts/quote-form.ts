import {
  buildQuoteMessage,
  buildWhatsAppQuoteUrl,
  type QuoteRequest,
} from "../lib/whatsapp";

type QuoteControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FORM_SELECTOR = "form[data-quote-form]";

const REQUIRED_MESSAGES: Record<string, string> = {
  name: "Escribe tu nombre.",
  phone: "Escribe un teléfono donde podamos contactarte.",
  eventType: "Selecciona el tipo de evento.",
  eventDate: "Selecciona una fecha estimada.",
  guests: "Indica el número estimado de invitados.",
};

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFieldName(control: QuoteControl): string {
  return control.dataset.quoteField ?? control.name;
}

function contextualValidity(control: QuoteControl): void {
  control.setCustomValidity("");
  const field = getFieldName(control);
  const value = control.value.trim();

  if (field === "name" && value && value.length < 2) {
    control.setCustomValidity("Escribe un nombre de al menos dos caracteres.");
  }

  if (field === "phone" && value.replace(/\D/g, "").length < 10) {
    control.setCustomValidity("Usa un teléfono válido, con al menos 10 dígitos.");
  }

  if (
    field === "eventDate" &&
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value < localDateValue()
  ) {
    control.setCustomValidity("Elige una fecha de hoy en adelante.");
  }
}

function validationMessage(control: QuoteControl): string {
  const validity = control.validity;
  const field = getFieldName(control);

  if (validity.customError) return control.validationMessage;
  if (validity.valueMissing) {
    return REQUIRED_MESSAGES[field] ?? "Completa este campo.";
  }
  if (validity.patternMismatch && field === "phone") {
    return "Usa un teléfono válido, con al menos 10 dígitos.";
  }
  if (validity.typeMismatch && field === "email") {
    return "Escribe un correo electrónico válido.";
  }
  if (validity.typeMismatch) return "Revisa el formato de este campo.";
  if (validity.rangeUnderflow && field === "guests") {
    return "El número de invitados debe ser mayor que cero.";
  }
  if (validity.rangeOverflow && field === "guests") {
    return "Para eventos de más de 1,000 invitados, escríbenos directamente.";
  }
  if (validity.badInput && field === "guests") {
    return "Escribe el número de invitados con cifras.";
  }
  if (validity.tooShort) return "Escribe un poco más de información.";
  if (validity.tooLong) return "Reduce el texto para continuar.";
  return "Revisa este campo.";
}

function errorElement(
  form: HTMLFormElement,
  control: QuoteControl,
): HTMLElement | undefined {
  const field = getFieldName(control);
  return Array.from(
    form.querySelectorAll<HTMLElement>("[data-quote-error]"),
  ).find((element) => element.dataset.errorFor === field);
}

function validateControl(
  form: HTMLFormElement,
  control: QuoteControl,
): boolean {
  contextualValidity(control);
  const valid = control.validity.valid;
  const error = errorElement(form, control);

  if (valid) {
    control.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    return true;
  }

  control.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = validationMessage(control);
    error.hidden = false;
  }
  return false;
}

function fieldValue(form: HTMLFormElement, field: string): string {
  return (
    Array.from(form.querySelectorAll<QuoteControl>("[data-quote-field]")).find(
      (control) => getFieldName(control) === field,
    )?.value.trim() ?? ""
  );
}

function quoteRequest(form: HTMLFormElement): QuoteRequest {
  return {
    name: fieldValue(form, "name"),
    phone: fieldValue(form, "phone"),
    email: fieldValue(form, "email"),
    eventType: fieldValue(form, "eventType"),
    eventDate: fieldValue(form, "eventDate"),
    guests: fieldValue(form, "guests"),
    space: fieldValue(form, "space"),
    packageOption: fieldValue(form, "packageOption"),
    comments: fieldValue(form, "comments"),
  };
}

function setupQuoteForm(form: HTMLFormElement): void {
  if (form.dataset.quoteInitialized === "true") return;
  form.dataset.quoteInitialized = "true";
  form.noValidate = true;

  const controller = new AbortController();
  const { signal } = controller;
  const controls = Array.from(
    form.querySelectorAll<QuoteControl>("[data-quote-field]"),
  );
  const dateControl = controls.find(
    (control): control is HTMLInputElement =>
      control instanceof HTMLInputElement &&
      getFieldName(control) === "eventDate",
  );
  const messageInput = form.querySelector<HTMLInputElement>(
    "[data-whatsapp-message]",
  );
  const summary = form.querySelector<HTMLElement>("[data-quote-summary]");
  const status = form.querySelector<HTMLElement>("[data-quote-status]");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  let engaged = false;

  if (dateControl) dateControl.min = localDateValue();

  const setEngagement = (value: boolean): void => {
    if (engaged === value) return;
    engaged = value;
    form.dataset.quoteEngaged = value ? "true" : "false";
    window.dispatchEvent(
      new CustomEvent("el-lienzo:quote-engagement", {
        detail: { engaged: value },
      }),
    );
  };

  const connectChoiceLinks = (
    selector: string,
    field: "space" | "packageOption",
    attribute: "quoteSpace" | "quotePackage",
  ): void => {
    document.querySelectorAll<HTMLAnchorElement>(selector).forEach((link) => {
      link.addEventListener(
        "click",
        () => {
          const control = controls.find(
            (candidate): candidate is HTMLSelectElement =>
              candidate instanceof HTMLSelectElement &&
              getFieldName(candidate) === field,
          );
          const value = link.dataset[attribute];
          if (!control || !value) return;

          control.value = value;
          control.dispatchEvent(new Event("change", { bubbles: true }));
          setEngagement(true);
        },
        { signal },
      );
    });
  };

  connectChoiceLinks("[data-quote-space]", "space", "quoteSpace");
  connectChoiceLinks(
    "[data-quote-package]",
    "packageOption",
    "quotePackage",
  );

  const resetFeedback = (): void => {
    controls.forEach((control) => {
      control.setCustomValidity("");
      control.removeAttribute("aria-invalid");
      const error = errorElement(form, control);
      if (error) {
        error.textContent = "";
        error.hidden = true;
      }
    });

    if (summary) {
      summary.textContent = "";
      summary.hidden = true;
    }
    if (status) status.textContent = "";
    form.dataset.submissionState = "idle";
  };

  const clearStaleSubmissionState = (): void => {
    const state = form.dataset.submissionState;
    const invalidControls = form.querySelectorAll('[aria-invalid="true"]');

    if (state === "ready" || (state === "invalid" && invalidControls.length === 0)) {
      if (summary) {
        summary.textContent = "";
        summary.hidden = true;
      }
      if (status) status.textContent = "";
      form.dataset.submissionState = "editing";
    }
  };

  form.addEventListener("focusin", () => setEngagement(true), { signal });
  form.addEventListener(
    "input",
    () => {
      setEngagement(true);
      clearStaleSubmissionState();
    },
    { signal },
  );
  form.addEventListener("change", clearStaleSubmissionState, { signal });

  controls.forEach((control) => {
    control.addEventListener("blur", () => validateControl(form, control), {
      signal,
    });
    control.addEventListener(
      "input",
      () => {
        if (control.getAttribute("aria-invalid") === "true") {
          validateControl(form, control);
        }
      },
      { signal },
    );
    control.addEventListener("change", () => validateControl(form, control), {
      signal,
    });
  });

  form.addEventListener(
    "submit",
    (event) => {
      setEngagement(true);
      const validity = controls.map((control) =>
        validateControl(form, control),
      );
      const firstInvalid = controls.find((_, index) => !validity[index]);

      if (firstInvalid) {
        event.preventDefault();
        form.dataset.submissionState = "invalid";
        if (summary) {
          summary.textContent =
            "Revisa los campos señalados antes de continuar a WhatsApp.";
          summary.hidden = false;
        }
        firstInvalid.focus({ preventScroll: true });
        firstInvalid.scrollIntoView({
          behavior: reducedMotion.matches ? "auto" : "smooth",
          block: "center",
        });
        return;
      }

      event.preventDefault();
      const quote = quoteRequest(form);
      const message = buildQuoteMessage(quote);
      const url = buildWhatsAppQuoteUrl(quote);

      if (messageInput) messageInput.value = message;
      if (summary) {
        summary.textContent = "";
        summary.hidden = true;
      }
      if (status) {
        status.textContent =
          "Abrimos WhatsApp con tu solicitud. Revisa el mensaje y envíalo para terminar.";
      }
      form.dataset.submissionState = "ready";

      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (popup) {
        popup.opener = null;
      } else {
        window.location.assign(url);
      }

      window.dispatchEvent(
        new CustomEvent("el-lienzo:quote-ready", { detail: { quote } }),
      );
    },
    { signal },
  );

  form.addEventListener(
    "reset",
    () => {
      window.setTimeout(() => {
        engaged = true;
        setEngagement(false);
        resetFeedback();
      }, 0);
    },
    { signal },
  );

  document.addEventListener("astro:before-swap", () => controller.abort(), {
    once: true,
    signal,
  });
}

export function initQuoteForms(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLFormElement>(FORM_SELECTOR).forEach(setupQuoteForm);
}
