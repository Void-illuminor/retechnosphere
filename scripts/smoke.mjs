// Runtime smoke test: drive the built app in a headless browser, exercise the
// intro -> builder -> world flow, and fail on any console/page errors.
import puppeteer from "puppeteer";

const URL = process.env.SMOKE_URL || "http://localhost:4173/";

const errors = [];

async function clickByText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent, h);
    if (t && t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      errors.push(`http ${res.status()}: ${res.url()}`);
    }
  });

  await page.goto(URL, { waitUntil: "networkidle0" });

  // Intro -> Enter
  await page.waitForSelector("button.primary");
  if (!(await clickByText(page, "button.primary", "Enter"))) throw new Error("Enter button not found");

  // Builder overlay should appear.
  await page.waitForSelector(".builder", { timeout: 5000 });
  await sleep(600);
  await page.screenshot({ path: "/tmp/shot-builder.png" });

  // Choose carnivore, then release.
  await clickByText(page, ".diet-opt", "Prowler");
  await sleep(300);
  if (!(await clickByText(page, "button.primary", "Release"))) throw new Error("Release button not found");

  // World view should now be live.
  await page.waitForSelector("canvas.field", { timeout: 5000 });
  await page.waitForSelector(".hud", { timeout: 5000 });

  // Let the simulation run.
  await sleep(3500);

  const hudText = await page.$eval(".hud", (el) => el.textContent || "");
  const simTime = await page.$eval(".hud", (el) => {
    const rows = [...el.querySelectorAll(".row")];
    const r = rows.find((x) => (x.textContent || "").includes("Sim time"));
    return r ? r.querySelector(".v")?.textContent : null;
  });
  const canvasOk = await page.$eval("canvas.field", (c) => c.width > 100 && c.height > 100);
  const inboxText = await page.$eval(".inbox", (el) => el.textContent || "");

  await page.screenshot({ path: "/tmp/shot-world.png" });

  // Try a couple of controls.
  await clickByText(page, ".controls .btn", "🜺"); // spawn wild
  await sleep(800);

  console.log("HUD contains 'Grazers':", hudText.includes("Grazers"));
  console.log("Sim time readout:", JSON.stringify(simTime));
  console.log("Canvas sized OK:", canvasOk);
  console.log("Inbox rendered chars:", inboxText.length);

  const ok =
    hudText.includes("Grazers") &&
    canvasOk &&
    simTime &&
    simTime !== "0s" &&
    errors.length === 0;

  if (errors.length) {
    console.log("\n--- runtime errors ---");
    for (const e of errors) console.log(e);
  }
  console.log("\nSMOKE RESULT:", ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("Smoke test threw:", err.message);
  for (const e of errors) console.log(e);
  await browser.close();
  process.exit(1);
}
