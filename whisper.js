const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs   = require("fs");

const execFileAsync = promisify(execFile);

// ─── Configuração ─────────────────────────────────────────────────────────────

const WHISPER_BIN   = process.env.WHISPER_BIN   || "/home/admin/whisper.cpp/build/bin/whisper-cli";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "/home/admin/whisper.cpp/models/ggml-small-q5_1.bin";
const WHISPER_THREADS = process.env.WHISPER_THREADS || "2";

// ─── Utilitários ──────────────────────────────────────────────────────────────

function estimateWavDurationMs(audioPath) {
  try {
    const bytes    = fs.statSync(audioPath).size;
    const byteRate = 16000 * 1 * 2;
    const secs     = Math.max(5, (bytes - 44) / byteRate);
    return Math.ceil(secs) * 1000;
  } catch {
    return 30_000;
  }
}

// ─── Converte qualquer áudio para WAV 16kHz mono 16bit (exigido pelo whisper.cpp) ──

async function toWav16k(inputPath) {
  const out = inputPath.replace(/\.[^.]+$/, `_16k_${Date.now()}.wav`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    out,
  ], { timeout: 60_000 });
  return out;
}

// ─── Fila simples (concorrência = 1) ─────────────────────────────────────────

class TranscriptionQueue {
  constructor({ concurrency = 1 } = {}) {
    this.concurrency = concurrency;
    this._running    = 0;
    this._queue      = [];
  }

  enqueue(audioPath) {
    return new Promise((resolve, reject) => {
      this._queue.push({ audioPath, resolve, reject });
      this._tick();
    });
  }

  _tick() {
    while (this._running < this.concurrency && this._queue.length > 0) {
      const job = this._queue.shift();
      this._running++;
      this._run(job).finally(() => {
        this._running--;
        this._tick();
      });
    }
  }

  async _run({ audioPath, resolve, reject }) {
    const audioDurationMs = estimateWavDurationMs(audioPath);
    // timeout = duração estimada × 10 + 30s de margem (CPU é mais lento que tempo real)
    const timeoutMs = audioDurationMs * 10 + 30_000;

    let converted = null;

    try {
      console.log(`[Whisper] Iniciando transcrição — ${path.basename(audioPath)}`);

      // Converte para formato aceito pelo whisper.cpp
      converted = await toWav16k(audioPath);
      console.log(`[Whisper] Áudio convertido → ${path.basename(converted)}`);

      const { stdout, stderr } = await execFileAsync(WHISPER_BIN, [
        "-m", WHISPER_MODEL,
        "-f", converted,
        "-l", "pt",
        "--no-timestamps",
        "-t", WHISPER_THREADS,
      ], {
        timeout:   timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      // whisper.cpp escreve progresso no stderr e resultado no stdout
      if (stderr) {
        const errs = stderr.split("\n").filter(l => l.includes("error") || l.includes("failed"));
        if (errs.length) console.warn(`[Whisper] stderr:`, errs.join(" | "));
      }

      const text = stdout
        .split("\n")
        .map(l => l.replace(/^\[.*?\]\s*/, "").trim()) // remove timestamps residuais
        .filter(Boolean)
        .join(" ");

      if (!text) throw new Error("Transcrição vazia — stdout sem conteúdo");

      console.log(`[Whisper] ✓ Sucesso (${text.length} chars)`);
      resolve(text);

    } catch (err) {
      console.error(`[Whisper] ✗ Erro: ${err.message}`);
      reject(err);
    } finally {
      // Remove o arquivo temporário convertido
      if (converted) fs.unlink(converted, () => {});
    }
  }
}

// ─── Instância global ─────────────────────────────────────────────────────────

const queue = new TranscriptionQueue({ concurrency: 1 });

/**
 * API pública — mesma assinatura da versão anterior com Puppeteer.
 * @param {string} audioPath  Caminho para o arquivo de áudio (.wav, .mp3, etc).
 * @returns {Promise<string>} Texto transcrito.
 */
async function transcribeWithWhisperWeb(audioPath) {
  return queue.enqueue(audioPath);
}

module.exports = { transcribeWithWhisperWeb };