import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(request, { params }) {
  const { id } = await params;
  const priceId = Number(id);
  if (!priceId) return NextResponse.json({ message: "Ficha invalida." }, { status: 400 });

  let browser;
  try {
    const url = new URL(`/catalogo/${priceId}`, request.nextUrl.origin).toString();
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ficha-tecnica-${priceId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating catalog PDF:", error);
    return NextResponse.json({ message: "No se pudo generar el PDF." }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
