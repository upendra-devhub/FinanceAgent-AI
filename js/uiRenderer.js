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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function transactionTypeLabel(type = "expense") {
    return {
        income: "Income",
        investment: "Investment",
        expense: "Expense"
    }[type] || "Expense";
}

function getTopInsights(ruleInsights, limit = 4) {
    const rank = { high: 4, medium: 3, low: 2, positive: 1 };
    return [...ruleInsights.alerts, ...ruleInsights.positives]
        .sort((left, right) => (rank[right.severity] || 0) - (rank[left.severity] || 0))
        .slice(0, limit);
}

function insightTone(item) {
    if (item.severity === "high" || item.severity === "medium") {
        return "warning";
    }
    if (item.severity === "positive") {
        return "positive";
    }
    return "neutral";
}

function categoryMessage(item) {
    if (item.status === "well-above" || item.status === "above") {
        const expected = item.baselineMedianShare || item.baselineQ3Share || 0;
        const over = expected > 0 ? (item.userShare - expected) / expected : item.deltaFromMedian;
        return `You spent ${formatPercent(Math.max(over, 0))} more than usual this month.`;
    }
    if (item.status === "below") {
        return "You are spending less than usual this month.";
    }
    if (item.status === "new-user-category") {
        return "This category is starting to show up in your spending.";
    }
    return "Your spending is close to your usual level this month.";
}

function usualCategorySpend(item, baseline) {
    const category = baseline?.categories?.byName?.get(item.name);
    return category?.monthlyAmountDistribution?.median || 0;
}

function getMonthlyPoints(months, width = 640, height = 280) {
    const max = Math.max(...months.map((item) => item.total), 1);
    const step = months.length > 1 ? width / (months.length - 1) : width;
    return months.map((item, index) => ({
        x: index * step,
        y: height - (item.total / max) * (height * 0.78) - 18,
        label: item.label.split(" ")[0]
    }));
}

function smoothPath(points) {
    if (!points.length) {
        return "";
    }
    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    return points.reduce((path, point, index) => {
        if (index === 0) {
            return `M ${point.x} ${point.y}`;
        }
        const previous = points[index - 1];
        const midX = (previous.x + point.x) / 2;
        return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
    }, "");
}

function sectionCard(title, cards) {
    return `
        <section class="insight-section-block">
            <header class="insight-section-header">
                <h3>${escapeHtml(title)}</h3>
            </header>
            ${cards.length ? `<div class="insight-card-grid">${cards.join("")}</div>` : `<div class="empty-state insight-empty">Nothing here right now.</div>`}
        </section>
    `;
}

function insightCard({ title, explanation, context, aiQuery = "What should I focus on in my spending?", featured = false }) {
    return `
        <article class="${featured ? "featured-insight-card actionable-insight-card" : "small-insight-card actionable-insight-card"}">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(explanation)}</p>
            <div class="insight-context">${escapeHtml(context)}</div>
            <div class="insight-actions">
                <button type="button" class="subtle-button" data-insight-action="view-transactions">View transactions</button>
                <button type="button" class="button" data-insight-action="ask-ai-why" data-ai-query="${escapeHtml(aiQuery)}">Ask AI why</button>
            </div>
        </article>
    `;
}

export function renderProfileSummary(element, userStats) {
    if (!userStats.profile.isComplete) {
        element.innerHTML = `
            <div class="profile-summary-card">
                <h3>Profile Needed</h3>
                <p>Add income, savings, goal, and mandatory expenses to unlock affordability analysis.</p>
            </div>
        `;
        return;
    }

    element.innerHTML = [
        ["Monthly Income", formatCurrency(userStats.profile.income)],
        ["Current Savings", formatCurrency(userStats.profile.savings)],
        ["Savings Goal", formatCurrency(userStats.profile.goal)],
        ["Mandatory Monthly", formatCurrency(userStats.profile.mandatoryTotal)]
    ].map(([label, value]) => `
        <article class="profile-summary-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </article>
    `).join("");
}

