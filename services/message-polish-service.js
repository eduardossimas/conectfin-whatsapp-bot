/**
 * Serviço de Polimento de Mensagens
 * 
 * Intercepta as mensagens geradas pelo bot, aplica reescrita do Groq
 * (menos robótico, vocabulário mais humano) e retorna a mensagem polida, de 1 a 3 blocos.
 */

import { polishedMessageForWhatsApp } from "./ai-service.js";
import { sendWhatsAppText } from "./whatsapp-service-unified.js";
import { sleep } from "../utils/helpers.js";
import { config } from "../config/environment.js";

/**
 * Verifica se a mensagem deve passar pelo polimento
 * Preview de confirmação e listas numeradas são protegidas
*/
function shouldPolish(text) {
    const lower = text.toLowerCase();

    //Preview de confirmação
    if (/confirma o lançamento|confirmar o lançamento|vou registrar|vou fazer o lançamento/i.test(lower)) return false;

    //Listas numeradas
    const temListaNumerada = /(?:\n|^)\s*\d+\.\s/.test(text);
    if (temListaNumerada && /responda com o n[uú]mero|n[úu]mero correspondente|qual deles voc[êe] quer/.test(lower)) return false;

    return true;
}

/**
 * Polia a mensagem e envia em blocos sequenciais
 * 
 * @param {string} to - Destinatário (JID ou número)
 * @param {string} text - Mensagem original
 * @returns {Promise<String>} - Texto completo enviado
*/

export async function polishAndSend(to, text) {
    if(!shouldPolish(text)) {
        await sendWhatsAppText(to, text);
        return text;
    }
    const blocks = await polishedMessageForWhatsApp(text);

    for (let i = 0; i < blocks.length; i++) {
        await sendWhatsAppText(to, blocks[i]);
        if(i < blocks.length - 1) {
            await sleep(config.MESSAGE_POLISH_BLOCK_DELAY_MS);
        }
    }
    return text;
}

export { shouldPolish };