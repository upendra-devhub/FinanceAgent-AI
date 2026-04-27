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
import {
    MONTH_NAMES,
    buildMonthContext,
    buildMonthContextFromDate,
    calculateMonthCompletion,
    filterExpensesByMonth,
    formatCompletionSummary,
    getAvailableMonths,
    getCurrentMonthContext,
    getNextMonthContext,
    isExpenseInMonth,
    isMonthCompleted,
    normalizeExpenseRecord
} from "./monthlyManager.js";
import { generateComparisonInsights } from "./rulesEngine.js";
import {
    clearAllStoredData,
    getActiveMonthSelection,
    getApiKey,
    getCompletedMonthExpenses,
    getCompletedMonths,
    getConversation,
    getExpenses,
    getLastInsightSignature,
    getProfile,
    saveActiveMonth,
    saveApiKey,
    saveCompletedMonth,
    saveConversation,
    saveExpenses,
    saveLastInsightSignature,
    saveProfileField
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
    pendingImport: null,
    pendingMonthCompletion: null,
    activeMonthContext: getCurrentMonthContext()
};

const elements = {
    apiKey: document.getElementById("apiKey"),
    activeMonthSelect: document.getElementById("activeMonthSelect"),
    activeYearInput: document.getElementById("activeYearInput"),
    currentMonthIndicator: document.getElementById("currentMonthIndicator"),
    monthStateTitle: document.getElementById("monthStateTitle"),
    monthStateMessage: document.getElementById("monthStateMessage"),
    dashboardMonthBadge: document.getElementById("dashboardMonthBadge"),
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
    completeMonthModal: document.getElementById("completeMonthModal"),
    expenseMonth: document.getElementById("expenseMonth"),
    completeMonthBtn: document.getElementById("completeMonthBtn"),
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
    cancelCompleteMonthBtn: document.getElementById("cancelCompleteMonthBtn"),
    confirmCompleteMonthBtn: document.getElementById("confirmCompleteMonthBtn"),
    completeMonthTitle: document.getElementById("completeMonthTitle"),
    completeMonthSummary: document.getElementById("completeMonthSummary"),
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

function resetConversationState() {
    state.conversation = [];
    persistConversation();
    state.lastInsightSignature = "";
    saveLastInsightSignature("");
    renderChatHistory(elements.chatHistoryBox, state.conversation, DEFAULT_CHAT_MESSAGE);
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

function getActiveMonthExpenses() {
    return filterExpensesByMonth(state.manualExpenses, state.activeMonthContext);
}

function getArchivedActiveMonthExpenses() {
    return getCompletedMonthExpenses(state.activeMonthContext.month, state.activeMonthContext.year);
}

function getAnalysisExpensesForActiveMonth() {
    const archivedExpenses = getArchivedActiveMonthExpenses();
    if (archivedExpenses.length) {
        return archivedExpenses;
    }

    return getActiveMonthExpenses();
}

function isActiveMonthClosed() {
    return isMonthCompleted(getCompletedMonths(), state.activeMonthContext);
}

function buildMonthEmptyMessage() {
    const analysisExpenses = getAnalysisExpensesForActiveMonth();

    if (isActiveMonthClosed() && !analysisExpenses.length) {
        return "No archived transactions were found for this closed month.";
    }

    return `No expenses logged for ${state.activeMonthContext.label}`;
}

function syncMonthControls() {
    const availableMonths = getAvailableMonths(state.manualExpenses, getCompletedMonths());
    const monthKeys = new Set(availableMonths.map((item) => item.monthKey));

    if (!monthKeys.has(state.activeMonthContext.monthKey)) {
        availableMonths.unshift(state.activeMonthContext);
    }

    elements.activeMonthSelect.innerHTML = MONTH_NAMES.map((month) => `
        <option value="${month}">${month}</option>
    `).join("");
    elements.activeMonthSelect.value = state.activeMonthContext.month;
    elements.activeYearInput.value = String(state.activeMonthContext.year);

    elements.expenseMonth.innerHTML = `<option value="${state.activeMonthContext.monthKey}">${state.activeMonthContext.label}</option>`;
    elements.expenseMonth.value = state.activeMonthContext.monthKey;
    elements.expenseMonth.disabled = true;
}

function buildDateForActiveMonth(day = 1) {
    const maxDay = new Date(state.activeMonthContext.year, state.activeMonthContext.monthIndex + 1, 0).getDate();
    const safeDay = Math.max(1, Math.min(day, maxDay));
    return new Date(state.activeMonthContext.year, state.activeMonthContext.monthIndex, safeDay, 12)
        .toISOString()
        .slice(0, 10);
}

function syncExpenseDateToActiveMonth() {
    const selectedContext = buildMonthContextFromDate(elements.expDate.value);
    if (selectedContext?.monthKey === state.activeMonthContext.monthKey) {
        return;
    }

    const today = new Date();
    const preferredDay = today.getMonth() === state.activeMonthContext.monthIndex && today.getFullYear() === state.activeMonthContext.year
        ? today.getDate()
        : 1;
    elements.expDate.value = buildDateForActiveMonth(preferredDay);
}

function updateMonthUI(activeExpenses = getAnalysisExpensesForActiveMonth()) {
    const isClosed = isActiveMonthClosed();
    const expenseCount = activeExpenses.length;

    elements.currentMonthIndicator.textContent = `Currently viewing: ${state.activeMonthContext.label}`;
    elements.dashboardMonthBadge.textContent = state.activeMonthContext.label;
    elements.monthStateTitle.textContent = state.activeMonthContext.label;

    if (isClosed) {
        elements.monthStateMessage.textContent = expenseCount
            ? `This month is closed. Showing ${expenseCount} archived transactions for comparison.`
            : "This month is closed and no archived transactions were found.";
        elements.completeMonthBtn.textContent = "Month Closed";
        elements.completeMonthBtn.disabled = true;
    } else if (!expenseCount) {
        elements.monthStateMessage.textContent = `No expenses logged for ${state.activeMonthContext.label}`;
        elements.completeMonthBtn.textContent = "Mark Month as Complete";
        elements.completeMonthBtn.disabled = false;
    } else {
        elements.monthStateMessage.textContent = `${expenseCount} transactions are being analyzed for ${state.activeMonthContext.label}.`;
        elements.completeMonthBtn.textContent = "Mark Month as Complete";
        elements.completeMonthBtn.disabled = false;
    }
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
    const activeExpenses = getAnalysisExpensesForActiveMonth();
    const emptyMonthMessage = buildMonthEmptyMessage();
    const isClosed = isActiveMonthClosed();

    state.baseline = buildReferenceBaseline(state.datasetRecords);
    state.userStats = buildUserStats({
        manualExpenses: activeExpenses,
        profile: currentProfileValues(),
        activeMonthContext: state.activeMonthContext
    });
    state.comparisonInsights = generateComparisonInsights({
        baseline: state.baseline,
        userStats: state.userStats
    });

    renderUserCards(elements.userCards, state.userStats, state.comparisonInsights);
    renderCategoryComparison(
        elements.categoryComparison,
        state.comparisonInsights.categoryComparisons,
        state.comparisonInsights,
        state.baseline
    );
    renderExpenseList(elements.expenseList, activeExpenses, {
        activeMonthLabel: state.activeMonthContext.label,
        isClosed,
        readOnly: isClosed
    });
    renderInsightCards(elements.insightRailCards, state.comparisonInsights, 1);
    renderDashboardVisuals({
        categoryDonut: elements.categoryDonut,
        monthlyChart: elements.monthlyChart,
        savingsProgress: elements.savingsProgress,
        investmentAllocation: elements.investmentAllocation,
        dashboardInsights: elements.dashboardInsights
    }, state.userStats, state.comparisonInsights, {
        emptyMonthMessage
    });

    const categories = [
        ...state.baseline.categories.list.map((item) => item.name),
        ...state.userStats.categories.list.map((item) => item.name),
        "Other"
    ];
    populateCategoryOptions(elements.expCategory, categories);
    syncMonthControls();
    syncExpenseDateToActiveMonth();
    updateMonthUI(activeExpenses);

    if (document.getElementById("taxEstimate")) {
        const taxEstimate = Math.max((state.userStats.comparisons.currentSpend || 0) * 0.08, 0);
        document.getElementById("taxEstimate").textContent = formatCurrency(taxEstimate);
    }

    if (publishInsights) {
        publishAutomatedInsights(forceInsight);
    }
}

function setActiveMonthContext(context, options = {}) {
    const nextContext = buildMonthContext(context.month, context.year);
    const isSameMonth = nextContext.monthKey === state.activeMonthContext.monthKey;

    if (isSameMonth) {
        syncMonthControls();
        syncExpenseDateToActiveMonth();
        rebuildAnalysis({ publishInsights: false, forceInsight: false });
        return;
    }

    state.activeMonthContext = nextContext;
    saveActiveMonth(nextContext.month, nextContext.year);
    state.pendingImport = null;
    renderUploadPreview(elements.uploadPreview, null);
    setImportStatus("", "neutral");

    if (options.resetConversation) {
        resetConversationState();
    }

    rebuildAnalysis({
        publishInsights: !options.resetConversation && options.publishInsights,
        forceInsight: options.forceInsight
    });

    if (options.announceMessage) {
        appendAssistantMessage(options.announceMessage);
    }

    if (!isSameMonth && options.switchToView) {
        setActiveView(options.switchToView);
    }
}

function openExpenseModal() {
    if (isActiveMonthClosed()) {
        appendAssistantMessage("This month is closed. Start a new month to continue.");
        return;
    }

    syncMonthControls();
    syncExpenseDateToActiveMonth();
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

function openCompleteMonthModal() {
    if (isActiveMonthClosed()) {
        appendAssistantMessage("This month is already closed. Switch to a new month to continue.");
        return;
    }

    const profile = getProfile();
    const completionData = calculateMonthCompletion(
        state.activeMonthContext,
        state.manualExpenses,
        profile,
        profile.savings
    );
    const summary = formatCompletionSummary(completionData);

    elements.completeMonthTitle.textContent = summary.title;
    elements.completeMonthSummary.innerHTML = summary.lines.map((line) => `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${line.label}</span>
            <strong style="color: var(--on-surface);">${formatCurrency(line.value)}</strong>
        </div>
    `).join("");

    state.pendingMonthCompletion = completionData;
    elements.completeMonthModal.classList.add("open");
    elements.completeMonthModal.setAttribute("aria-hidden", "false");
}

function closeCompleteMonthModal() {
    elements.completeMonthModal.classList.remove("open");
    elements.completeMonthModal.setAttribute("aria-hidden", "true");
    state.pendingMonthCompletion = null;
}

function handleConfirmCompleteMonth() {
    if (!state.pendingMonthCompletion) {
        return;
    }

    const completion = state.pendingMonthCompletion;

    saveProfileField("savings", String(completion.newSavings));
    saveCompletedMonth(completion.month, completion.year, completion.expenses);

    state.manualExpenses = state.manualExpenses.filter((expense) => !isExpenseInMonth(expense, completion));
    saveExpenses(state.manualExpenses);

    closeCompleteMonthModal();
    state.pendingImport = null;
    renderUploadPreview(elements.uploadPreview, null);
    setImportStatus(`${completion.label} archived successfully.`, "success");

    const nextContext = getNextMonthContext(completion);
    setActiveMonthContext(nextContext, {
        resetConversation: true,
        announceMessage: `${completion.label} marked as complete. You can now start logging expenses for the next month.`,
        switchToView: "expenses"
    });
}

function setImportStatus(message = "", tone = "neutral") {
    renderImportStatus(elements.importStatus, message ? { message, tone } : null);
}

function createExpenseKey(expense) {
    const normalized = normalizeExpenseRecord(expense);

    return [
        String(normalized.date || "").trim(),
        String(normalized.category || "").trim().toLowerCase(),
        Number(normalized.amount || 0).toFixed(2),
        String(normalized.transactionType || "expense").trim().toLowerCase(),
        String(normalized.month || "").trim().toLowerCase(),
        String(normalized.year || "").trim()
    ].join("|");
}

function getDetectedMonthContexts(records = []) {
    const monthMap = new Map();

    records.forEach((record) => {
        const context = buildMonthContextFromDate(record.date)
            || (record.month && record.year ? buildMonthContext(record.month, record.year) : null);
        if (context) {
            monthMap.set(context.monthKey, context);
        }
    });

    return Array.from(monthMap.values()).sort((left, right) => left.monthKey.localeCompare(right.monthKey));
}

function mergeImportedExpenses(records) {
    const existingKeys = new Set(state.manualExpenses.map(createExpenseKey));
    const completedMonths = getCompletedMonths();
    const imported = [];
    const completedMonthsSkipped = new Set();
    let duplicateCount = 0;
    let completedMonthCount = 0;

    records.forEach((record) => {
        const normalizedExpense = normalizeExpenseRecord({
            id: Date.now() + imported.length + duplicateCount + completedMonthCount,
            date: record.date,
            category: record.category,
            amount: record.amount,
            month: record.month,
            year: record.year,
            vendor: record.vendor || "",
            description: record.description || "",
            transactionType: record.transactionType || "expense",
            source: record.source || "user-import"
        });
        const key = createExpenseKey(normalizedExpense);

        if (completedMonths[buildMonthContext(normalizedExpense.month, normalizedExpense.year).archiveKey]) {
            completedMonthsSkipped.add(`${normalizedExpense.month} ${normalizedExpense.year}`);
            completedMonthCount += 1;
            return;
        }

        if (existingKeys.has(key)) {
            duplicateCount += 1;
            return;
        }

        existingKeys.add(key);
        imported.push(normalizedExpense);
    });

    return {
        imported,
        duplicateCount,
        completedMonthCount,
        completedMonthsList: Array.from(completedMonthsSkipped)
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
    if (isActiveMonthClosed()) {
        appendAssistantMessage("This month is closed. Start a new month to continue.");
        return;
    }

    const date = elements.expDate.value;
    const category = elements.expCategory.value;
    const vendor = elements.expVendor.value.trim();
    const description = elements.expDescription.value.trim();
    const amount = elements.expAmount.value.trim();
    const dateContext = buildMonthContextFromDate(date);

    if (!date || !category || !amount) {
        appendAssistantMessage("Please enter a date, category, and amount before saving the expense.");
        return;
    }

    if (!dateContext || dateContext.monthKey !== state.activeMonthContext.monthKey) {
        appendAssistantMessage(`Please choose a date inside ${state.activeMonthContext.label} so the expense stays in the active month.`);
        return;
    }

    const expense = normalizeExpenseRecord({
        id: Date.now(),
        date,
        category,
        vendor,
        description,
        amount,
        transactionType: "expense"
    });

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

    const detectedMonths = parsed.metadata?.detectedMonths?.length
        ? parsed.metadata.detectedMonths.map((item) => buildMonthContext(item.month, item.year))
        : getDetectedMonthContexts(parsed.records);

    if (detectedMonths.length === 1 && detectedMonths[0].monthKey !== state.activeMonthContext.monthKey) {
        setActiveMonthContext(detectedMonths[0], {
            resetConversation: true,
            announceMessage: `Switched active month to ${detectedMonths[0].label} to match ${file.name}.`,
            switchToView: "expenses"
        });
    } else {
        setActiveView("expenses");
    }

    state.pendingImport = {
        fileName: file.name,
        parsed
    };

    const invalidRowCount = parsed.metadata?.invalidRowCount || 0;
    const monthSummary = detectedMonths.length === 1
        ? ` for ${detectedMonths[0].label}`
        : detectedMonths.length > 1
            ? ` across ${detectedMonths.length} months`
            : "";

    renderUploadPreview(elements.uploadPreview, parsed);
    setImportStatus(
        `Ready to import ${parsed.records.length} transactions${monthSummary}${invalidRowCount ? `. ${invalidRowCount} invalid rows were skipped during parsing.` : "."}`,
        "neutral"
    );
    appendAssistantMessage(`I parsed ${parsed.records.length} transactions from ${file.name}${monthSummary}.${invalidRowCount ? ` ${invalidRowCount} invalid rows were skipped.` : ""} Review the preview, then confirm the import.`);
    event.target.value = "";
}

function confirmPendingImport() {
    if (!state.pendingImport?.parsed?.records?.length) {
        return;
    }

    const { fileName, parsed } = state.pendingImport;
    const { imported, duplicateCount, completedMonthCount, completedMonthsList } = mergeImportedExpenses(parsed.records);

    if (completedMonthCount > 0) {
        const warningMsg = `Skipped ${completedMonthCount} transaction(s) from completed month(s): ${completedMonthsList.join(", ")}.`;
        setImportStatus(warningMsg, "warning");
        appendAssistantMessage(warningMsg);
    }

    if (!imported.length) {
        const detail = completedMonthCount > 0
            ? "All transactions in this file belong to months you already closed."
            : "No new transactions were added because every parsed row already exists in your data or is invalid.";
        setImportStatus(detail, "warning");
        appendAssistantMessage(`I could not add any new expenses from ${fileName} because ${detail.toLowerCase()}`);
        state.pendingImport = null;
        renderUploadPreview(elements.uploadPreview, null);
        return;
    }

    state.manualExpenses.push(...imported);
    saveExpenses(state.manualExpenses);
    state.pendingImport = null;
    renderUploadPreview(elements.uploadPreview, null);
    rebuildAnalysis({ publishInsights: true, forceInsight: true });

    let statusMsg = `${imported.length} transactions added`;
    let assistantMsg = `Imported ${imported.length} transactions from ${fileName}.`;

    if (duplicateCount) {
        statusMsg += ` ${duplicateCount} duplicate rows skipped.`;
        assistantMsg += ` Skipped ${duplicateCount} duplicate rows.`;
    }
    if (completedMonthCount) {
        statusMsg += ` ${completedMonthCount} transactions from completed months were skipped.`;
        assistantMsg += ` ${completedMonthCount} transactions from completed months were not imported.`;
    }

    setImportStatus(statusMsg, "success");
    appendAssistantMessage(assistantMsg);
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
    state.activeMonthContext = getCurrentMonthContext();
    saveActiveMonth(state.activeMonthContext.month, state.activeMonthContext.year);

    elements.apiKey.value = "";
    elements.expenseFileInput.value = "";
    state.pendingImport = null;
    setImportStatus("", "neutral");
    renderUploadPreview(elements.uploadPreview, null);
    closeExpenseModal();
    closeResetModal();
    closeClearTransactionsModal();
    closeCompleteMonthModal();
    renderChatHistory(elements.chatHistoryBox, state.conversation, DEFAULT_CHAT_MESSAGE);
    syncMonthControls();
    syncExpenseDateToActiveMonth();
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
            closeCompleteMonthModal();
            cancelPendingImport();
        }
    });

    elements.apiKey.addEventListener("input", (event) => saveApiKey(event.target.value));
    elements.activeMonthSelect.addEventListener("change", () => {
        const nextContext = buildMonthContext(elements.activeMonthSelect.value, elements.activeYearInput.value);
        setActiveMonthContext(nextContext, {
            resetConversation: true,
            announceMessage: `Active month set to ${nextContext.label}. Chat context was reset so analysis stays month-specific.`
        });
    });
    elements.activeYearInput.addEventListener("change", () => {
        const nextContext = buildMonthContext(elements.activeMonthSelect.value, elements.activeYearInput.value);
        setActiveMonthContext(nextContext, {
            resetConversation: true,
            announceMessage: `Active month set to ${nextContext.label}. Chat context was reset so analysis stays month-specific.`
        });
    });

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
    elements.cancelCompleteMonthBtn.addEventListener("click", closeCompleteMonthModal);
    elements.confirmCompleteMonthBtn.addEventListener("click", handleConfirmCompleteMonth);
    elements.completeMonthModal.addEventListener("click", (event) => {
        if (event.target === elements.completeMonthModal) {
            closeCompleteMonthModal();
        }
    });
    elements.completeMonthBtn.addEventListener("click", openCompleteMonthModal);
    window.addEventListener("focus", () => rebuildAnalysis({ publishInsights: true }));
    window.addEventListener("hashchange", () => setActiveView(getInitialView()));
}

async function init() {
    elements.apiKey.value = getApiKey();
    state.manualExpenses = getExpenses().map((expense) => normalizeExpenseRecord(expense));
    saveExpenses(state.manualExpenses);
    state.activeMonthContext = getActiveMonthSelection(state.manualExpenses);
    state.conversation = getConversation();
    state.lastInsightSignature = getLastInsightSignature();

    renderChatHistory(elements.chatHistoryBox, state.conversation, DEFAULT_CHAT_MESSAGE);
    syncMonthControls();
    syncExpenseDateToActiveMonth();

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
