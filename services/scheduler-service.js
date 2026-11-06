import { config } from "../config/environment.js";
import { sendPaymentReminders } from "../handlers/agent-router.js";
import { getUsersWithPhone } from "./database-service.js";

let scheduledTimeout;
const RETRY_DELAY_MS = 5 * 60 * 1000;

function getNextRunDelay() {
  const [hours, minutes] = String(config.PAYMENT_REMINDER_TIME).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("PAYMENT_REMINDER_TIME deve estar no formato HH:mm");
  }

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.PAYMENT_REMINDER_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  const target = new Date(now);
  target.setHours(now.getHours() + (hours - Number(parts.hour)), now.getMinutes() + (minutes - Number(parts.minute)), -Number(parts.second));
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(target.getTime() - now.getTime(), 1000);
}

async function runPaymentReminders() {
  console.log(`🔔 [SCHEDULER] Iniciando verificação diária de lembretes`);
  let failed = false;
  let recipients;
  try {
    recipients = await getRecipients();
  } catch (error) {
    console.error("❌ [SCHEDULER] Falha ao buscar usuários para lembretes:", error.message);
    scheduleNextRun(RETRY_DELAY_MS);
    return;
  }

  for (const phone of recipients) {
    try {
      await sendPaymentReminders(phone);
    } catch (error) {
      failed = true;
      console.error(`❌ [SCHEDULER] Falha no lembrete para ${phone}:`, error.message);
    }
  }
  console.log(`✅ [SCHEDULER] Verificação concluída${failed ? " com falhas; nova tentativa em 5 minutos" : ""}`);
  scheduleNextRun(failed ? RETRY_DELAY_MS : undefined);
}

async function getRecipients() {
  if (config.PAYMENT_REMINDER_RECIPIENTS.length > 0) {
    return config.PAYMENT_REMINDER_RECIPIENTS;
  }
  const recipients = await getUsersWithPhone();
  console.log(`👥 [SCHEDULER] Usuários com telefone encontrados: ${recipients.length}`);
  return recipients;
}

function scheduleNextRun(delayOverride) {
  const delay = delayOverride || getNextRunDelay();
  scheduledTimeout = setTimeout(() => {
    scheduledTimeout = undefined;
    runPaymentReminders().catch((error) => {
      console.error("❌ [SCHEDULER] Falha inesperada:", error.message);
      scheduleNextRun(RETRY_DELAY_MS);
    });
  }, delay);
  const nextRun = new Date(Date.now() + delay);
  console.log(`⏰ [SCHEDULER] Próximo lembrete: ${nextRun.toLocaleString("pt-BR", {
    timeZone: config.PAYMENT_REMINDER_TIMEZONE,
  })}`);
}

export function startScheduler() {
  if (scheduledTimeout) return;
  console.log(`⏰ [SCHEDULER] Lembretes de contas configurados para ${config.PAYMENT_REMINDER_TIME} (${config.PAYMENT_REMINDER_TIMEZONE})`);
  console.log(config.PAYMENT_REMINDER_RECIPIENTS.length > 0
    ? `📱 [SCHEDULER] Destinatários configurados: ${config.PAYMENT_REMINDER_RECIPIENTS.join(", ")}`
    : "📱 [SCHEDULER] Destinatários: usuários cadastrados na API");
  scheduleNextRun();
}
