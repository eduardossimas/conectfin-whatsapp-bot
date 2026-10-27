const customerStates = new Map();

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TZ || "America/Sao_Paulo",
  }).format(new Date());
}

export function getCustomerState(phone) {
  return customerStates.get(normalizePhone(phone)) || null;
}

export function shouldAskDailyChoice(phone) {
  const state = getCustomerState(phone);
  return !state || state.lastChoiceDate !== todayKey();
}

export function markChoicePending(phone) {
  const key = normalizePhone(phone);
  customerStates.set(key, {
    status: "awaiting_choice",
    lastChoiceDate: todayKey(),
  });
}

export function startSupport(phone) {
  const key = normalizePhone(phone);
  customerStates.set(key, {
    status: "support",
    lastChoiceDate: todayKey(),
  });
}

export function isWaitingForSupport(phone) {
  return getCustomerState(phone)?.status === "support";
}

export function endSupport(phone) {
  const key = normalizePhone(phone);
  customerStates.set(key, {
    status: "assistant",
    lastChoiceDate: todayKey(),
  });
}

export function startAssistant(phone) {
  const key = normalizePhone(phone);
  customerStates.set(key, {
    status: "assistant",
    lastChoiceDate: todayKey(),
  });
}

export function getSupportCustomerFromMessage(text = "") {
  const match = String(text).match(
    /encerrar\s+atendimento\s*['"`“”‘’]?\s*([+\d()\s-]+?)\s*['"`“”‘’]?\s*$/i
  );
  return match ? normalizePhone(match[1]) : null;
}
