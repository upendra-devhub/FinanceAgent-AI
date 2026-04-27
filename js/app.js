import { buildReferenceBaseline } from "./baselineEngine.js";
import {
    buildAutomatedInsightDigest,
    buildGroqSystemInstruction,
    requestGroqResponse,
    tryAnswerDirect
} from "./chatService.js";
import { parseExpenseCsv, parseUserExpenseCsv, parseUserExpenseRows } from "./csvParser.js";
import { formatCurrency } from "./formatters.js";
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
    renderDashboardVisuals,
    renderExpenseList,
    renderImportStatus,
    renderInsightCards,
    renderUploadPreview,
    renderUserCards,
    setLoadingState
} from "./uiRenderer.js";

const DEFAULT_CHAT_MESSAGE = "Hi! I am FinanceAgent AI. I use your profile and spending history to explain what is happening, why it matters, and what you should do next.";
const BUNDLED_DATASET_PATH = "./data/personal_expense_dataset.csv";

function getInitialView() {
    const hashView = window.location.hash.replace("#", "");
    return ["chat", "dashboard", "expenses", "insights", "settings"].includes(hashView) ? hashView : "chat";
}

const state = {
    manualExpenses: [],
    datasetRecords: [],
    conversation: [],
    baseline: null,
    userStats: null,
    comparisonInsights: null,
    lastInsightSignature: "",
    currentView: getInitialView(),
    pendingImport: null
};