export function renderUserCards(element, userStats) {
    if (!userStats.metadata.hasTransactions) {
        element.innerHTML = `
            <article class="net-worth-card empty-card">
                <div>
                    <p>Total Money</p>
                    <strong>₹0</strong>
                    <small class="metric-note">Your total financial value</small>
                    <span><b>Ready</b> Upload a CSV or add an expense to begin.</span>
                </div>
                <div class="net-worth-minis">
                    <article>
                        <p>Available to Spend</p>
                        <strong>₹0</strong>
                        <small class="metric-note">Money you can use right now</small>
                    </article>
                    <article>
                        <p>Investments</p>
                        <strong>₹0</strong>
                        <small class="metric-note">Money invested for growth</small>
                    </article>
                </div>
            </article>
        `;
        return;
    }

    const totalMoney = userStats.profile.savings + userStats.investments.total;
    const availableToSpend = userStats.profile.savings || userStats.comparisons.savingsCapacity || 0;
    const investments = userStats.investments.total;

    element.innerHTML = `
        <article class="net-worth-card">
            <div>
                <p>Total Money</p>
                <strong>${formatCurrency(totalMoney)}</strong>
                <small class="metric-note">Your total financial value</small>
                <span><b>+${formatPercent(0.024, 1)}</b> vs last month</span>
            </div>
            <div class="net-worth-minis">
                <article>
                    <p>Available to Spend</p>
                    <strong>${formatCurrency(availableToSpend)}</strong>
                    <small class="metric-note">Money you can use right now</small>
                </article>
                <article>
                    <p>Investments</p>
                    <strong>${formatCurrency(investments)}</strong>
                    <small class="metric-note">Money invested for growth</small>
                </article>
            </div>
        </article>
    `;
}

export function renderDashboardVisuals(elements, userStats, ruleInsights) {
    renderCategoryDonut(elements.categoryDonut, userStats);
    renderMonthlyChart(elements.monthlyChart, userStats);
    renderSavingsProgress(elements.savingsProgress, userStats);
    renderInvestmentAllocation(elements.investmentAllocation, userStats);
    renderInsightCards(elements.dashboardInsights, ruleInsights, 3);
}

function renderMonthlyChart(element, userStats) {
    if (!element) {
        return;
    }

    const sourceMonths = userStats.monthly.trend.slice(-6);
    if (!sourceMonths.length) {
        element.innerHTML = emptyState("No data yet. Upload a CSV to get started.");
        return;
    }

    const months = sourceMonths;
    const points = getMonthlyPoints(months);
    const path = smoothPath(points);
    const areaPath = `${path} L 640 280 L 0 280 Z`;
    const cashFlowSummary = userStats.profile.income > 0
        ? userStats.comparisons.savingsCapacity < 0
            ? "You are spending more than you earn right now."
            : `You are saving ${formatCurrency(Math.max(userStats.comparisons.savingsCapacity, 0))} this month.`
        : "Add your income to see whether you are saving this month.";

    element.innerHTML = `
        <svg viewBox="0 0 640 320" preserveAspectRatio="none" aria-label="Cash flow chart">
            <defs>
                <linearGradient id="cashAreaA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#7b7b7d" stop-opacity="0.58"/>
                    <stop offset="100%" stop-color="#7b7b7d" stop-opacity="0.06"/>
                </linearGradient>
                <linearGradient id="cashAreaB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#a8a8aa" stop-opacity="0.48"/>
                    <stop offset="100%" stop-color="#a8a8aa" stop-opacity="0.04"/>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#cashAreaA)"></path>
            <path d="${path}" fill="none" stroke="#8b8b8d" stroke-width="1.5"></path>
            <path d="M 0 205 C 120 200, 180 215, 265 180 C 360 135, 450 170, 640 190 L 640 280 L 0 280 Z" fill="url(#cashAreaB)"></path>
            <line x1="0" y1="72" x2="640" y2="72" stroke="rgba(26,28,26,.08)"></line>
            <line x1="0" y1="280" x2="640" y2="280" stroke="rgba(26,28,26,.12)"></line>
        </svg>
        <div class="chart-months">
            ${months.map((item) => `<span>${escapeHtml(item.label.split(" ")[0])}</span>`).join("")}
        </div>
        <p class="chart-summary">${escapeHtml(cashFlowSummary)}</p>
    `;
}

