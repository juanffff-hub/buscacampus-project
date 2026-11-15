import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

const PASSWORD = "E2e-test-password-2026";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6L8AAAAASUVORK5CYII=",
  "base64",
);

async function createAccount(page, name, email) {
  await page.goto("/register");
  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Correo institucional").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function signIn(page, email) {
  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("dos usuarios publican, reclaman, deciden y consultan evidencia privada tras recargar", async ({ browser, request }) => {
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const authorEmail = `autor-${suffix}@uao.edu.co`;
  const claimantEmail = `reclamante-${suffix}@uao.edu.co`;
  const title = `Hallazgo E2E ${suffix}`;
  const authorContext = await browser.newContext();
  const claimantContext = await browser.newContext();
  const visitorContext = await browser.newContext();
  const anonymousContext = await browser.newContext();
  const author = await authorContext.newPage();
  const claimant = await claimantContext.newPage();
  const visitor = await visitorContext.newPage();

  try {
    await createAccount(author, "Autor de prueba", authorEmail);
    await signIn(author, authorEmail);
    await author.getByRole("button", { name: "Publicar reporte" }).click();
    const reportForm = author.locator("form.report-form");
    await reportForm.getByLabel("Título").fill(title);
    await reportForm.getByLabel("Tipo de reporte").selectOption("Encontrado");
    await reportForm.getByLabel("Categoría").selectOption({ index: 1 });
    await reportForm.getByLabel("Ubicación").selectOption({ index: 1 });
    const eventDate = new Date(Date.now() - 60_000);
    eventDate.setMinutes(eventDate.getMinutes() - eventDate.getTimezoneOffset());
    await reportForm.getByLabel("Fecha y hora del evento").fill(eventDate.toISOString().slice(0, 16));
    await reportForm.getByLabel(/Descripción/).fill("Descripción sintética para verificar la devolución del hallazgo.");
    await reportForm.locator("#report-image").setInputFiles({
      name: "hallazgo.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await reportForm.getByRole("button", { name: "Publicar reporte" }).click();
    const reportLink = author.getByRole("link", { name: `Ver detalle del reporte: ${title}` });
    await expect(reportLink).toBeVisible();
    const reportPath = await reportLink.getAttribute("href");
    const reportId = reportPath.match(/\/reportes\/(\d+)/)?.[1];
    expect(reportId).toBeTruthy();

    await author.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(author).toHaveURL(/\/$/);

    await createAccount(claimant, "Reclamante de prueba", claimantEmail);
    await visitor.goto(reportPath);
    await visitor.getByRole("link", { name: "Reclamar este objeto" }).click();
    await expect(visitor).toHaveURL(/\/login$/);
    await visitor.getByLabel("Correo institucional").fill(claimantEmail);
    await visitor.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await visitor.getByRole("button", { name: "Ingresar" }).click();
    await expect(visitor).toHaveURL(new RegExp(`/reportes/${reportId}/reclamar$`));

    await visitor.getByLabel("Mensaje de prueba").fill("Puedo identificar una marca exclusiva en el objeto que encontré.");
    await visitor.locator("#claim-evidence").setInputFiles({
      name: "evidencia.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    const creationResponsePromise = visitor.waitForResponse(response =>
      response.request().method() === "POST" &&
      /\/api\/v1\/reportes\/\d+\/reclamaciones$/.test(new URL(response.url()).pathname),
    );
    await visitor.getByRole("button", { name: "Enviar reclamación" }).click();
    const creationResponse = await creationResponsePromise;
    expect(creationResponse.status()).toBe(201);
    const createdClaim = await creationResponse.json();
    const claimId = createdClaim.data.reclamacion.id;
    await expect(visitor).toHaveURL(new RegExp(`/reportes/${reportId}$`));
    await expect(visitor.getByRole("status")).toContainText("Reclamación enviada");
    await expect(visitor.getByText("En reclamación")).toBeVisible();
    const unauthorizedEvidence = await anonymousContext.request.get(
      `http://localhost:4000/api/v1/reclamaciones/${claimId}/evidencia`,
    );
    expect(unauthorizedEvidence.status()).toBe(401);

    await signIn(author, authorEmail);
    await author.goto("/reclamaciones/recibidas");
    await expect(author.getByRole("heading", { name: title })).toBeVisible();
    await author.getByRole("button", { name: "Ver mensaje y evidencia" }).click();
    await expect(author.getByText(/marca exclusiva en el objeto/)).toBeVisible();
    await author.getByRole("button", { name: "Ver evidencia privada" }).click();
    await expect(author.getByAltText("Evidencia privada: evidencia.png")).toBeVisible();
    author.once("dialog", dialog => dialog.accept());
    await author.getByRole("button", { name: "Aprobar devolución" }).click();
    await expect(author.getByRole("status")).toContainText("Reclamación aprobada");

    await visitor.goto(reportPath);
    await expect(visitor.getByText("Devuelto")).toBeVisible();
    await claimant.goto("/reclamaciones/mias");
    await expect(claimant.getByRole("heading", { name: title })).toBeVisible();
    await expect(claimant.getByText("Aprobada")).toBeVisible();
    await claimant.reload();
    await expect(claimant.getByText("Aprobada")).toBeVisible();
    await claimant.getByRole("button", { name: "Ver detalle y evidencia" }).click();
    await claimant.getByRole("button", { name: "Ver evidencia privada" }).click();
    await expect(claimant.getByAltText("Evidencia privada: evidencia.png")).toBeVisible();

    const privateEvidence = await request.get(
      `http://localhost:4000/api/v1/reclamaciones/${claimId}/evidencia`,
    );
    expect(privateEvidence.status()).toBe(401);
  } finally {
    await Promise.all([
      authorContext.close(),
      claimantContext.close(),
      visitorContext.close(),
      anonymousContext.close(),
    ]);
  }
});
