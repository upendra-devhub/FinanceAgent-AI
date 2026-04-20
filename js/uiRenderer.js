import { escapeHtml, formatCurrency, formatNumber, formatPercent } from "./formatters.js";

function formatMessage(text) {
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");
}

function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

export function renderProfileSummary(element, userStats) {
    if (!userStats.profile.isComplete) {
        element.innerHTML = `
            <div class="profile-summary-card">
                <h3>Profile Needed</h3>
                <p>Add income, savings, goal, and mandatory expenses in Your Financial Profile to unlock full affordability and savings analysis.</p>
            </div>
        `;
        return;
    }

    const rows = [
        { label: "Monthly Income", value: formatCurrency(userStats.profile.income) },
        { label: "Current Savings", value: formatCurrency(userStats.profile.savings) },
        { label: "Savings Goal", value: formatCurrency(userStats.profile.goal) },
        { label: "Mandatory Monthly", value: formatCurrency(userStats.profile.mandatoryTotal) }
    ];

    element.innerHTML = rows.map((row) => `
        <article class="profile-summary-row">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
        </article>
    `).join("");
}

export function renderUserCards(element, userStats, ruleInsights) {
    const currentPeriodLabel = userStats.comparisons.currentPeriodLabel || "Current month";
    const savingsRateValue = userStats.comparisons.actualSavingsRate !== null
        ? formatPercent(userStats.comparisons.actualSavingsRate)
        : "Set profile";
    const savingsRateSubtext = userStats.comparisons.targetSavingsRate !== null
        ? `Target ${formatPercent(userStats.comparisons.targetSavingsRate)}`
        : "Add income and savings goal to compare";

    const cards = [
        {
            label: currentPeriodLabel,
            value: formatCurrency(userStats.comparisons.currentSpend),
            subtext: `${formatNumber(userStats.totals.expenseCount)} expenses logged`
        },
        {
            label: "Monthly Outflow",
            value: formatCurrency(userStats.comparisons.totalMonthlyOutflow),
            subtext: userStats.comparisons.totalBudgetLoad !== null
                ? `${formatPercent(userStats.comparisons.totalBudgetLoad)} of income after mandatory costs`
                : "Add income to unlock affordability checks"
        },
        {
            label: "Savings Capacity",
            value: userStats.comparisons.savingsCapacity !== null
                ? formatCurrency(userStats.comparisons.savingsCapacity)
                : "Set profile",
            subtext: userStats.comparisons.savingsGap !== null
                ? `${userStats.comparisons.savingsGap > 0 ? "Gap" : "Ahead by"} ${formatCurrency(Math.abs(userStats.comparisons.savingsGap))} vs goal`
                : "Needs income and goal"
        },
        {
            label: "Savings Rate",
            value: savingsRateValue,
            subtext: `${savingsRateSubtext} | Health ${ruleInsights.healthScore.value}/100`
        }
    ];

    element.innerHTML = cards.map((card) => `
        <article class="stat-card">
            <p class="stat-label">${escapeHtml(card.label)}</p>
            <p class="stat-value">${escapeHtml(card.value)}</p>
            <p class="stat-subtext">${escapeHtml(card.subtext)}</p>
        </article>
    `).join("");
}

export function renderCategoryComparison(element, comparisons) {
    const rows = comparisons
        .filter((item) => item.userShare > 0)
        .slice(0, 8);

    if (!rows.length) {
        element.innerHTML = emptyState("Log user expenses to compare category shares against the learned baseline.");
        return;
    }

    element.innerHTML = rows.map((item) => `
        <article class="metric-row">
            <div>
                <div class="metric-name">${escapeHtml(item.name)}</div>
                <div class="metric-detail">
                    ${item.status === "well-above" || item.status === "above"
                        ? `Higher than baseline by ${formatPercent(Math.abs(item.deltaFromMedian))}`
                        : item.status === "below"
                            ? `Lower than baseline by ${formatPercent(Math.abs(item.deltaFromMedian))}`
                            : item.status === "new-user-category"
                                ? "No strong baseline match yet"
                                : "Within the learned baseline range"}
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max(item.userShare * 100, 4)}%"></div></div>
            </div>
            <div class="metric-name">${formatPercent(item.userShare)}</div>
        </article>
    `).join("");
}

export function renderMonthlyComparison(element, userStats, ruleInsights) {
    const latestMonths = userStats.monthly.trend.slice(-4).reverse();

    if (!latestMonths.length) {
        element.innerHTML = emptyState("Add dated user expenses to see your recent spending pattern.");
        return;
    }

    const monthlyAlert = ruleInsights.alerts.find((item) => item.id === "user-month-above-baseline" || item.id === "month-over-month-growth");
    element.innerHTML = latestMonths.map((item, index) => `
        <article class="trend-row">
            <div>
                <div class="trend-label">${escapeHtml(item.label)}</div>
                <div class="trend-detail">
                    ${index === 0 && monthlyAlert
                        ? escapeHtml(monthlyAlert.message)
                        : `${formatNumber(item.count)} user expenses logged`}
                </div>
            </div>
            <div class="metric-name">${formatCurrency(item.total)}</div>
        </article>
    `).join("");
}

export function renderExpenseList(element, expenses) {
    if (!expenses.length) {
        element.innerHTML = emptyState("No expenses logged yet.");
        return;
    }

    const ordered = [...expenses].sort((left, right) => new Date(right.date) - new Date(left.date));
    element.innerHTML = ordered.map((expense) => `
        <article class="expense-item">
            <div>
                <div class="expense-title">${escapeHtml(expense.vendor || expense.category)}</div>
                <div class="expense-meta">
                    ${escapeHtml(expense.date || "No date")} | ${escapeHtml(expense.category || "Uncategorized")}
                    ${expense.description ? ` | ${escapeHtml(expense.description)}` : ""}
                </div>
            </div>
            <div class="expense-value">${formatCurrency(Number(expense.amount) || 0)}</div>
            <button type="button" class="icon-button" data-delete-expense="${escapeHtml(String(expense.id))}" title="Delete expense">X</button>
        </article>
    `).join("");
}

export function renderChatHistory(element, conversation, defaultMessage) {
    if (!conversation.length) {
        element.innerHTML = `<div class="message ai">${formatMessage(defaultMessage)}</div>`;
        return;
    }

    element.innerHTML = conversation.map((message) => {
        const sender = message.role === "user" ? "user" : "ai";
        const text = message.parts?.[0]?.text || "";
        return `<div class="message ${sender}">${formatMessage(text)}</div>`;
    }).join("");
    element.scrollTop = element.scrollHeight;
}

export function appendMessage(element, sender, text) {
    const message = document.createElement("div");
    message.className = `message ${sender}`;
    message.innerHTML = formatMessage(text);
    element.appendChild(message);
    element.scrollTop = element.scrollHeight;
}

export function setLoadingState(loaderElement, buttonElement, isLoading) {
    loaderElement.style.display = isLoading ? "block" : "none";
    buttonElement.disabled = isLoading;
}

export function populateCategoryOptions(selectElement, categories) {
    const uniqueCategories = Array.from(new Set(categories.filter(Boolean))).sort((left, right) => left.localeCompare(right));
    const options = uniqueCategories.length ? uniqueCategories : ["Food", "Rent", "Transport", "Utilities", "Other"];

    selectElement.innerHTML = options.map((category) => `
        <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
    `).join("");
}