function renderCategoryDonut(element, userStats) {
    if (!element) {
        return;
    }

    if (!userStats.categories.list.length) {
        element.innerHTML = `
            <div class="profile-total">
                <strong>₹0</strong>
                <span>No data yet. Upload a CSV to get started.</span>
            </div>
        `;
        return;
    }

    const categories = userStats.categories.list.slice(0, 3);
    const currentSpend = userStats.comparisons.currentSpend || userStats.totals.totalExpense || 0;
    const colors = ["#474dc5", "#765469", "#805200"];
    const topCategory = categories[0];

    element.innerHTML = `
        <div class="profile-total">
            <strong>${formatCurrency(currentSpend)}</strong>
            <span>This Month</span>
        </div>
        <div class="spending-legend">
            ${categories.map((category, index) => `
                <article>
                    <span class="legend-dot" style="background:${colors[index % colors.length]}"></span>
                    <b>${escapeHtml(category.name)}</b>
                    <strong>${formatPercent(category.share)}</strong>
                </article>
            `).join("")}
        </div>
        <p class="profile-highlight">${escapeHtml(`Most of your money goes to ${topCategory.name} (${formatPercent(topCategory.share)}).`)}</p>
    `;
}

function renderSavingsProgress(element, userStats) {
    if (!element) {
        return;
    }

    const goal = userStats.profile.goal;
    const current = Math.max(userStats.comparisons.savingsCapacity || 0, 0);
    const progress = goal > 0 ? clamp((current / goal) * 100, 0, 100) : 0;

    element.innerHTML = `
        <div class="savings-progress-copy">
            <strong>${goal > 0 ? formatPercent(progress / 100) : "Set profile"}</strong>
            <span>${goal > 0 ? `${formatCurrency(current)} of ${formatCurrency(goal)}` : "Add a savings goal to track progress."}</span>
        </div>
        <div class="savings-track"><span style="width:${progress}%"></span></div>
    `;
}

function renderInvestmentAllocation(element, userStats) {
    if (!element) {
        return;
    }

    const investments = userStats.investments.list;
    element.innerHTML = investments.length
        ? investments.slice(0, 3).map((item) => `
            <article class="allocation-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${formatCurrency(item.total)}</span>
            </article>
        `).join("")
        : emptyState("No investments tagged yet.");
}

export function renderCategoryComparison(element, comparisons, ruleInsights, baseline) {
    const activeRows = comparisons.filter((item) => item.userShare > 0);
    const needsAttentionRows = activeRows.filter((item) => item.status === "well-above" || item.status === "above").slice(0, 2);
    const onTrackRows = activeRows.filter((item) => item.status === "below" || item.status === "within").slice(0, 2);
    const suggestionRows = activeRows.filter((item) => item.status === "new-user-category").slice(0, 1);

    const needsAttentionCards = needsAttentionRows.map((item, index) => insightCard({
        title: `You are overspending on ${item.name}`,
        explanation: categoryMessage(item),
        context: `You spent ${formatCurrency(item.userTotal)} so far. Usually you spend around ${formatCurrency(usualCategorySpend(item, baseline))} in this category.`,
        aiQuery: `Why am I overspending on ${item.name.toLowerCase()}?`,
        featured: index === 0
    }));

    const onTrackCards = onTrackRows.map((item) => insightCard({
        title: `${item.name} spending is on track`,
        explanation: categoryMessage(item),
        context: `You spent ${formatCurrency(item.userTotal)} so far. Usually you spend around ${formatCurrency(usualCategorySpend(item, baseline))} in this category.`,
        aiQuery: `Why is my ${item.name.toLowerCase()} spending on track this month?`
    }));

    if (ruleInsights.positives[0] && onTrackCards.length < 2) {
        onTrackCards.push(insightCard({
            title: ruleInsights.positives[0].title,
            explanation: ruleInsights.positives[0].message,
            context: "This is a good sign for your monthly plan.",
            aiQuery: "Why is my budget on track right now?"
        }));
    }

    const suggestionCards = [];
    if (ruleInsights.alerts.find((item) => item.id === "profile-missing")) {
        suggestionCards.push(insightCard({
            title: "Complete your profile for better advice",
            explanation: "Adding income, savings, and monthly goals makes the advice more accurate.",
            context: "Right now I can track spending, but I cannot fully judge what you can afford.",
            aiQuery: "Why should I complete my financial profile?"
        }));
    }

    suggestionRows.forEach((item) => {
        suggestionCards.push(insightCard({
            title: `Track ${item.name} as a new trend`,
            explanation: categoryMessage(item),
            context: `You spent ${formatCurrency(item.userTotal)} so far. Keep an eye on it before it becomes a habit.`,
            aiQuery: `Why is ${item.name.toLowerCase()} showing up as a new spending trend?`
        }));
    });

    if (!suggestionCards.length) {
        suggestionCards.push(insightCard({
            title: activeRows[0] ? `Review ${activeRows[0].name} this week` : "Upload your data to get insights",
            explanation: activeRows[0]
                ? `${activeRows[0].name} is currently your biggest spending area.`
                : "No data yet. Upload a CSV to get started.",
            context: activeRows[0]
                ? `You spent ${formatCurrency(activeRows[0].userTotal)} there so far.`
                : "The advisor needs your transactions to show useful next steps.",
            aiQuery: activeRows[0]
                ? `Why is ${activeRows[0].name.toLowerCase()} my biggest expense right now?`
                : "How should I get started with this app?"
        }));
    }

    element.innerHTML = [
        sectionCard("🚨 Needs Attention", needsAttentionCards),
        sectionCard("✅ On Track", onTrackCards),
        sectionCard("💡 Suggestions", suggestionCards)
    ].join("");
}

