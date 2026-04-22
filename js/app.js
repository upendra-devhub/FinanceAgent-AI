import { buildReferenceBaseline } from "./baselineEngine.js";
import {
    buildAutomatedInsightDigest,
    buildGeminiSystemInstruction,
    requestGeminiResponse,
    tryAnswerDirect
} from "./chatService.js";
import { parseExpenseCsv, parseUserExpenseCsv, parseUserExpenseRows } from "./csvParser.js";
import { getFinancialProfile } from "./profileManager.js";
import { generateComparisonInsights } from "./rulesEngine.js";
import {
    clearAllStoredData,
    getApiKey,
    getConversation,
    getExpenses,
    getLastInsightSignature,
    saveApiKey,
    saveConversation,
    saveExpenses,
    saveLastInsightSignature
} from "./storage.js";
import { buildUserStats } from "./userStats.js";
import {
    appendMessage,
    populateCategoryOptions,
    renderCategoryComparison,
    renderChatHistory,
    renderExpenseList,
    renderUserCards,
    setLoadingState
} from "./uiRenderer.js";

const DEFAULT_CHAT_MESSAGE = "Hi! I am FinanceAgent AI. I combine your financial profile, your expenses, and a hidden reference baseline so the advice is about what you can actually afford.";
const BUNDLED_DATASET_PATH = "./data/personal_expense_dataset.csv";

const state = {
    manualExpenses: [],
    datasetRecords: [],
    conversation: [],
    baseline: null,
    userStats: null,
    comparisonInsights: null,
    lastInsightSignature: ""
};

const elements = {
    apiKey: document.getElementById("apiKey"),
    profileMenuBtn: document.getElementById("profileMenuBtn"),
    profileDropdown: document.getElementById("profileDropdown"),
    userCards: document.getElementById("userCards"),
    categoryComparison: document.getElementById("categoryComparison"),
    expenseList: document.getElementById("expenseList"),
    expenseFileInput: document.getElementById("expenseFileInput"),
    expenseModal: document.getElementById("expenseModal"),
    expDate: document.getElementById("expDate"),
    expCategory: document.getElementById("expCategory"),
    expVendor: document.getElementById("expVendor"),
    expDescription: document.getElementById("expDescription"),
    expAmount: document.getElementById("expAmount"),
    openExpenseModalBtn: document.getElementById("openExpenseModalBtn"),
    cancelExpenseBtn: document.getElementById("cancelExpenseBtn"),
    saveExpenseBtn: document.getElementById("saveExpenseBtn"),
    chatHistoryBox: document.getElementById("chatHistoryBox"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    loader: document.getElementById("loader"),
    clearAllBtn: document.getElementById("clearAllBtn")
};

function persistConversation() {
    saveConversation(state.conversation);
}

function addConversationMessage(role, text) {
    state.conversation.push({ role, parts: [{ text }] });
    persistConversation();
}

function appendAssistantMessage(text) {
    appendMessage(elements.chatHistoryBox, "ai", text);
    addConversationMessage("model", text);
}

function currentProfileValues() {
    return getFinancialProfile().values;
}

function publishAutomatedInsights(force = false) {
    if (!state.userStats?.metadata.hasRecords) {
        return;
    }

    const digest = buildAutomatedInsightDigest({
        baseline: state.baseline,
        userStats: state.userStats
    }, state.comparisonInsights);

    if (!digest?.text) {
        return;
    }

    if (!force && digest.signature === state.lastInsightSignature) {
        return;
    }

    appendAssistantMessage(digest.text);
    state.lastInsightSignature = digest.signature;
    saveLastInsightSignature(digest.signature);
}

function rebuildAnalysis({ publishInsights = false, forceInsight = false } = {}) {
    state.baseline = buildReferenceBaseline(state.datasetRecords);
    state.userStats = buildUserStats({
        manualExpenses: state.manualExpenses,
        profile: currentProfileValues()
    });
    state.comparisonInsights = generateComparisonInsights({
        baseline: state.baseline,
        userStats: state.userStats
    });

    renderUserCards(elements.userCards, state.userStats, state.comparisonInsights);
    renderCategoryComparison(elements.categoryComparison, state.comparisonInsights.categoryComparisons);
    renderExpenseList(elements.expenseList, state.manualExpenses);

    const categories = [
        ...state.baseline.categories.list.map((item) => item.name),
        ...state.userStats.categories.list.map((item) => item.name),
        "Other"
    ];
    populateCategoryOptions(elements.expCategory, categories);

    if (publishInsights) {
        publishAutomatedInsights(forceInsight);
    }
}

function openExpenseModal() {
    elements.expenseModal.classList.add("open");
    elements.expenseModal.setAttribute("aria-hidden", "false");
}

function closeExpenseModal() {
    elements.expenseModal.classList.remove("open");
    elements.expenseModal.setAttribute("aria-hidden", "true");
    elements.expVendor.value = "";
    elements.expDescription.value = "";
    elements.expAmount.value = "";
}

function setProfileMenuOpen(isOpen) {
    elements.profileDropdown.classList.toggle("open", isOpen);
    elements.profileDropdown.setAttribute("aria-hidden", String(!isOpen));
    elements.profileMenuBtn.setAttribute("aria-expanded", String(isOpen));
}

function toggleProfileMenu(forceOpen) {
    const shouldOpen = typeof forceOpen === "boolean"
        ? forceOpen
        : !elements.profileDropdown.classList.contains("open");

    setProfileMenuOpen(shouldOpen);
}

function createExpenseKey(expense) {
    return [
        String(expense.date || "").trim(),
        String(expense.category || "").trim().toLowerCase(),
        Number(expense.amount || 0).toFixed(2)
    ].join("|");
}

function mergeImportedExpenses(records) {
    const existingKeys = new Set(state.manualExpenses.map(createExpenseKey));
    const imported = [];
    let duplicateCount = 0;

    records.forEach((record) => {
        const normalizedExpense = {
            id: Date.now() + imported.length + duplicateCount,
            date: record.date,
            category: record.category,
            amount: record.amount,
            vendor: record.vendor || "",
            description: record.description || ""
        };
        const key = createExpenseKey(normalizedExpense);

        if (existingKeys.has(key)) {
            duplicateCount += 1;
            return;
        }

        existingKeys.add(key);
        imported.push(normalizedExpense);
    });

    return {
        imported,
        duplicateCount
    };
}

async function parseExpenseImportFile(file) {
    const fileName = file.name || "expenses";
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith(".csv")) {
        const text = await file.text();
        return parseUserExpenseCsv(text, fileName);
    }

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        if (!window.XLSX) {
            return {
                records: [],
                issues: ["Excel support is not available right now. Please upload a CSV file or reload the page."]
            };
        }

        const buffer = await file.arrayBuffer();
        const workbook = window.XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];

        if (!firstSheet) {
            return {
                records: [],
                issues: ["The uploaded Excel file does not contain any sheets."]
            };
        }

        const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
        return parseUserExpenseRows(rows, fileName);
    }

    return {
        records: [],
        issues: ["Please upload a CSV or Excel expense file."]
    };
}

