const KEYS = {
    apiKey: "fin_apiKey",
    income: "fin_bpIncome",
    goal: "fin_bpGoal",
    savings: "fin_bpSavings",
    mandatory: "fin_bpMandatory",
    expenses: "fin_expenses",
    chat: "fin_chat",
    lastInsightSignature: "fin_lastInsightSignature",
    uploadedCsv: "fin_uploadedCsv",
    uploadedCsvName: "fin_uploadedCsvName"
};

function readJson(key, fallback) {
    const raw = localStorage.getItem(key);

    if (!raw) {
        return fallback;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`Could not parse localStorage key "${key}"`, error);
        return fallback;
    }
}

export function getApiKey() {
    return localStorage.getItem(KEYS.apiKey) || "";
}

export function saveApiKey(value) {
    localStorage.setItem(KEYS.apiKey, value);
}

export function getProfile() {
    return {
        income: localStorage.getItem(KEYS.income) || "",
        goal: localStorage.getItem(KEYS.goal) || "",
        savings: localStorage.getItem(KEYS.savings) || "",
        mandatory: localStorage.getItem(KEYS.mandatory) || ""
    };
}

export function saveProfileField(field, value) {
    const key = KEYS[field];

    if (!key) {
        return;
    }

    localStorage.setItem(key, value);
}

export function getExpenses() {
    return readJson(KEYS.expenses, []);
}

export function saveExpenses(expenses) {
    localStorage.setItem(KEYS.expenses, JSON.stringify(expenses));
}

export function getConversation() {
    return readJson(KEYS.chat, []);
}

export function saveConversation(conversation) {
    localStorage.setItem(KEYS.chat, JSON.stringify(conversation));
}

export function getLastInsightSignature() {
    return localStorage.getItem(KEYS.lastInsightSignature) || "";
}

export function saveLastInsightSignature(signature) {
    localStorage.setItem(KEYS.lastInsightSignature, signature);
}

export function getUploadedDataset() {
    return {
        rawCsv: localStorage.getItem(KEYS.uploadedCsv) || "",
        fileName: localStorage.getItem(KEYS.uploadedCsvName) || ""
    };
}

export function saveUploadedDataset(rawCsv, fileName) {
    localStorage.setItem(KEYS.uploadedCsv, rawCsv);
    localStorage.setItem(KEYS.uploadedCsvName, fileName);
}

export function clearUploadedDataset() {
    localStorage.removeItem(KEYS.uploadedCsv);
    localStorage.removeItem(KEYS.uploadedCsvName);
}

export function clearAllStoredData() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