const elements = {
    apiKey: document.getElementById("apiKey"),
    viewTitle: document.getElementById("viewTitle"),
    viewSubtitle: document.getElementById("viewSubtitle"),
    viewButtons: document.querySelectorAll("[data-view-target]"),
    navItems: document.querySelectorAll(".nav-item[data-view-target]"),
    appViews: document.querySelectorAll("[data-view]"),
    userCards: document.getElementById("userCards"),
    categoryComparison: document.getElementById("categoryComparison"),
    categoryDonut: document.getElementById("categoryDonut"),
    monthlyChart: document.getElementById("monthlyChart"),
    savingsProgress: document.getElementById("savingsProgress"),
    investmentAllocation: document.getElementById("investmentAllocation"),
    dashboardInsights: document.getElementById("dashboardInsights"),
    insightRailCards: document.getElementById("insightRailCards"),
    expenseList: document.getElementById("expenseList"),
    expenseFileInput: document.getElementById("expenseFileInput"),
    uploadZone: document.getElementById("uploadZone"),
    uploadPreview: document.getElementById("uploadPreview"),
    importStatus: document.getElementById("importStatus"),
    expenseModal: document.getElementById("expenseModal"),
    resetModal: document.getElementById("resetModal"),
    clearTransactionsModal: document.getElementById("clearTransactionsModal"),
    expDate: document.getElementById("expDate"),
    expCategory: document.getElementById("expCategory"),
    expVendor: document.getElementById("expVendor"),
    expDescription: document.getElementById("expDescription"),
    expAmount: document.getElementById("expAmount"),
    openExpenseModalBtn: document.getElementById("openExpenseModalBtn"),
    contextAddBtn: document.getElementById("contextAddBtn"),
    floatingExpenseBtn: document.getElementById("floatingExpenseBtn"),
    cancelExpenseBtn: document.getElementById("cancelExpenseBtn"),
    saveExpenseBtn: document.getElementById("saveExpenseBtn"),
    cancelResetBtn: document.getElementById("cancelResetBtn"),
    confirmResetBtn: document.getElementById("confirmResetBtn"),
    cancelClearTransactionsBtn: document.getElementById("cancelClearTransactionsBtn"),
    confirmClearTransactionsBtn: document.getElementById("confirmClearTransactionsBtn"),
    chatHistoryBox: document.getElementById("chatHistoryBox"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    loader: document.getElementById("loader"),
    clearAllBtn: document.getElementById("clearAllBtn")
};

const VIEW_TITLES = {
    chat: {
        title: "FinanceAgent AI",
        subtitle: "Premium AI Concierge"
    },
    dashboard: {
        title: "Financial Overview",
        subtitle: "Your wealth at a glance, updated just now."
    },
    expenses: {
        title: "FinanceAgent AI",
        subtitle: "Premium AI Concierge"
    },
    insights: {
        title: "Insights",
        subtitle: "See what needs attention, what is going well, and what to do next."
    },
    settings: {
        title: "Settings",
        subtitle: "Personalize the advisor and account context."
    }
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

function setActiveView(viewName) {
    state.currentView = VIEW_TITLES[viewName] ? viewName : "chat";
    document.body.dataset.view = state.currentView;
    if (window.location.hash.replace("#", "") !== state.currentView) {
        window.history.replaceState(null, "", `#${state.currentView}`);
    }
    elements.viewTitle.textContent = VIEW_TITLES[state.currentView].title;
    elements.viewSubtitle.textContent = VIEW_TITLES[state.currentView].subtitle;

    elements.navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.viewTarget === state.currentView);
    });

    elements.appViews.forEach((view) => {
        view.classList.toggle("active", view.dataset.view === state.currentView);
    });
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

    if (state.conversation.length === 0) {
        elements.chatHistoryBox.innerHTML = "";
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
    renderCategoryComparison(elements.categoryComparison, state.comparisonInsights.categoryComparisons, state.comparisonInsights, state.baseline);
    renderExpenseList(elements.expenseList, state.manualExpenses);
    renderInsightCards(elements.insightRailCards, state.comparisonInsights, 1);
    renderDashboardVisuals({
        categoryDonut: elements.categoryDonut,
        monthlyChart: elements.monthlyChart,
        savingsProgress: elements.savingsProgress,
        investmentAllocation: elements.investmentAllocation,
        dashboardInsights: elements.dashboardInsights
    }, state.userStats, state.comparisonInsights);

    const categories = [
        ...state.baseline.categories.list.map((item) => item.name),
        ...state.userStats.categories.list.map((item) => item.name),
        "Other"
    ];
    populateCategoryOptions(elements.expCategory, categories);
    if (document.getElementById("taxEstimate")) {
        const taxEstimate = Math.max((state.userStats.comparisons.currentSpend || 0) * 0.08, 0);
        document.getElementById("taxEstimate").textContent = formatCurrency(taxEstimate);
    }

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

function openResetModal() {
    elements.resetModal.classList.add("open");
    elements.resetModal.setAttribute("aria-hidden", "false");
}

function closeResetModal() {
    elements.resetModal.classList.remove("open");
    elements.resetModal.setAttribute("aria-hidden", "true");
}

function openClearTransactionsModal() {
    elements.clearTransactionsModal.classList.add("open");
    elements.clearTransactionsModal.setAttribute("aria-hidden", "false");
}

function closeClearTransactionsModal() {
    elements.clearTransactionsModal.classList.remove("open");
    elements.clearTransactionsModal.setAttribute("aria-hidden", "true");
}

function setImportStatus(message = "", tone = "neutral") {
    renderImportStatus(elements.importStatus, message ? { message, tone } : null);
}

function createExpenseKey(expense) {
    return [
        String(expense.date || "").trim(),
        String(expense.category || "").trim().toLowerCase(),
        Number(expense.amount || 0).toFixed(2),
        String(expense.transactionType || "expense").trim().toLowerCase()
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
            description: record.description || "",
            transactionType: record.transactionType || "expense",
            source: record.source || "user"
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
        amount,
        transactionType: "expense"
    };

    state.manualExpenses.push(expense);
    saveExpenses(state.manualExpenses);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
    closeExpenseModal();
}

function handleExpenseListClick(event) {
    const action = event.target.getAttribute("data-expense-action");
    if (action === "clear-all") {
        openClearTransactionsModal();
        return;
    }

    const deleteId = event.target.getAttribute("data-delete-expense");
    if (!deleteId) {
        return;
    }

    state.manualExpenses = state.manualExpenses.filter((expense) => String(expense.id) !== deleteId);
    saveExpenses(state.manualExpenses);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
}

function clearAllTransactions() {
    state.manualExpenses = [];
    saveExpenses(state.manualExpenses);
    state.pendingImport = null;
    renderUploadPreview(elements.uploadPreview, null);
    setImportStatus("All transactions were cleared.", "success");
    closeClearTransactionsModal();
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
    appendAssistantMessage("All transactions were removed. Upload a CSV or add expenses to start again.");
    setActiveView("expenses");
}

async function handleExpenseFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const parsed = await parseExpenseImportFile(file);
    if (parsed.issues.length) {
        setImportStatus(parsed.issues.join(" "), "error");
        appendAssistantMessage(parsed.issues.join(" "));
        renderUploadPreview(elements.uploadPreview, parsed);
        event.target.value = "";
        return;
    }

    state.pendingImport = {
        fileName: file.name,
        parsed
    };
    const invalidRowCount = parsed.metadata?.invalidRowCount || 0;
    renderUploadPreview(elements.uploadPreview, parsed);
    setImportStatus(
        `Ready to import ${parsed.records.length} transactions${invalidRowCount ? `. ${invalidRowCount} invalid rows were skipped during parsing.` : "."}`,
        "neutral"
    );
    setActiveView("expenses");
    appendAssistantMessage(`I parsed ${parsed.records.length} transactions from ${file.name}.${invalidRowCount ? ` ${invalidRowCount} invalid rows were skipped.` : ""} Review the preview, then confirm the import.`);
    event.target.value = "";
}

