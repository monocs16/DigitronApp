import { PDFDocument } from "pdf-lib";
type ServiceOrderPdfData = {
  order_number: string;
  created_at: string;
  reported_fault: string;
  received_accessories?: string | null;
  equipment_condition: string;
  customers: {
    name: string;
    phone1: string | null;
    address: string | null;
  } | null;
  equipment: {
    type: string;
    brand: string;
    model: string;
    serial_number: string | null;
  } | null;
};

const TEMPLATE_URL = "/orden-servicio-digitron.pdf";

function setText(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, value: string) {
  // The supplied form uses a standard WinAnsi font. Keep Latin accents while
  // replacing symbols (for example ₡) that would prevent PDF generation.
  const compatibleValue = value.replaceAll("₡", "CRC ").replaceAll("—", "-").replaceAll("–", "-");
  const winAnsiSafeValue = Array.from(compatibleValue)
    .map((character) => (character.codePointAt(0)! <= 0xff ? character : "?"))
    .join("");
  form.getTextField(fieldName).setText(winAnsiSafeValue);
}

function formatAdvance(advance: number) {
  if (advance <= 0) return "Sin anticipo registrado.";
  const amount = new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(advance)
    .replaceAll(/\s/g, " ");
  return `Cliente da un anticipo de ${amount} colones.`;
}

export function buildServiceOrderPdfValues(order: ServiceOrderPdfData, advance: number) {
  const customer = order.customers;
  const equipment = order.equipment;

  return {
    order: order.order_number,
    date: new Intl.DateTimeFormat("es-CR").format(new Date(order.created_at)),
    client: customer?.name ?? "",
    phone: customer?.phone1 ?? "",
    address: customer?.address ?? "",
    article: equipment?.type ?? "",
    brand: equipment?.brand ?? "",
    model: equipment?.model ?? "",
    serial: equipment?.serial_number ?? "",
    observations: formatAdvance(advance),
    accessories: order.received_accessories ?? "",
    state: order.equipment_condition,
    damage: order.reported_fault,
  };
}

/**
 * Fills the supplied editable PDF template without flattening it, preserving
 * both its original layout and editable form fields for the customer copy and
 * Digitron copy.
 */
export async function downloadServiceOrderPdf(order: ServiceOrderPdfData, advance: number) {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) throw new Error("No se pudo cargar la plantilla de orden de servicio.");

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const form = pdf.getForm();
  const values = buildServiceOrderPdfValues(order, advance);

  for (const copy of ["cliente", "digitron"] as const) {
    setText(form, `${copy}_order_header`, values.order);
    setText(form, `${copy}_date`, values.date);
    setText(form, `${copy}_client`, values.client);
    setText(form, `${copy}_phone`, values.phone);
    setText(form, `${copy}_address`, values.address);
    setText(form, `${copy}_article`, values.article);
    setText(form, `${copy}_brand`, values.brand);
    setText(form, `${copy}_model`, values.model);
    setText(form, `${copy}_serial`, values.serial);
    setText(form, `${copy}_observations`, values.observations);
    setText(form, `${copy}_accessories`, values.accessories);
    setText(form, `${copy}_state`, values.state);
    setText(form, `${copy}_damage`, values.damage);
  }
  setText(form, "cliente_order_footer", values.order);
  setText(form, "digitron_order_stub_1", values.order);
  setText(form, "digitron_order_stub_2", values.order);
  setText(form, "digitron_order_stub_3", values.order);

  form.updateFieldAppearances();
  const bytes = await pdf.save();
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `orden-servicio-${order.order_number}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
