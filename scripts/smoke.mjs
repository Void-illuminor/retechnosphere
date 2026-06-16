// End-to-end smoke test for the roster/dossier (original-style) UI.
// enter -> build with email -> release -> land on the creature's dossier ->
// verify life story -> back to roster -> see the creature card. Fails on errors.
import puppeteer from "puppeteer";

const URL = process.env.SMOKE_URL || "http://localhost:8899/";
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, selector, text) {
  for (const h of await page.$$(selector)) {
    const t = await page.evaluate((el) => el.textContent, h);
    if (t && t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) errors.push(`http ${r.status()} ${r.url()}`);
  });

  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.waitForSelector("button.primary");
  await clickByText(page, "button.primary", "Enter");

  // Builder
  await page.waitForSelector(".builder", { timeout: 5000 });
  await clickByText(page, ".diet-opt", "Prowler");
  const inputs = await page.$$(".name-row input");
  await inputs[0].type("Smokey");
  await inputs[1].type("Tester");
  await inputs[2].type("tester@example.com");
  await sleep(200);
  await page.screenshot({ path: "/tmp/shot-builder3.png" });
  await clickByText(page, "button.primary", "Release");

  // Should land on the dossier for the new creature.
  await page.waitForSelector(".detail-name", { timeout: 8000 });
  await sleep(1500);
  const detailName = await page.$eval(".detail-name", (el) => el.textContent || "");
  const heroCanvasOk = await page.$eval(".detail-hero canvas", (c) => c.width > 50 && c.height > 50);
  const storyText = await page.$eval(".detail-story", (el) => el.textContent || "");
  await page.screenshot({ path: "/tmp/shot-dossier.png" });

  // Back to roster
  await clickByText(page, ".btn", "Back");
  await page.waitForSelector(".roster", { timeout: 5000 });
  await sleep(800);
  const cardText = await page.$$eval(".creature-card", (els) => els.map((e) => e.textContent || "").join(" | "));
  const feedCount = await page.$$eval(".roster-feed .mail-btn", (els) => els.length);
  const rosterCanvases = await page.$$eval(".creature-card canvas", (els) => els.length);
  await page.screenshot({ path: "/tmp/shot-roster.png" });

  // Toggle digest
  await clickByText(page, ".roster-head .btn", "on");

  console.log("dossier name:", JSON.stringify(detailName));
  console.log("hero portrait ok:", heroCanvasOk);
  console.log("story mentions Smokey:", storyText.includes("Smokey"));
  console.log("roster card has Smokey:", cardText.includes("Smokey"));
  console.log("roster portrait canvases:", rosterCanvases);
  console.log("feed entries:", feedCount);

  const ok =
    detailName.includes("Smokey") &&
    heroCanvasOk &&
    storyText.includes("Smokey") &&
    cardText.includes("Smokey") &&
    rosterCanvases >= 1 &&
    feedCount >= 1 &&
    errors.length === 0;

  if (errors.length) {
    console.log("\n--- errors ---");
    errors.forEach((e) => console.log(e));
  }
  console.log("\nSMOKE RESULT:", ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("threw:", err.message);
  errors.forEach((e) => console.log(e));
  await browser.close();
  process.exit(1);
}