async function loadBundledDataset() {
    const response = await fetch(BUNDLED_DATASET_PATH);
    if (!response.ok) {
        throw new Error("Could not load the bundled dataset.");
    }

    const rawCsv = await response.text();
    const parsed = parseExpenseCsv(rawCsv, "personal_expense_dataset.csv");
    state.datasetRecords = parsed.records;
}

function handleSaveExpense() {
    const date = elements.expDate.value;
    const category = elements.expCategory.value;
    const vendor = elements.expVendor.value.trim();
    const description = elements.expDescription.value.trim();
    const amount = elements.expAmount.value.trim();

    if (!date || !category || !amount) {
        appendAssistantMessage("Please enter a date, category, and amount before saving the expense.");
        return;
    }

    const expense = {
        id: Date.now(),
        date,
        category,
        vendor,
        description,
        amount
    };

    state.manualExpenses.push(expense);
    saveExpenses(state.manualExpenses);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
    closeExpenseModal();
}

function handleExpenseListClick(event) {
    const deleteId = event.target.getAttribute("data-delete-expense");
    if (!deleteId) {
        return;
    }

    state.manualExpenses = state.manualExpenses.filter((expense) => String(expense.id) !== deleteId);
    saveExpenses(state.manualExpenses);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
}

async function handleExpenseFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const parsed = await parseExpenseImportFile(file);
    if (parsed.issues.length) {
        appendAssistantMessage(parsed.issues.join(" "));
        event.target.value = "";
        return;
    }

    const { imported, duplicateCount } = mergeImportedExpenses(parsed.records);
    if (!imported.length) {
        appendAssistantMessage("I could not add any new expenses from that file because every row was already present or invalid.");
        event.target.value = "";
        return;
    }

    state.manualExpenses.push(...imported);
    saveExpenses(state.manualExpenses);
    appendAssistantMessage(`Imported ${imported.length} expenses from ${file.name}.${duplicateCount ? ` Skipped ${duplicateCount} duplicate rows.` : ""}`);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
    event.target.value = "";
}

