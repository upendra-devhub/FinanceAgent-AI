import { formatCurrency, formatNumber, formatPercent } from "./formatters.js";

function findMatch(question, candidates) {
    const normalizedQuestion = question.toLowerCase();
    return candidates.find((candidate) => normalizedQuestion.includes(candidate.name.toLowerCase())) || null;
}

function formatRuleSummary(ruleInsights) {
    const priorityItems = [...ruleInsights.alerts, ...ruleInsights.positives].slice(0, 5);
    if (!priorityItems.length) {
        return "No rule-based insights available yet.";
    }

    return priorityItems
        .map((item) => `- ${item.title}: ${item.message} Next move: ${item.action}`)
        .join("\n");
}

export function buildAutomatedInsightDigest(snapshot, ruleInsights) {
    if (!snapshot.baseline.metadata.hasRecords) {
        return {
            signature: "no-baseline",
            text: [
                "I could not learn a spending baseline from the reference CSV yet.",
                "Reason: the dataset does not contain enough valid expense rows for comparison.",
                "Next step: restore the bundled baseline so I can compare your expenses against a learned pattern."
            ].join("\n")
        };
    }

    if (!snapshot.userStats.metadata.hasRecords) {
        return {
            signature: "no-user-expenses",
            text: [
                "Add expenses to start comparing against the learned baseline.",
                "Reason: your financial profile is ready, but there are no user expenses to judge yet.",
                "Next step: add or import expenses and I will tell you what is affordable, what is above baseline, and whether your savings goal is safe."
            ].join("\n")
        };
    }

    const orderedAlerts = [...ruleInsights.alerts].sort((left, right) => {
        const rank = { high: 3, medium: 2, low: 1 };
        return (rank[right.severity] || 0) - (rank[left.severity] || 0);
    });

    if (orderedAlerts.length) {
        const focusItems = orderedAlerts.slice(0, 3)
            .map((item, index) => `${index + 1}. ${item.title}\nWhy it triggered: ${item.reason}\nNext step: ${item.action}`)
            .join("\n\n");

        return {
            signature: JSON.stringify({
                kind: "alerts",
                expenseCount: snapshot.userStats.totals.expenseCount,
                totalOutflow: Math.round(snapshot.userStats.comparisons.totalMonthlyOutflow || 0),
                alerts: orderedAlerts.slice(0, 3).map((item) => item.id)
            }),
            text: `Here is what stands out right now:\n\n${focusItems}`
        };
    }

    const positiveItems = ruleInsights.positives.slice(0, 2)
        .map((item, index) => `${index + 1}. ${item.title}\nWhy: ${item.reason}\nNext step: ${item.action}`)
        .join("\n\n");

    return {
        signature: JSON.stringify({
            kind: "positive",
            expenseCount: snapshot.userStats.totals.expenseCount,
            totalOutflow: Math.round(snapshot.userStats.comparisons.totalMonthlyOutflow || 0),
            positives: ruleInsights.positives.slice(0, 2).map((item) => item.id)
        }),
        text: positiveItems
            ? `Your finances look stable right now.\n\n${positiveItems}`
            : "Your spending, income pressure, and savings target all look stable right now."
    };
}

export function tryAnswerDirect(question, snapshot, ruleInsights) {
    const q = question.toLowerCase();
    const userStats = snapshot.userStats;
    const baseline = snapshot.baseline;

    if (!userStats.metadata.hasRecords) {
        if (/(spend|expense|budget|category|trend|vendor|month|save|saving|income)/.test(q)) {
            return "I have your profile and the hidden baseline ready, but I still need user expenses before I can analyze your real spending behavior.";
        }
        return null;
    }

    if (/(expenses exceed income|over income|above income|can i afford)/.test(q)) {
        if (userStats.comparisons.totalBudgetLoad === null) {
            return "I need your financial profile before I can run affordability checks.";
        }

        if (userStats.comparisons.totalBudgetLoad > 1) {
            return `Yes, your current monthly outflow is ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)} against income of ${formatCurrency(userStats.profile.income)}, so expenses are exceeding income.`;
        }

        return `Your current monthly outflow is ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)} against income of ${formatCurrency(userStats.profile.income)}, so you still have ${formatCurrency(userStats.comparisons.savingsCapacity)} left before planned savings.`;
    }

    if (/(savings rate|save rate|saving rate)/.test(q)) {
        if (userStats.comparisons.actualSavingsRate === null) {
            return "I need your financial profile before I can calculate a savings rate.";
        }

        const targetText = userStats.comparisons.targetSavingsRate !== null
            ? ` against a target of ${formatPercent(userStats.comparisons.targetSavingsRate)}`
            : "";
        return `Your current savings rate is ${formatPercent(userStats.comparisons.actualSavingsRate)}${targetText}.`;
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
            return `You spent ${formatCurrency(categoryMatch.total)} on ${categoryMatch.name}, which is ${formatPercent(categoryMatch.share)} of your logged spend. The learned median for this category is ${formatPercent(comparison.baselineMedianShare)}, so you are ${comparison.deltaFromMedian >= 0 ? "above" : "below"} baseline by ${formatPercent(Math.abs(comparison.deltaFromMedian))}.${incomeContext}`;
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
            return `${leadAlert.message} ${leadAlert.reason}`;
        }
        return "I do not see a strong overspending signal right now. Your spending, income pressure, and savings target look reasonably aligned.";
    }

    if (/(which category is too high|highest category|too high)/.test(q) && /(category|spending|spend)/.test(q)) {
        const flaggedCategory = ruleInsights.categoryComparisons.find((item) => item.status === "well-above" || item.status === "above");
        if (flaggedCategory) {
            return `${flaggedCategory.name} is the clearest category above baseline. Your share is ${formatPercent(flaggedCategory.userShare)} versus a learned median of ${formatPercent(flaggedCategory.baselineMedianShare)}.`;
        }
        return "No category is materially above the learned baseline right now.";
    }

    if (/(this month|current month|latest month)/.test(q) && /(spend|expense|spent)/.test(q)) {
        const activeMonth = userStats.monthly.currentCalendarPeriod || userStats.monthly.latestPeriod;
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

        return leadItems
            .map((item, index) => `${index + 1}. ${item.title}: ${item.message} ${item.action}`)
            .join("\n");
    }

    if (/(baseline|reference).*(month|monthly|typical)/.test(q)) {
        return `The hidden reference baseline models a typical month around ${formatCurrency(baseline.monthly.totalDistribution.median)}, but I only use that internally to judge your own behavior.`;
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
3. Keep answers concise, practical, and under 14 lines.
4. Treat the CSV as a hidden reference corpus only. Do not present it as the user's own data.
5. Combine three things in every explanation: hidden baseline, user expenses, and the financial profile.
6. Use direct numbers from the structured context below whenever possible.

Structured finance context:
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

export async function requestGeminiResponse({ apiKey, systemInstruction, conversationHistory }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: conversationHistory.slice(-12)
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "Gemini API request failed.");
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
        throw new Error("Gemini returned an empty response.");
    }

    return aiText;
}
