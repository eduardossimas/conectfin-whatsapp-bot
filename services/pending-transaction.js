/* 
Arquivo de serviço para gerenciar transações pendentes 
Antes de elas serem confirmadas pelo usuário
*/

const pendingMap = new Map();
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutos in milisegundos

//Função para definir uma transação como pendente
export function setPending(userID, params){
    pendingMap.set(userID, { params, timestamp: Date.now() });
}

//Getter de transações pendentes, que também verifica se a transação ainda é válida (não expirada)
export function getPending(userID){
    const entry = pendingMap.get(userID);

    if(!entry) return null;

    if(Date.now() - entry.timestamp > EXPIRY_MS){
        pendingMap.delete(userID);
        return null;
    }

    return entry.params;
}

// Função para limpar a transação pendente de um usuário
export function clearPending(userID){
    pendingMap.delete(userID);
}

/* 
Função para obter a transação pendente de um usuário e mesclar com parâmetros adicionais
Por exemplo, se o usuário colocou o valor/tipo errado, essa função vai ser usada para corrigir antes de lançar
*/ 
export function getPendingWithMerge(userID, overrideParams = {}){
    const pending = getPending(userID);

    if(!pending) return null;

    return { ...pending, ...overrideParams };
}