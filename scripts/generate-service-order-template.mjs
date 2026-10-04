import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { PDFDocument, StandardFonts, TextAlignment, rgb } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const BLACK = rgb(0.05, 0.05, 0.05);
const GRAY = rgb(0.35, 0.35, 0.35);
const RULE = rgb(0.72, 0.72, 0.72);

const outputArgument = process.argv.indexOf("--output");
const outputPath = resolve(
  outputArgument >= 0 && process.argv[outputArgument + 1]
    ? process.argv[outputArgument + 1]
    : "public/orden-servicio-digitron.pdf",
);

const conditions = [
  "1. Todo equipo paga un valor por diagnóstico y revisión, no reembolsable.",
  "2. Garantía: 30 días únicamente sobre mano de obra. No cubre repuestos ni daños por mal uso, golpes, humedad, manipulación de terceros o causas externas.",
  "3. El equipo debe ser recogido dentro de 8 días desde el aviso de finalización. Si no es retirado dentro de este plazo, la empresa está facultada para cobrar el bodegaje correspondiente; si no es retirado en 90 días, se considerará abandonado y la empresa podrá disponer del mismo para cubrir valores adeudados, sin reclamo posterior.",
  "4. No nos responsabilizamos por daños o pérdidas por caso fortuito, fuerza mayor, incendio, robo u otras causas ajenas a nuestro control.",
  "5. En los equipos que requieran manipulación de panel/pantalla. El cliente reconoce que existe riesgo de quiebre o daño adicional por la fragilidad del componente. Por lo que no nos responsabilizamos por daños inherentes al procedimiento técnico.",
];

function centeredX(font, text, size, center) {
  return center - font.widthOfTextAtSize(text, size) / 2;
}

function drawCentered(page, font, text, size, center, y, color = BLACK) {
  page.drawText(text, { x: centeredX(font, text, size, center), y, size, font, color });
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBackgroundCopy(page, fonts, top, copyLabel, includeStubs) {
  const { regular, bold } = fonts;
  const y = (offset) => top - offset;

  page.drawText("Digitron", { x: 18, y: y(28), size: 22, font: bold, color: BLACK });
  page.drawText("Centro de Servicio Autorizado", {
    x: 18,
    y: y(45),
    size: 10.5,
    font: bold,
    color: BLACK,
  });
  page.drawText("Costado norte de la Catedral, 100 norte y 15 este, Alajuela, C. R.", {
    x: 18,
    y: y(58),
    size: 6.8,
    font: regular,
    color: GRAY,
  });
  page.drawText("Teléfonos:  2440-7352  ·  2440-7616  ·  WhatsApp 8720-3588", {
    x: 18,
    y: y(71),
    size: 7.4,
    font: bold,
    color: BLACK,
  });

  drawCentered(page, regular, "ORDEN DE SERVICIO", 14, 402, y(29));
  page.drawText("N.º:", { x: 482, y: y(29), size: 10, font: bold, color: BLACK });
  page.drawText("Fecha:", { x: 300, y: y(55), size: 8, font: bold, color: BLACK });
  page.drawText(copyLabel, { x: 485, y: y(55), size: 7.5, font: regular, color: GRAY });

  page.drawText("Cliente:", { x: 18, y: y(93), size: 8, font: bold, color: BLACK });
  page.drawText("Teléfono:", { x: 302, y: y(93), size: 8, font: bold, color: BLACK });
  page.drawText("Dirección:", { x: 18, y: y(110), size: 8, font: bold, color: BLACK });

  const columns = [18, 160, 302, 444, 594];
  const headings = ["ARTÍCULO", "MARCA", "MODELO", "NÚMERO DE SERIE"];
  page.drawLine({
    start: { x: 18, y: y(139) },
    end: { x: 594, y: y(139) },
    thickness: 0.5,
    color: RULE,
  });
  page.drawLine({
    start: { x: 18, y: y(163) },
    end: { x: 594, y: y(163) },
    thickness: 0.5,
    color: RULE,
  });
  for (let index = 0; index < headings.length; index += 1) {
    drawCentered(page, bold, headings[index], 7, (columns[index] + columns[index + 1]) / 2, y(132));
    if (index > 0) {
      page.drawLine({
        start: { x: columns[index], y: y(139) },
        end: { x: columns[index], y: y(163) },
        thickness: 0.4,
        color: RULE,
      });
    }
  }

  const detailLabels = [
    ["Observaciones:", 180],
    ["Accesorios:", 197],
    ["Estado:", 214],
    ["Daño reportado:", 231],
  ];
  for (const [label, offset] of detailLabels) {
    page.drawText(label, { x: 18, y: y(offset), size: 7.2, font: bold, color: BLACK });
  }

  page.drawText("Condiciones de servicio", {
    x: 18,
    y: y(253),
    size: 6.6,
    font: bold,
    color: BLACK,
  });
  let conditionY = y(262);
  for (const condition of conditions) {
    for (const line of wrapText(condition, regular, 4.5, 576)) {
      page.drawText(line, { x: 18, y: conditionY, size: 4.5, font: regular, color: BLACK });
      conditionY -= 5.6;
    }
  }

  page.drawLine({
    start: { x: 28, y: y(342) },
    end: { x: 160, y: y(342) },
    thickness: 0.55,
    color: BLACK,
  });
  page.drawLine({
    start: { x: 218, y: y(342) },
    end: { x: 372, y: y(342) },
    thickness: 0.55,
    color: BLACK,
  });
  drawCentered(page, regular, "FIRMA DEL CLIENTE", 6.8, 94, y(354));
  drawCentered(page, regular, "DIGITRON DEPTO. TÉCNICO", 6.8, 295, y(354));

  if (includeStubs) {
    page.drawLine({
      start: { x: 18, y: y(365) },
      end: { x: 594, y: y(365) },
      thickness: 0.55,
      color: BLACK,
    });
    for (const x of [28, 223, 418]) {
      page.drawText("N.º:", { x, y: y(381), size: 7.5, font: bold, color: BLACK });
    }
  } else {
    page.drawText("Centro de Servicio DIGITRON", {
      x: 390,
      y: y(318),
      size: 8.3,
      font: bold,
      color: BLACK,
    });
    page.drawText("N.º:", { x: 482, y: y(335), size: 8, font: bold, color: BLACK });
  }
}

function addTextField(form, page, font, name, options) {
  const field = form.createTextField(name);
  if (options.multiline) field.enableMultiline();
  field.setAlignment(options.alignment ?? TextAlignment.Left);
  field.addToPage(page, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    borderWidth: 0,
    font,
    textColor: BLACK,
  });
  field.setFontSize(options.fontSize ?? 7.5);
  return field;
}

