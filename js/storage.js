import {
    buildMonthContext,
    buildMonthContextFromArchiveKey,
    buildMonthContextFromDate,
    buildMonthContextFromMonthKey,
    getCurrentMonthContext,
    normalizeExpenseRecord
} from "./monthlyManager.js";

const KEYS = {
    apiKey: "fin_apiKey",
    income: "fin_bpIncome",
    goal: "fin_bpGoal",
    savings: "fin_bpSavings",
    mandatory: "fin_bpMandatory",
    activeMonth: "fin_activeMonth",
    activeYear: "fin_activeYear",
    expenses: "fin_expenses",
    chat: "fin_chat",
    lastInsightSignature: "fin_lastInsightSignature",
    uploadedCsv: "fin_uploadedCsv",
    uploadedCsvName: "fin_uploadedCsvName",
    completedMonths: "fin_completedMonths"
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

function normalizeExpenseList(expenses) {
    if (!Array.isArray(expenses)) {
        return [];
    }

    return expenses.map((expense) => normalizeExpenseRecord(expense));
}

function inferLatestExpenseContext(expenses) {
    const datedExpenses = normalizeExpenseList(expenses)
        .filter((expense) => expense.date)
        .sort((left, right) => String(right.date).localeCompare(String(left.date)));

    return buildMonthContextFromDate(datedExpenses[0]?.date) || null;
}

function normalizeCompletedMonths(rawCompletedMonths = {}) {
    const normalized = {};

    Object.entries(rawCompletedMonths || {}).forEach(([rawKey, rawValue]) => {
        const context = buildMonthContextFromArchiveKey(rawKey) || buildMonthContextFromMonthKey(rawKey);
        if (!context) {
            return;
        }

        const archivedExpenses = Array.isArray(rawValue)
            ? rawValue
            : Array.isArray(rawValue?.expenses)
                ? rawValue.expenses
                : [];

        normalized[context.archiveKey] = normalizeExpenseList(archivedExpenses);
    });

    return normalized;
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

export function getActiveMonthSelection(expenses = []) {
    const storedMonth = localStorage.getItem(KEYS.activeMonth);
    const storedYear = Number.parseInt(localStorage.getItem(KEYS.activeYear) || "", 10);

    if (storedMonth && Number.isInteger(storedYear)) {
        return buildMonthContext(storedMonth, storedYear);
    }

    const fallbackContext = inferLatestExpenseContext(expenses) || getCurrentMonthContext();
    saveActiveMonth(fallbackContext.month, fallbackContext.year);
    return fallbackContext;
}

export function saveActiveMonth(month, year) {
    const context = buildMonthContext(month, year);
    localStorage.setItem(KEYS.activeMonth, context.month);
    localStorage.setItem(KEYS.activeYear, String(context.year));
}

export function getExpenses() {
    return normalizeExpenseList(readJson(KEYS.expenses, []));
}

export function saveExpenses(expenses) {
    localStorage.setItem(KEYS.expenses, JSON.stringify(normalizeExpenseList(expenses)));
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

export function getCompletedMonths() {
    return normalizeCompletedMonths(readJson(KEYS.completedMonths, {}));
}

export function getCompletedMonthExpenses(month, year) {
    const context = buildMonthContext(month, year);
    const completedMonths = getCompletedMonths();
    return completedMonths[context.archiveKey] || [];
}

export function saveCompletedMonth(month, year, expenses) {
    const context = buildMonthContext(month, year);
    const completedMonths = getCompletedMonths();
    completedMonths[context.archiveKey] = normalizeExpenseList(expenses);
    localStorage.setItem(KEYS.completedMonths, JSON.stringify(completedMonths));
}

export function clearAllStoredData() {
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch (error) {
        console.warn("Could not clear browser storage completely.", error);
        Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    }
}