export function renderExpenseList(element, expenses) {
    if (!expenses.length) {
        element.innerHTML = `
            <div class="expense-list-header">
                <div>
                    <h3>Transactions</h3>
                    <p>No data yet. Upload a CSV to get started.</p>
                </div>
            </div>
            <div class="empty-state ledger-empty">No data yet. Upload a CSV to get started.</div>
        `;
        return;
    }

    element.innerHTML = `
        <div class="expense-list-header">
            <div>
                <h3>Transactions</h3>
                <p>${formatNumber(expenses.length)} transactions are currently saved in your workspace.</p>
            </div>
            <button type="button" class="subtle-button" data-expense-action="clear-all">Clear All Transactions</button>
        </div>
        ${[...expenses]
            .sort((left, right) => new Date(right.date) - new Date(left.date))
            .slice(0, 8)
            .map((expense) => `
                <article class="expense-item expense-type-${escapeHtml(expense.transactionType || "expense")}">
                    <div>
                        <div class="expense-title">${escapeHtml(expense.vendor || expense.category)}</div>
                        <div class="expense-meta">${escapeHtml(expense.date || "No date")} | ${escapeHtml(expense.category || "Uncategorized")} | ${transactionTypeLabel(expense.transactionType)}</div>
                    </div>
                    <div class="expense-value">${formatCurrency(Number(expense.amount) || 0)}</div>
                    <button type="button" class="icon-button" data-delete-expense="${escapeHtml(String(expense.id))}" title="Delete expense">X</button>
                </article>
            `).join("")}
    `;
}

export function renderInsightCards(element, ruleInsights, limit = 4) {
    if (!element) {
        return;
    }

    const items = getTopInsights(ruleInsights, limit);
    if (!items.length) {
        element.innerHTML = `
            <article class="rail-card anomaly-card">
                <div>
                    <span class="material-symbols-outlined">warning</span>
                    <h3>Needs attention</h3>
                </div>
                <p>No unusual spending yet. Upload transactions to activate live insights.</p>
                <button type="button" class="rail-link-button" data-insight-action="open-expenses">Upload CSV</button>
            </article>
        `;
        return;
    }

    element.innerHTML = items.map((item, index) => `
        <article class="rail-card ${index === 0 ? "anomaly-card" : "projection-card"}">
            <div>
                <span class="material-symbols-outlined">${insightTone(item) === "warning" ? "warning" : "auto_awesome"}</span>
                <h3>${escapeHtml(item.title)}</h3>
            </div>
            <p>${escapeHtml(item.message)}</p>
            ${index === 0 ? '<button type="button" class="rail-link-button" data-insight-action="view-transactions">View transactions</button>' : ""}
        </article>
    `).join("");
}