function addCopyFields(form, page, font, top, prefix, includeStubs) {
  const py = (topOffset, height) => top - topOffset - height;
  const field = (suffix, topOffset, x, width, height = 12, options = {}) =>
    addTextField(form, page, font, `${prefix}_${suffix}`, {
      x,
      y: py(topOffset, height),
      width,
      height,
      ...options,
    });

  field("order_header", 14, 512, 80, 16, { fontSize: 10 });
  field("date", 44, 337, 112, 14, { fontSize: 8 });
  field("client", 82, 63, 220, 14, { fontSize: 8 });
  field("phone", 82, 354, 238, 14, { fontSize: 8 });
  field("address", 99, 63, 529, 14, { fontSize: 8 });
  field("article", 141, 21, 136, 19, { fontSize: 7.5, alignment: TextAlignment.Center });
  field("brand", 141, 163, 136, 19, { fontSize: 7.5, alignment: TextAlignment.Center });
  field("model", 141, 305, 136, 19, { fontSize: 7.5, alignment: TextAlignment.Center });
  field("serial", 141, 447, 144, 19, { fontSize: 7.5, alignment: TextAlignment.Center });
  field("observations", 169, 86, 506, 14, { fontSize: 7 });
  field("accessories", 186, 74, 518, 14, { fontSize: 7 });
  field("state", 203, 54, 538, 14, { fontSize: 7 });
  field("damage", 220, 90, 502, 22, { fontSize: 6.5, multiline: true });

  if (includeStubs) {
    field("order_stub_1", 368, 54, 145, 16, { fontSize: 8 });
    field("order_stub_2", 368, 249, 145, 16, { fontSize: 8 });
    field("order_stub_3", 368, 444, 145, 16, { fontSize: 8 });
  } else {
    field("order_footer", 322, 512, 80, 16, { fontSize: 8 });
  }
}

async function createBackground(path) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  drawBackgroundCopy(page, { regular, bold }, 780, "Original cliente", false);
  drawBackgroundCopy(page, { regular, bold }, 388, "Copia Digitron", true);
  page.drawLine({
    start: { x: 0, y: 396 },
    end: { x: PAGE_WIDTH, y: 396 },
    thickness: 0.7,
    color: GRAY,
  });

  pdf.setTitle("Orden de servicio Digitron");
  pdf.setAuthor("Digitron");
  pdf.setSubject("Plantilla editable de orden de servicio");
  writeFileSync(path, await pdf.save());
}

async function addEditableFields(backgroundPath, path) {
  const pdf = await PDFDocument.load(readFileSync(backgroundPath));
  const page = pdf.getPage(0);
  const form = pdf.getForm();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  addCopyFields(form, page, regular, 780, "cliente", false);
  addCopyFields(form, page, regular, 388, "digitron", true);
  form.updateFieldAppearances(regular);

  pdf.setTitle("Orden de servicio Digitron - editable");
  pdf.setAuthor("Digitron");
  pdf.setSubject("Plantilla editable de orden de servicio");
  pdf.setCreator("Digitron App");
  pdf.setProducer("pdf-lib");
  writeFileSync(path, await pdf.save({ useObjectStreams: false }));
}

const workingDirectory = mkdtempSync(resolve(tmpdir(), "digitron-service-order-"));
const backgroundPath = resolve(workingDirectory, "background.pdf");
const embeddedBackgroundPath = resolve(workingDirectory, "background-embedded.pdf");

try {
  await createBackground(backgroundPath);
  execFileSync("gs", [
    "-q",
    "-dBATCH",
    "-dNOPAUSE",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.7",
    "-dPDFSETTINGS=/prepress",
    "-dEmbedAllFonts=true",
    "-dSubsetFonts=true",
    `-sOutputFile=${embeddedBackgroundPath}`,
    "-c",
    "<</NeverEmbed []>> setdistillerparams",
    "-f",
    backgroundPath,
  ]);
  mkdirSync(dirname(outputPath), { recursive: true });
  await addEditableFields(embeddedBackgroundPath, outputPath);
  console.log(`Generated ${outputPath}`);
} finally {
  rmSync(workingDirectory, { recursive: true, force: true });
}
