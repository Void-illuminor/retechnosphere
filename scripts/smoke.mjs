// End-to-end smoke test for the shared-world build. Drives the real app against
// a running server: enter -> build a creature with an email -> release -> see it
// live -> read the field report -> toggle daily email. Fails on console errors.
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
  await page.setViewport({ width: 1280, height: 820 });
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
  await sleep(300);
  await page.screenshot({ path: "/tmp/shot-builder2.png" });
  await clickByText(page, "button.primary", "Release");

  // World should appear (builder overlay gone).
  await page.waitForFunction(() => !document.querySelector(".builder"), { timeout: 8000 });
  await page.waitForSelector("canvas.field");
  await page.waitForSelector(".hud");
  await sleep(4000); // let the world stream + inbox poll

  const state = await page.evaluate(async () => {
    const r = await fetch("/api/state");
    return r.json();
  });
  const token = await page.evaluate(() => localStorage.getItem("rts_token"));
  const me = await page.evaluate(async (t) => (await fetch("/api/me?token=" + t)).json(), token);

  const hudText = await page.$eval(".hud", (el) => el.textContent || "");
  const inboxText = await page.$eval(".inbox", (el) => el.textContent || "");
  const canvasOk = await page.$eval("canvas.field", (c) => c.width > 100 && c.height > 100);

  await page.screenshot({ path: "/tmp/shot-world2.png" });

  // Toggle daily email off then verify.
  const before = me.dailyDigest;
  await clickByText(page, ".inbox .btn", before ? "On" : "Off");
  await sleep(600);
  const me2 = await page.evaluate(async (t) => (await fetch("/api/me?token=" + t)).json(), token);

  console.log("creatures in shared state:", state.creatures.length);
  console.log("my lineages:", me.lineages.map((l) => l.founderName).join(",") || "(none)");
  console.log("inbox mentions Smokey:", inboxText.includes("Smokey"));
  console.log("HUD has Grazers:", hudText.includes("Grazers"));
  console.log("daily digest toggled:", before, "->", me2.dailyDigest);
  console.log("canvas ok:", canvasOk);

  const ok =
    state.creatures.length > 10 &&
    me.lineages.some((l) => l.founderName === "Smokey") &&
    inboxText.includes("Smokey") &&
    hudText.includes("Grazers") &&
    me2.dailyDigest !== before &&
    canvasOk &&
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
