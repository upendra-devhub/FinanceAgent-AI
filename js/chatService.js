import { formatCurrency, formatNumber, formatPercent } from "./formatters.js";

function findMatch(question, candidates) {
    const normalizedQuestion = question.toLowerCase();
    return candidates.find((candidate) => normalizedQuestion.includes(candidate.name.toLowerCase())) || null;
}

function rankInsight(item) {
    const rank = { high: 4, medium: 3, low: 2, positive: 1 };
    return rank[item.severity] || 0;
}

function orderInsights(items) {
    return [...items].sort((left, right) => rankInsight(right) - rankInsight(left));
}

function insightIcon(item) {
    if (item.severity === "high" || item.severity === "medium") {
        return "Alert:";
    }

    if (item.severity === "positive") {
        return "Good:";
    }

    return "Note:";
}

function trimSentence(value = "") {
    return value.replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

function buildAdvisorSnapshot(ruleInsights, options = {}) {
    const limit = options.limit || 3;
    const orderedItems = orderInsights([
        ...ruleInsights.alerts,
        ...ruleInsights.positives
    ]).slice(0, limit);

    if (!orderedItems.length) {
        return "Your spending looks calm right now. Keep logging expenses so I can compare it with your usual pattern.";
    }

    const hasHighRisk = orderedItems.some((item) => item.severity === "high" || item.severity === "medium");
    const summary = hasHighRisk
        ? "Here's your spending snapshot this month:"
        : "Your budget looks steady right now:";
    const lines = orderedItems.map((item) => `${insightIcon(item)} ${trimSentence(item.message)}`);
    const leadAction = orderedItems.find((item) => item.action)?.action;

    return [
        summary,
        ...lines,
        leadAction ? `Focus: ${trimSentence(leadAction)}.` : ""
    ].filter(Boolean).join("\n");
}

function formatRuleSummary(ruleInsights) {
    const priorityItems = orderInsights([...ruleInsights.alerts, ...ruleInsights.positives]).slice(0, 5);
    if (!priorityItems.length) {
        return "No rule-based insights available yet.";
    }

    return priorityItems
        .map((item) => `- ${item.title}: ${item.message} Suggested move: ${item.action}`)
        .join("\n");
}

export function buildAutomatedInsightDigest(snapshot, ruleInsights) {
    if (!snapshot.baseline.metadata.hasRecords) {
        return {
            signature: "no-baseline",
            text: [
                "I could not learn a reference baseline yet.",
                "Note: restore the reference CSV so I can compare your expenses against a reliable pattern."
            ].join("\n")
        };
    }

    if (!snapshot.userStats.metadata.hasRecords) {
        const activeMonthLabel = snapshot.userStats.metadata.activeMonthLabel || "the active month";
        return {
            signature: "no-user-expenses",
            text: [
                "You're ready to start.",
                `Note: add or import expenses for ${activeMonthLabel} and I will compare them with your usual spending pattern, your income, and your savings goal.`
            ].join("\n")
        };
    }

    const orderedAlerts = orderInsights(ruleInsights.alerts);

    if (orderedAlerts.length) {
        return {
            signature: JSON.stringify({
                kind: "alerts",
                expenseCount: snapshot.userStats.totals.expenseCount,
                totalOutflow: Math.round(snapshot.userStats.comparisons.totalMonthlyOutflow || 0),
                alerts: orderedAlerts.slice(0, 3).map((item) => item.id)
            }),
            text: buildAdvisorSnapshot({
                alerts: orderedAlerts,
                positives: ruleInsights.positives
            })
        };
    }

    return {
        signature: JSON.stringify({
            kind: "positive",
            expenseCount: snapshot.userStats.totals.expenseCount,
            totalOutflow: Math.round(snapshot.userStats.comparisons.totalMonthlyOutflow || 0),
            positives: ruleInsights.positives.slice(0, 2).map((item) => item.id)
        }),
        text: buildAdvisorSnapshot({
            alerts: [],
            positives: ruleInsights.positives
        }, { limit: 2 })
    };
}

export function tryAnswerDirect(question, snapshot, ruleInsights) {
    const q = question.toLowerCase();
    const userStats = snapshot.userStats;
    const baseline = snapshot.baseline;

    if (!userStats.metadata.hasRecords) {
        if (/(spend|expense|budget|category|trend|vendor|month|save|saving|income)/.test(q)) {
            return "I have your usual spending pattern ready. Add or import expenses and I can compare your real spending against it.";
        }
        return null;
    }

    if (/(expenses exceed income|over income|above income|can i afford)/.test(q)) {
        if (userStats.comparisons.totalBudgetLoad === null) {
            return "I need your financial profile before I can run a proper affordability check.";
        }

        if (userStats.comparisons.totalBudgetLoad > 1) {
            return `Alert: your outflow is above income: ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)} vs ${formatCurrency(userStats.profile.income)}. Focus on trimming the categories running above your usual level first.`;
        }

        return `Good: you are still within income. Outflow is ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)}, leaving about ${formatCurrency(userStats.comparisons.savingsCapacity)} before planned savings.`;
    }

    if (/(savings rate|save rate|saving rate)/.test(q)) {
        if (userStats.comparisons.actualSavingsRate === null) {
            return "I need your financial profile before I can calculate a savings rate.";
        }

        const targetText = userStats.comparisons.targetSavingsRate !== null
            ? ` against a target of ${formatPercent(userStats.comparisons.targetSavingsRate)}`
            : "";
        const savingsStatus = userStats.comparisons.targetSavingsRate === null
            ? "Add a savings goal to judge whether that rate is enough."
            : userStats.comparisons.actualSavingsRate >= userStats.comparisons.targetSavingsRate
                ? "That looks healthy."
                : "Trim categories that are above your usual level to close the gap.";
        return `Your current savings rate is ${formatPercent(userStats.comparisons.actualSavingsRate)}${targetText}. ${savingsStatus}`;
    }

    if (/(how much room|buffer|margin|left after expenses)/.test(q)) {
        if (userStats.comparisons.savingsCapacity === null) {
            return "I need income and mandatory expenses in your profile before I can calculate your monthly margin.";
        }

        return `Your current monthly margin is ${formatCurrency(userStats.comparisons.savingsCapacity)} after user spending and mandatory expenses.`;
    }

    const categoryMatch = findMatch(q, userStats.categories.list);
    if (categoryMatch && /(how much|spent|spend|share|category)/.test(q)) {
        const comparison = ruleInsights.categoryComparisons.find((item) => item.name === categoryMatch.name);
        const incomeContext = comparison?.incomeShare !== null && comparison?.incomeShare !== undefined
            ? ` It uses ${formatPercent(comparison.incomeShare)} of your income.`
            : "";

        if (comparison && comparison.baselineMedianShare > 0) {
            const direction = comparison.deltaFromMedian >= 0 ? "above" : "below";
            const icon = comparison.deltaFromMedian > 0 ? "Alert:" : "Good:";
            return `${icon} ${categoryMatch.name}: ${formatCurrency(categoryMatch.total)} (${formatPercent(categoryMatch.share)} of spend). That is ${direction} your usual level by ${formatPercent(Math.abs(comparison.deltaFromMedian))}.${incomeContext}`;
        }

        return `You spent ${formatCurrency(categoryMatch.total)} on ${categoryMatch.name}, which is ${formatPercent(categoryMatch.share)} of your logged spend.${incomeContext}`;
    }

    if (/(what percent of income|share of income|income on food|income on)/.test(q) && categoryMatch) {
        const comparison = ruleInsights.categoryComparisons.find((item) => item.name === categoryMatch.name);
        if (comparison?.incomeShare === null || comparison?.incomeShare === undefined) {
            return "I need your income in the profile before I can express category spending as a share of income.";
        }

        return `${categoryMatch.name} is currently using ${formatPercent(comparison.incomeShare)} of your income.`;
    }

    if (/(overspending|over budget|too much)/.test(q)) {
        const leadAlert = ruleInsights.alerts[0];
        if (leadAlert) {
            return buildAdvisorSnapshot({
                alerts: [leadAlert],
                positives: []
            }, { limit: 1 });
        }
        return "I do not see a strong overspending trend right now. Your spending, income pressure, and savings target look reasonably aligned.";
    }

    if (/(which category is too high|highest category|too high)/.test(q) && /(category|spending|spend)/.test(q)) {
        const flaggedCategory = ruleInsights.categoryComparisons.find((item) => item.status === "well-above" || item.status === "above");
        if (flaggedCategory) {
            return `${flaggedCategory.name} is the clearest category above your usual level. Your share is ${formatPercent(flaggedCategory.userShare)} versus your usual level near ${formatPercent(flaggedCategory.baselineMedianShare)}.`;
        }
        return "No category is materially above your usual level right now.";
    }

    if (/(biggest expenses|largest expenses|top expenses|highest expenses)/.test(q)) {
        const topExpenses = [...userStats.records]
            .sort((left, right) => right.amount - left.amount)
            .slice(0, 3);

        if (!topExpenses.length) {
            return "I do not have enough expense data yet to rank your largest transactions.";
        }

        return [
            "Here are your biggest logged expenses:",
            ...topExpenses.map((expense, index) => `${index + 1}. ${expense.vendor || expense.category} - ${formatCurrency(expense.amount)} on ${expense.dateLabel || expense.date || "unknown date"}`)
        ].join("\n");
    }

    if (/(this month|current month|latest month)/.test(q) && /(spend|expense|spent)/.test(q)) {
        const activeMonth = userStats.monthly.activePeriod || userStats.monthly.latestPeriod;
        if (!activeMonth) {
            return "I do not have enough dated user expenses to calculate a monthly total yet.";
        }
        return `${activeMonth.label} spending is ${formatCurrency(activeMonth.total)} across ${formatNumber(activeMonth.count)} expenses.`;
    }

    if (/(average|avg)/.test(q) && /(expense|spend|transaction)/.test(q)) {
        return `Your average logged expense is ${formatCurrency(userStats.totals.averageExpense)} across ${formatNumber(userStats.totals.expenseCount)} transactions.`;
    }

    if (/(total|overall|all together)/.test(q) && /(spend|expense|spent)/.test(q)) {
        return `Your logged spending totals ${formatCurrency(userStats.totals.totalExpense)} across ${formatNumber(userStats.totals.expenseCount)} expenses.`;
    }

    if (/(what should i improve|what should i focus on|biggest risk|warning|recommend)/.test(q)) {
        const leadItems = [...ruleInsights.alerts, ...ruleInsights.positives].slice(0, 3);
        if (!leadItems.length) {
            return "The comparison does not show any strong warnings right now. Keep logging expenses and tracking your profile so I can stay sharp.";
        }

        return buildAdvisorSnapshot({
            alerts: ruleInsights.alerts,
            positives: ruleInsights.positives
        });
    }

    if (/(baseline|reference).*(month|monthly|typical)/.test(q)) {
        return `Your usual monthly spending pattern is around ${formatCurrency(baseline.monthly.totalDistribution.median)}. I only use that as a reference to judge your own behavior.`;
    }

    return null;
}

export function buildGeminiSystemInstruction(snapshot, ruleInsights) {
    const topCategories = snapshot.userStats.categories.list.slice(0, 5)
        .map((item) => {
            const baselineCategory = snapshot.baseline.categories.byName.get(item.name);
            const baselineMedian = baselineCategory?.shareDistribution.median ?? 0;
            return `${item.name}: user=${formatCurrency(item.total)} (${formatPercent(item.share)}), reference median share=${formatPercent(baselineMedian)}`;
        })
        .join("\n");

    const monthlyTrend = snapshot.userStats.monthly.trend.slice(-6)
        .map((item) => `${item.label}: user=${formatCurrency(item.total)} from ${formatNumber(item.count)} expenses`)
        .join("\n");

    return `You are FinanceAgent AI, a personal finance assistant that must reason from supplied analysis, not invented facts.

Rules:
1. Stay inside personal finance, budgeting, saving, cash flow, and investment planning topics.
2. Never fabricate dataset details. If the context is missing something, say so plainly.
3. ALWAYS respond in 10 or 15 lines MAX. No exceptions. If you're going over, cut it.
4. Use bullet points (•) for ALL insights — never write long paragraphs.
5. Use 1 or 2 relevant emojis per response (e.g. ✅ 📉 💡 ⚠️ 📈) — not on every line, just where it adds clarity.
6. Start with ONE short sentence summarizing the answer, then bullets, then ONE action line at the end.
7. Never write "Next Steps:", "Important Caveat:", or "Disclaimer:" sections — just say it naturally.
8. Treat the CSV as a hidden reference corpus only. Do not present it as the user's own data.
9. Combine baseline, user expenses, and financial profile in your reasoning — but show only the useful output.
10. Sound like a sharp, friendly advisor texting you — not a financial report.

Structured finance context:
- Active Month: ${snapshot.userStats.metadata.activeMonthLabel || "Unknown"}
- User monthly income: ${formatCurrency(snapshot.userStats.profile.income)}
- User current savings: ${formatCurrency(snapshot.userStats.profile.savings)}
- User monthly savings goal: ${formatCurrency(snapshot.userStats.profile.goal)}
- User mandatory monthly expenses: ${formatCurrency(snapshot.userStats.profile.mandatoryTotal)}
- User current spend: ${formatCurrency(snapshot.userStats.comparisons.currentSpend)}
- User current monthly outflow: ${formatCurrency(snapshot.userStats.comparisons.totalMonthlyOutflow)}
- User savings capacity: ${snapshot.userStats.comparisons.savingsCapacity !== null ? formatCurrency(snapshot.userStats.comparisons.savingsCapacity) : "Not available"}
- User savings rate: ${snapshot.userStats.comparisons.actualSavingsRate !== null ? formatPercent(snapshot.userStats.comparisons.actualSavingsRate) : "Not available"}
- User target savings rate: ${snapshot.userStats.comparisons.targetSavingsRate !== null ? formatPercent(snapshot.userStats.comparisons.targetSavingsRate) : "Not available"}
- Hidden baseline median month: ${formatCurrency(snapshot.baseline.monthly.totalDistribution.median)}
- Hidden baseline median transaction: ${formatCurrency(snapshot.baseline.summary.medianTransaction)}
- Health score: ${ruleInsights.healthScore.value}/100 (${ruleInsights.healthScore.band})

User category comparison:
${topCategories || "No categories available."}

User monthly trend:
${monthlyTrend || "Not enough date data for a monthly trend."}

Rule engine findings:
${formatRuleSummary(ruleInsights)}`;
}

function convertConversationToGroqFormat(conversationHistory) {
    return conversationHistory.slice(-12).map((msg) => ({
        role: msg.role === "model" ? "assistant" : "user",
        content: msg.parts?.[0]?.text || ""
    }));
}

export function buildGroqSystemInstruction(snapshot, ruleInsights) {
    const topCategories = snapshot.userStats.categories.list.slice(0, 5)
        .map((item) => {
            const baselineCategory = snapshot.baseline.categories.byName.get(item.name);
            const baselineMedian = baselineCategory?.shareDistribution.median ?? 0;
            return `${item.name}: user=${formatCurrency(item.total)} (${formatPercent(item.share)}), reference median share=${formatPercent(baselineMedian)}`;
        })
        .join("\n");

    const monthlyTrend = snapshot.userStats.monthly.trend.slice(-6)
        .map((item) => `${item.label}: user=${formatCurrency(item.total)} from ${formatNumber(item.count)} expenses`)
        .join("\n");

    return `You are FinanceAgent AI, a personal finance assistant that must reason from supplied analysis, not invented facts.

Rules:
1. Stay inside personal finance, budgeting, saving, cash flow, and investment planning topics.
2. Never fabricate dataset details. If the context is missing something, say so plainly.
3. ALWAYS respond in 10 or 15 lines MAX. No exceptions. If you're going over, cut it.
4. Use bullet points (•) for ALL insights — never write long paragraphs.
5. Use 1 or 2 relevant emojis per response (e.g. ✅ 📉 💡 ⚠️ 📈) — not on every line, just where it adds clarity.
6. Start with ONE short sentence summarizing the answer, then bullets, then ONE action line at the end.
7. Never write "Next Steps:", "Important Caveat:", or "Disclaimer:" sections — just say it naturally.
8. Treat the CSV as a hidden reference corpus only. Do not present it as the user's own data.
9. Combine baseline, user expenses, and financial profile in your reasoning — but show only the useful output.
10. Sound like a sharp, friendly advisor texting you — not a financial report.

Structured finance context:
- Active Month: ${snapshot.userStats.metadata.activeMonthLabel || "Unknown"}
- User monthly income: ${formatCurrency(snapshot.userStats.profile.income)}
- User current savings: ${formatCurrency(snapshot.userStats.profile.savings)}
- User monthly savings goal: ${formatCurrency(snapshot.userStats.profile.goal)}
- User mandatory monthly expenses: ${formatCurrency(snapshot.userStats.profile.mandatoryTotal)}
- User current spend: ${formatCurrency(snapshot.userStats.comparisons.currentSpend)}
- User current monthly outflow: ${formatCurrency(snapshot.userStats.comparisons.totalMonthlyOutflow)}
- User savings capacity: ${snapshot.userStats.comparisons.savingsCapacity !== null ? formatCurrency(snapshot.userStats.comparisons.savingsCapacity) : "Not available"}
- User savings rate: ${snapshot.userStats.comparisons.actualSavingsRate !== null ? formatPercent(snapshot.userStats.comparisons.actualSavingsRate) : "Not available"}
- User target savings rate: ${snapshot.userStats.comparisons.targetSavingsRate !== null ? formatPercent(snapshot.userStats.comparisons.targetSavingsRate) : "Not available"}
- Hidden baseline median month: ${formatCurrency(snapshot.baseline.monthly.totalDistribution.median)}`;
}

export async function requestGroqResponse({ apiKey, systemInstruction, conversationHistory }) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const messages = [
        { role: "system", content: systemInstruction },
        ...convertConversationToGroqFormat(conversationHistory)
    ];

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            max_tokens: 1024,
            temperature: 0.7
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "Groq API request failed.");
    }

    const aiText = data.choices?.[0]?.message?.content;
    if (!aiText) {
        throw new Error("Groq returned an empty response.");
    }

    return aiText;
}

// Keep old function for backward compatibility, but delegate to new Groq function
export async function requestGeminiResponse({ apiKey, systemInstruction, conversationHistory }) {
    return requestGroqResponse({ apiKey, systemInstruction, conversationHistory });
}