async function sendMessage() {
    const question = elements.chatInput.value.trim();
    if (!question) {
        return;
    }

    appendMessage(elements.chatHistoryBox, "user", question);
    addConversationMessage("user", question);
    elements.chatInput.value = "";

    const directAnswer = tryAnswerDirect(question, {
        baseline: state.baseline,
        userStats: state.userStats
    }, state.comparisonInsights);
    if (directAnswer) {
        appendAssistantMessage(directAnswer);
        return;
    }

    const apiKey = elements.apiKey.value.trim();
    if (!apiKey) {
        appendAssistantMessage("I can answer many direct finance questions from the analysis layer already, but this one needs Gemini for a richer explanation. Add your API key from the profile menu to unlock that path.");
        return;
    }

    setLoadingState(elements.loader, elements.sendBtn, true);
    try {
        const systemInstruction = buildGeminiSystemInstruction({
            baseline: state.baseline,
            userStats: state.userStats
        }, state.comparisonInsights);
        const responseText = await requestGeminiResponse({
            apiKey,
            systemInstruction,
            conversationHistory: state.conversation
        });

        appendAssistantMessage(responseText);
    } catch (error) {
        appendAssistantMessage(`Error: ${error.message}`);
    } finally {
        setLoadingState(elements.loader, elements.sendBtn, false);
        elements.chatInput.focus();
    }
}

function clearAllData() {
    const confirmed = window.confirm("Delete all saved expenses, chat history, financial profile values, API key, cached insights, and browser UI state?");
    if (!confirmed) {
        return;
    }

    clearAllStoredData();
    state.manualExpenses = [];
    state.conversation = [];
    state.lastInsightSignature = "";
    state.userStats = null;
    state.comparisonInsights = null;

    elements.apiKey.value = "";
    elements.expenseFileInput.value = "";
    closeExpenseModal();
    setProfileMenuOpen(false);
    renderChatHistory(elements.chatHistoryBox, state.conversation, DEFAULT_CHAT_MESSAGE);
    rebuildAnalysis({ publishInsights: false });
}

function bindEvents() {
    setProfileMenuOpen(false);

    elements.profileMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleProfileMenu();
    });
    elements.profileDropdown.addEventListener("click", (event) => event.stopPropagation());
    document.addEventListener("click", () => toggleProfileMenu(false));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            toggleProfileMenu(false);
        }
    });
    window.addEventListener("blur", () => toggleProfileMenu(false));

    elements.apiKey.addEventListener("input", (event) => saveApiKey(event.target.value));
    elements.openExpenseModalBtn.addEventListener("click", openExpenseModal);
    elements.cancelExpenseBtn.addEventListener("click", closeExpenseModal);
    elements.saveExpenseBtn.addEventListener("click", handleSaveExpense);
    elements.expenseModal.addEventListener("click", (event) => {
        if (event.target === elements.expenseModal) {
            closeExpenseModal();
        }
    });
    elements.expenseList.addEventListener("click", handleExpenseListClick);
    elements.expenseFileInput.addEventListener("change", handleExpenseFileImport);
    elements.sendBtn.addEventListener("click", sendMessage);
    elements.chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
    elements.clearAllBtn.addEventListener("click", clearAllData);
    window.addEventListener("focus", () => rebuildAnalysis({ publishInsights: true }));
}

async function init() {
    elements.apiKey.value = getApiKey();
    state.manualExpenses = getExpenses();
    state.conversation = getConversation();
    state.lastInsightSignature = getLastInsightSignature();
    renderChatHistory(elements.chatHistoryBox, state.conversation, DEFAULT_CHAT_MESSAGE);

    elements.expDate.value = new Date().toISOString().slice(0, 10);

    bindEvents();

    try {
        await loadBundledDataset();
        rebuildAnalysis({ publishInsights: true });
    } catch (error) {
        state.datasetRecords = [];
        rebuildAnalysis({ publishInsights: true, forceInsight: true });
        appendAssistantMessage(`Error: ${error.message}`);
    }
}

init();