function confirmPendingImport() {
    if (!state.pendingImport?.parsed?.records?.length) {
        return;
    }

    const { fileName, parsed } = state.pendingImport;
    const { imported, duplicateCount } = mergeImportedExpenses(parsed.records);
    if (!imported.length) {
        setImportStatus("No new transactions were added because every parsed row already exists in your data.", "warning");
        appendAssistantMessage("I could not add any new expenses from that file because every row was already present or invalid.");
        state.pendingImport = null;
        renderUploadPreview(elements.uploadPreview, null);
        return;
    }

    state.manualExpenses.push(...imported);
    saveExpenses(state.manualExpenses);
    state.pendingImport = null;
    renderUploadPreview(elements.uploadPreview, null);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });
    setImportStatus(
        `${imported.length} transactions added${duplicateCount ? `. ${duplicateCount} duplicate rows skipped.` : "."}`,
        "success"
    );
    appendAssistantMessage(`Imported ${imported.length} transactions from ${fileName}.${duplicateCount ? ` Skipped ${duplicateCount} duplicate rows.` : ""}`);
    setActiveView("dashboard");
}

function cancelPendingImport() {
    state.pendingImport = null;
    renderUploadPreview(elements.uploadPreview, null);
    setImportStatus("", "neutral");
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
        appendAssistantMessage("I can answer many direct finance questions from the analysis layer already, but this one needs an AI API for a richer explanation. Add your Groq API key from the profile menu to unlock that path.");
        return;
    }

    setLoadingState(elements.loader, elements.sendBtn, true);
    try {
        const systemInstruction = buildGroqSystemInstruction({
            baseline: state.baseline,
            userStats: state.userStats
        }, state.comparisonInsights);
        const responseText = await requestGroqResponse({
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

function handleQuickAction(action) {
    if (action === "upload") {
        setActiveView("expenses");
        elements.expenseFileInput.click();
        return;
    }

    const prompts = {
        analyze: "Analyze my spending and show the top things I should focus on.",
        budget: "Create a practical monthly budget from my profile and my usual spending pattern."
    };

    if (!prompts[action]) {
        return;
    }

    elements.chatInput.value = prompts[action];
    setActiveView("chat");
    sendMessage();
}

function clearAllData() {
    clearAllStoredData();
    state.manualExpenses = [];
    state.conversation = [];
    state.lastInsightSignature = "";
    state.userStats = null;
    state.comparisonInsights = null;

    elements.apiKey.value = "";
    elements.expenseFileInput.value = "";
    state.pendingImport = null;
    setImportStatus("", "neutral");
    renderUploadPreview(elements.uploadPreview, null);
    closeExpenseModal();
    closeResetModal();
    closeClearTransactionsModal();
    renderChatHistory(elements.chatHistoryBox, state.conversation, DEFAULT_CHAT_MESSAGE);
    rebuildAnalysis({ publishInsights: false });
    setActiveView("chat");
}

function bindEvents() {
    setActiveView(state.currentView);

    elements.viewButtons.forEach((item) => {
        item.addEventListener("click", () => setActiveView(item.dataset.viewTarget));
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeExpenseModal();
            closeResetModal();
            closeClearTransactionsModal();
            cancelPendingImport();
        }
    });

    elements.apiKey.addEventListener("input", (event) => saveApiKey(event.target.value));
    elements.openExpenseModalBtn.addEventListener("click", openExpenseModal);
    elements.contextAddBtn.addEventListener("click", openExpenseModal);
    elements.floatingExpenseBtn.addEventListener("click", openExpenseModal);
    elements.cancelExpenseBtn.addEventListener("click", closeExpenseModal);
    elements.saveExpenseBtn.addEventListener("click", handleSaveExpense);
    elements.expenseModal.addEventListener("click", (event) => {
        if (event.target === elements.expenseModal) {
            closeExpenseModal();
        }
    });
    elements.resetModal.addEventListener("click", (event) => {
        if (event.target === elements.resetModal) {
            closeResetModal();
        }
    });
    elements.clearTransactionsModal.addEventListener("click", (event) => {
        if (event.target === elements.clearTransactionsModal) {
            closeClearTransactionsModal();
        }
    });
    elements.expenseList.addEventListener("click", handleExpenseListClick);
    elements.expenseFileInput.addEventListener("change", handleExpenseFileImport);
    elements.uploadPreview.addEventListener("click", (event) => {
        if (event.target.id === "confirmImportBtn") {
            confirmPendingImport();
        }

        if (event.target.id === "cancelImportBtn") {
            cancelPendingImport();
        }
    });
    elements.uploadZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        elements.uploadZone.classList.add("dragging");
    });
    elements.uploadZone.addEventListener("dragleave", () => {
        elements.uploadZone.classList.remove("dragging");
    });
    elements.uploadZone.addEventListener("drop", async (event) => {
        event.preventDefault();
        elements.uploadZone.classList.remove("dragging");
        const file = event.dataTransfer.files?.[0];
        if (!file) {
            return;
        }

        await handleExpenseFileImport({ target: { files: [file], value: "" } });
    });
    elements.sendBtn.addEventListener("click", sendMessage);
    elements.chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
    document.querySelectorAll("[data-quick-action]").forEach((button) => {
        button.addEventListener("click", () => handleQuickAction(button.dataset.quickAction));
    });
    elements.categoryComparison.addEventListener("click", (event) => {
        const action = event.target.getAttribute("data-insight-action");
        const aiQuery = event.target.getAttribute("data-ai-query");
        if (action === "view-transactions") {
            setActiveView("expenses");
        }
        if (action === "open-expenses") {
            setActiveView("expenses");
            elements.expenseFileInput.click();
        }
        if (action === "ask-ai-why") {
            setActiveView("chat");
            elements.chatInput.value = aiQuery || "Why should I pay attention to my spending right now?";
            elements.chatInput.focus();
        }
    });
    elements.insightRailCards.addEventListener("click", (event) => {
        const action = event.target.getAttribute("data-insight-action");
        if (action === "view-transactions") {
            setActiveView("expenses");
        }
        if (action === "open-expenses") {
            setActiveView("expenses");
            elements.expenseFileInput.click();
        }
    });
    elements.clearAllBtn.addEventListener("click", openResetModal);
    elements.cancelResetBtn.addEventListener("click", closeResetModal);
    elements.confirmResetBtn.addEventListener("click", clearAllData);
    elements.cancelClearTransactionsBtn.addEventListener("click", closeClearTransactionsModal);
    elements.confirmClearTransactionsBtn.addEventListener("click", clearAllTransactions);
    window.addEventListener("focus", () => rebuildAnalysis({ publishInsights: true }));
    window.addEventListener("hashchange", () => setActiveView(getInitialView()));
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