export function renderUploadPreview(element, parsed) {
    if (!element) {
        return;
    }

    if (!parsed) {
        element.innerHTML = "";
        return;
    }

    if (parsed.issues?.length) {
        element.innerHTML = `<div class="upload-error">${escapeHtml(parsed.issues.join(" "))}</div>`;
        return;
    }

    const records = parsed.records || [];
    const sourceName = parsed.metadata?.sourceName || "uploaded_statement.csv";
    const invalidRowCount = parsed.metadata?.invalidRowCount || 0;

    element.innerHTML = `
        <article class="parsed-card">
            <div class="parsed-header">
                <div>
                    <div class="file-row">
                        <span class="file-chip">csv</span>
                        <h3>${escapeHtml(sourceName)}</h3>
                        <b>${formatNumber(records.length)} Rows Parsed</b>
                    </div>
                    <p><span></span> AI categorization complete${invalidRowCount ? ` - ${formatNumber(invalidRowCount)} invalid rows skipped` : ""}</p>
                </div>
                <div class="burn-chart">
                    <strong>Weekly Spend Trend</strong>
                    <div><span></span><span></span><span></span><span></span><span></span></div>
                </div>
            </div>
            <div class="parsed-table">
                <div class="parsed-row parsed-head">
                    <span>Date</span>
                    <span>Raw Description</span>
                    <span>Category</span>
                    <span>Amount</span>
                </div>
                ${records.slice(0, 8).map((record) => `
                    <div class="parsed-row">
                        <span>${escapeHtml(record.date)}</span>
                        <strong>${escapeHtml(record.description || record.vendor || record.category)}</strong>
                        <b class="category-pill category-${escapeHtml(record.transactionType || "expense")}">${escapeHtml(record.category)}</b>
                        <em>${record.transactionType === "income" ? "" : "-"}${formatCurrency(record.amount)}</em>
                    </div>
                `).join("")}
            </div>
            <div class="preview-actions">
                <button type="button" class="subtle-button" id="cancelImportBtn">Cancel</button>
                <button type="button" class="button" id="confirmImportBtn">Confirm & Ingest Data</button>
            </div>
        </article>
    `;
}

export function renderChatHistory(element, conversation, defaultMessage) {
    if (!conversation.length) {
        element.innerHTML = `
            <div class="message-row ai-row">
                <span class="agent-orb material-symbols-outlined">auto_awesome</span>
                <div class="message ai">${formatMessage(defaultMessage)}</div>
            </div>
            <article class="embedded-analysis-card">
                <div class="analysis-card-heading">
                    <h3>Getting Started</h3>
                    <span>Next step</span>
                </div>
                <div class="analysis-card-stats">
                    <article><span>Upload CSV</span><strong>Ready</strong></article>
                    <article><span>Chat Context</span><strong>Waiting</strong></article>
                </div>
                <div class="budget-track"><span style="width:24%"></span></div>
                <div class="budget-labels"><span>Step 1</span><span>No data yet. Upload a CSV to get started.</span><span>Step 2</span></div>
            </article>
        `;
        return;
    }

    element.innerHTML = conversation.map((message) => {
        const sender = message.role === "user" ? "user" : "ai";
        const text = message.content || message.parts?.[0]?.text || "";
        if (sender === "ai") {
            return `
                <div class="message-row ai-row">
                    <span class="agent-orb material-symbols-outlined">auto_awesome</span>
                    <div class="message ai">${formatMessage(text)}</div>
                </div>
            `;
        }
        return `<div class="message user">${formatMessage(text)}</div>`;
    }).join("");
    element.scrollTop = element.scrollHeight;
}

export function appendMessage(element, sender, text) {
    const wrapper = document.createElement("div");
    if (sender === "ai") {
        wrapper.className = "message-row ai-row";
        wrapper.innerHTML = `
            <span class="agent-orb material-symbols-outlined">auto_awesome</span>
            <div class="message ai">${formatMessage(text)}</div>
        `;
    } else {
        wrapper.className = "message user";
        wrapper.innerHTML = formatMessage(text);
    }
    element.appendChild(wrapper);
    element.scrollTop = element.scrollHeight;
}

export function renderImportStatus(element, status) {
    if (!element) {
        return;
    }

    if (!status?.message) {
        element.innerHTML = "";
        element.className = "import-status";
        return;
    }

    element.className = `import-status tone-${status.tone || "neutral"}`;
    element.innerHTML = escapeHtml(status.message);
}

export function setLoadingState(loaderElement, buttonElement, isLoading) {
    loaderElement.style.display = isLoading ? "inline" : "none";
    buttonElement.disabled = isLoading;
}

export function populateCategoryOptions(selectElement, categories) {
    const uniqueCategories = Array.from(new Set(categories.filter(Boolean))).sort((left, right) => left.localeCompare(right));
    const options = uniqueCategories.length ? uniqueCategories : ["Food", "Rent", "Transport", "Utilities", "Other"];

    selectElement.innerHTML = options.map((category) => `
        <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
    `).join("");
}
