const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// ─── Seletores ────────────────────────────────────────────────────────────────

const SEND_SELS = [
  "button.send-button[aria-label='Send message']",
  "button.send-button[aria-label='Enviar mensagem']",
  "button.send-button",
  "button[aria-label='Send message']",
  "button[aria-label='Enviar mensagem']",
];

const RESPONSE_SELS = [
  "model-response div.markdown",
  "structured-content-container div.markdown",
  "message-content div.markdown",
  "model-response p",
  "message-content p",
];

const RETRY_CONFIG = {
  maxAttempts: 5,
  delayMs: 3000,
  backoffFactor: 1.5,
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

const SCREENSHOT_DIR = path.join(__dirname, "debug_screenshots");

function saveScreenshot(page, name) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);
    const file = path.join(SCREENSHOT_DIR, `${name}_${Date.now()}.png`);
    return page.screenshot({ path: file, fullPage: true }).catch(() => {});
  } catch (_) {}
}

async function waitForSel(page, sels, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of sels) {
      try {
        const el = await page.$(sel);
        if (el) {
          const visible = await page.evaluate(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }, el);
          if (visible) return { sel, el };
        }
      } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Nenhum seletor encontrado");
}

function calcDelay(attempt) {
  const exp    = RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffFactor, attempt);
  const jitter = Math.random() * 1000;
  return Math.floor(exp + jitter);
}

function isFatalError(err) {
  return err.message?.includes("Gemini exige login");
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function askGeminiOnce(prompt) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--window-size=1280,900",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.setRequestInterception(true);
  page.on("request", req =>
    ["image", "media"].includes(req.resourceType()) ? req.abort() : req.continue()
  );

  try {
    await page.goto("https://gemini.google.com/app", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    if (page.url().includes("accounts.google.com") || page.url().includes("signin")) {
      await saveScreenshot(page, "login_required");
      throw new Error("Gemini exige login. Faça login manual uma vez usando headless:false e salve os cookies.");
    }

    // 1. Aguardar editor
    await page.waitForSelector(".ql-editor", { timeout: 30000 });
    await page.click(".ql-editor");
    await new Promise(r => setTimeout(r, 500));

    // 2. Limpar campo via teclado (sem innerHTML — Trusted Types bloqueia)
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Delete");
    await new Promise(r => setTimeout(r, 300));

    // 3. Inserir texto via execCommand (único método confirmado funcional)
    await page.evaluate((text) => {
      const el = document.querySelector(".ql-editor");
      if (!el) return;
      el.focus();
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    }, prompt);
    await new Promise(r => setTimeout(r, 800));

    // 4. Verificar inserção
    const fieldContent = await page.evaluate(() =>
      document.querySelector(".ql-editor")?.innerText?.trim() || ""
    );
    if (!fieldContent || fieldContent.length < 3) {
      throw new Error("Campo vazio após inserção — execCommand falhou");
    }
    console.log(`[gemini] texto inserido (${fieldContent.length} chars)`);

    // 5. Aguardar botão habilitar
    await page.waitForFunction(
      () => {
        const btn =
          document.querySelector("button.send-button[aria-label='Send message']") ||
          document.querySelector("button.send-button[aria-label='Enviar mensagem']") ||
          document.querySelector("button.send-button");
        return btn && btn.getAttribute("aria-disabled") !== "true" && !btn.disabled;
      },
      { timeout: 10000 }
    ).catch(() => console.log("[gemini] timeout aguardando botão — tentando mesmo assim"));

    await new Promise(r => setTimeout(r, 400));

    // 6. Enviar — garantir foco no editor e usar Enter (mais confiável que clicar botão)
    await page.click(".ql-editor");
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.press("Enter");
    console.log("[gemini] mensagem enviada via Enter");

    await new Promise(r => setTimeout(r, 2000));

    // 7. Aguardar resposta aparecer
    let respSel;
    try {
      const result = await waitForSel(page, RESPONSE_SELS, 60000);
      respSel = result.sel;
      console.log(`[gemini] resposta detectada via: ${respSel}`);
    } catch (e) {
      await saveScreenshot(page, "no_response");
      throw new Error("Resposta não encontrada após 60s");
    }

    // 8. Aguardar streaming terminar (texto estabilizar)
    let lastText = "";
    let stableCount = 0;

    while (stableCount < 6) {
      await new Promise(r => setTimeout(r, 1000));

      const currentText = await page.evaluate((sel) => {
        const els = document.querySelectorAll(sel);
        if (!els.length) return "";
        return els[els.length - 1]?.innerText?.trim() || "";
      }, respSel);

      if (currentText && currentText === lastText) {
        stableCount++;
      } else {
        stableCount = 0;
        lastText = currentText;
      }
    }

    await browser.close();

    if (!lastText) throw new Error("Resposta vazia após streaming");
    console.log(`[gemini] ✓ resposta obtida (${lastText.length} chars)`);
    return lastText;

  } catch (e) {
    await saveScreenshot(page, "error").catch(() => {});
    await browser.close();
    throw e;
  }
}

// ─── Retry ────────────────────────────────────────────────────────────────────

async function askGemini(prompt) {
  let lastError;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = calcDelay(attempt);
      console.log(`[gemini] tentativa ${attempt + 1}/${RETRY_CONFIG.maxAttempts} em ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const result = await askGeminiOnce(prompt);
      if (attempt > 0) console.log(`[gemini] sucesso na tentativa ${attempt + 1}`);
      return result;
    } catch (err) {
      lastError = err;
      if (isFatalError(err)) {
        console.error(`[gemini] erro fatal, abortando: ${err.message}`);
        throw err;
      }
      console.warn(`[gemini] tentativa ${attempt + 1} falhou: ${err.message}`);
    }
  }

  throw new Error(`[gemini] todas as ${RETRY_CONFIG.maxAttempts} tentativas falharam. Último erro: ${lastError?.message}`);
}

module.exports = { askGemini };