import { formatCurrency, formatPercent } from "./formatters.js";

function addItem(list, item) {
    list.push(item);
}

function getCategoryTolerance(referenceCategory) {
    if (!referenceCategory) {
        return 0;
    }

    return Math.max(referenceCategory.shareDistribution.iqr, referenceCategory.shareDistribution.stdDev);
}

function calculateHealthScore(baseline, userStats, alerts) {
    if (!userStats.metadata.hasRecords) {
        return {
            value: 0,
            band: "No User Data",
            summary: "Log user expenses to compute a profile-aware health score."
        };
    }

    let score = 78;
    if (!userStats.profile.isComplete) {
        score -= 12;
    }

    const severityPenalty = alerts.reduce((sum, alert) => {
        if (alert.severity === "high") {
            return sum + 10;
        }
        if (alert.severity === "medium") {
            return sum + 6;
        }
        return sum + 3;
    }, 0);
    score -= severityPenalty;

    const topCategory = userStats.categories.list[0];
    const referenceDominantRange = baseline.monthly.dominantShareDistribution.q3;
    if (topCategory && referenceDominantRange && topCategory.share <= referenceDominantRange) {
        score += 5;
    }

    if (userStats.comparisons.totalBudgetLoad !== null) {
        if (userStats.comparisons.totalBudgetLoad > 1) {
            score -= 12;
        } else if (userStats.comparisons.totalBudgetLoad < 0.9) {
            score += 4;
        }
    }

    if (userStats.comparisons.targetSavingsRate !== null && userStats.comparisons.actualSavingsRate !== null) {
        score += userStats.comparisons.actualSavingsRate >= userStats.comparisons.targetSavingsRate ? 6 : -6;
    }

    const value = Math.max(0, Math.min(100, Math.round(score)));
    const band = value >= 80 ? "Strong" : value >= 60 ? "Stable" : value >= 40 ? "Watchlist" : "At Risk";

    return {
        value,
        band,
        summary: `Health score is ${value}/100 (${band.toLowerCase()}) based on your spending mix, income pressure, savings target coverage, and how your behavior compares with your usual spending pattern.`
    };
}

function buildProfileReminder(userStats) {
    if (userStats.profile.isComplete) {
        return null;
    }

    const missing = userStats.profile.missingFields.join(", ");
    return {
        id: "profile-missing",
        severity: "low",
        title: "Complete your financial profile",
        message: "The advisor can already compare your expenses with your usual spending pattern, but affordability and savings checks are still limited.",
        reason: `These profile fields are missing: ${missing}.`,
        action: "Open the profile menu in the navbar and fill in your financial profile."
    };
}

export function generateComparisonInsights({ baseline, userStats }) {
    if (!baseline.metadata.hasRecords) {
        return {
            alerts: [
                {
                    id: "no-baseline",
                    severity: "low",
                    title: "Learned spending pattern unavailable",
                    message: "The app could not build a rolling 12-month spending pattern because the learning window has no valid expense rows.",
                    reason: "Without a learned baseline window, comparison rules cannot fire.",
                    action: "Reload the training months or complete user months so the learning window can rebuild."
                }
            ],
            positives: [],
            categoryComparisons: [],
            healthScore: {
                value: 0,
                band: "No Baseline",
                summary: "Load a reference dataset to compare the user against learned norms."
            }
        };
    }

    const alerts = [];
    const positives = [];

    const profileReminder = buildProfileReminder(userStats);
    if (profileReminder) {
        addItem(alerts, profileReminder);
    }

    if (!userStats.metadata.hasRecords) {
        addItem(alerts, {
            id: "no-user-expenses",
            severity: "low",
            title: "No user expenses logged yet",
            message: "Your usual spending pattern is ready, but there are no current expenses to compare against it.",
            reason: "Reference learning is separate from the user's own expense profile.",
            action: "Add or import expenses to start comparing your current spending with your usual pattern."
        });

        return {
            alerts,
            positives,
            categoryComparisons: [],
            healthScore: calculateHealthScore(baseline, userStats, alerts)
        };
    }

    const categoryNames = new Set([
        ...baseline.categories.list.map((category) => category.name),
        ...userStats.categories.list.map((category) => category.name)
    ]);

    const categoryComparisons = Array.from(categoryNames).map((name) => {
        const baselineCategory = baseline.categories.byName.get(name) || null;
        const userCategory = userStats.categories.byName.get(name) || { name, total: 0, count: 0, share: 0 };
        const baselineMedian = baselineCategory?.shareDistribution.median ?? 0;
        const baselineQ1 = baselineCategory?.shareDistribution.q1 ?? 0;
        const baselineQ3 = baselineCategory?.shareDistribution.q3 ?? 0;
        const baselineUpperFence = baselineCategory?.shareDistribution.upperFence ?? 0;
        const tolerance = getCategoryTolerance(baselineCategory);
        const gapToMedian = userCategory.share - baselineMedian;

        let status = "within";
        if (!baselineCategory) {
            status = "new-user-category";
        } else if (userCategory.share > baselineUpperFence && baselineCategory.shareDistribution.count > 1) {
            status = "well-above";
        } else if (userCategory.share > baselineQ3 + tolerance * 0.1) {
            status = "above";
        } else if (userCategory.share < baselineQ1 && userCategory.share > 0) {
            status = "below";
        }

        return {
            name,
            status,
            userTotal: userCategory.total,
            userCount: userCategory.count,
            userShare: userCategory.share,
            baselineMedianShare: baselineMedian,
            baselineQ1Share: baselineQ1,
            baselineQ3Share: baselineQ3,
            deltaFromMedian: gapToMedian,
            incomeShare: userStats.profile.income > 0 ? userCategory.total / userStats.profile.income : null
        };
    }).sort((left, right) => Math.abs(right.deltaFromMedian) - Math.abs(left.deltaFromMedian));

    categoryComparisons
        .filter((row) => row.userShare > 0)
        .forEach((row) => {
            if (row.status === "well-above" || row.status === "above") {
                const incomeContext = row.incomeShare !== null
                    ? ` It is also using ${formatPercent(row.incomeShare)} of your income.`
                    : "";
                addItem(alerts, {
                    id: `category-${row.name}`,
                    severity: row.status === "well-above" ? "high" : "medium",
                    title: `${row.name} is above your usual spending`,
                    message: `${row.name} is above your usual level by ${formatPercent(row.deltaFromMedian)} of your spending mix.${incomeContext}`,
                    reason: `Your share is ${formatPercent(row.userShare)} versus a reference median of ${formatPercent(row.baselineMedianShare)} and an upper range near ${formatPercent(row.baselineQ3Share)}.`,
                    action: `Review the biggest ${row.name} transactions and decide whether this category should be capped next month.`
                });
            }
        });

    if (userStats.monthly.latestPeriod) {
        const userLatest = userStats.monthly.latestPeriod.total;
        const monthlyMedian = baseline.monthly.totalDistribution.median;
        const monthlyQ3 = baseline.monthly.totalDistribution.q3;

        if (userLatest > monthlyQ3 && baseline.monthly.totalDistribution.count > 1) {
            addItem(alerts, {
                id: "user-month-above-baseline",
                severity: userLatest > baseline.monthly.totalDistribution.upperFence ? "high" : "medium",
                title: "This month is above your usual monthly pattern",
                message: `${userStats.monthly.latestPeriod.label} is ${formatCurrency(userLatest - monthlyMedian)} above your usual month.`,
                reason: `Your latest month is ${formatCurrency(userLatest)} versus a reference median of ${formatCurrency(monthlyMedian)} and upper quartile of ${formatCurrency(monthlyQ3)}.`,
                action: "Break the month into categories and cut the ones that sit furthest above your usual level."
            });
        } else {
            addItem(positives, {
                id: "user-month-within-baseline",
                severity: "positive",
                title: "This month is staying close to your usual range",
                message: `${userStats.monthly.latestPeriod.label} is still within the expected spend envelope.`,
                reason: `Your latest month is ${formatCurrency(userLatest)} compared with a reference median of ${formatCurrency(monthlyMedian)}.`,
                action: "Keep using that month as your benchmark for future planning."
            });
        }
    }

    if (userStats.comparisons.currentVsPrevious !== null && baseline.monthly.changeDistribution.count > 0) {
        const referenceQ3 = baseline.monthly.changeDistribution.q3;
        if (userStats.comparisons.currentVsPrevious > referenceQ3) {
            addItem(alerts, {
                id: "month-over-month-growth",
                severity: userStats.comparisons.currentVsPrevious > baseline.monthly.changeDistribution.upperFence ? "high" : "medium",
                title: "Month-over-month growth is faster than the reference pattern",
                message: `Your latest month grew by ${formatPercent(userStats.comparisons.currentVsPrevious)}.`,
                reason: `Reference month-over-month growth usually stays at or below about ${formatPercent(referenceQ3)}.`,
                action: "Look for the category jump causing the growth before it becomes a habit."
            });
        }
    }

    if (userStats.profile.income > 0 && userStats.comparisons.totalBudgetLoad !== null) {
        if (userStats.comparisons.totalBudgetLoad > 1) {
            addItem(alerts, {
                id: "income-pressure",
                severity: "high",
                title: "Your expenses exceed your income",
                message: `Your current monthly outflow is ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)} against income of ${formatCurrency(userStats.profile.income)}.`,
                reason: `That puts your total budget load at ${formatPercent(userStats.comparisons.totalBudgetLoad)} of income.`,
                action: "Reduce flexible spending immediately or lower fixed obligations before this becomes debt pressure."
            });
        } else {
            addItem(positives, {
                id: "income-coverage",
                severity: "positive",
                title: "Your income still covers current outflow",
                message: `Your current monthly outflow is below income, leaving ${formatCurrency(userStats.comparisons.savingsCapacity)} before planned savings.`,
                reason: `Budget load is ${formatPercent(userStats.comparisons.totalBudgetLoad)} of income.`,
                action: "Protect that margin so it does not get absorbed by convenience spending."
            });
        }
    }

    if (userStats.comparisons.targetSavingsRate !== null && userStats.comparisons.actualSavingsRate !== null) {
        if (userStats.comparisons.actualSavingsRate < userStats.comparisons.targetSavingsRate) {
            addItem(alerts, {
                id: "savings-rate",
                severity: userStats.comparisons.savingsCapacity < 0 ? "high" : "medium",
                title: "Your savings rate is below target",
                message: `You are currently saving at ${formatPercent(userStats.comparisons.actualSavingsRate)} versus a target of ${formatPercent(userStats.comparisons.targetSavingsRate)}.`,
                reason: `Your current monthly margin is ${formatCurrency(userStats.comparisons.savingsCapacity)} against a savings goal of ${formatCurrency(userStats.profile.goal)}.`,
                action: "Trim categories that are above your usual level or adjust your goal timeline to restore a realistic monthly savings rate."
            });
        } else {
            addItem(positives, {
                id: "savings-rate-on-track",
                severity: "positive",
                title: "Your savings rate is on track",
                message: `You are currently saving at ${formatPercent(userStats.comparisons.actualSavingsRate)} against a target of ${formatPercent(userStats.comparisons.targetSavingsRate)}.`,
                reason: `Your current monthly margin is ${formatCurrency(userStats.comparisons.savingsCapacity)} and your goal is ${formatCurrency(userStats.profile.goal)}.`,
                action: "Keep reserving that amount early in the month so spending does not swallow it."
            });
        }
    }

    if (userStats.comparisons.afterGoalBudget !== null) {
        if (userStats.comparisons.currentSpend > Math.max(userStats.comparisons.afterGoalBudget, 0)) {
            addItem(alerts, {
                id: "goal-crowding",
                severity: "medium",
                title: "Current spending is crowding out your savings goal",
                message: `Your variable spending is leaving less room than planned for your monthly savings target.`,
                reason: `After mandatory costs and your goal, the recommended flexible-spend room is ${formatCurrency(Math.max(userStats.comparisons.afterGoalBudget, 0))}, but current spending is ${formatCurrency(userStats.comparisons.currentSpend)}.`,
                action: "Treat the gap as the amount you need to cut from flexible categories this month."
            });
        }
    }

    if (userStats.comparisons.existingSavingsCoverage !== null && userStats.profile.savings > 0) {
        if (userStats.comparisons.existingSavingsCoverage >= 1) {
            addItem(positives, {
                id: "savings-buffer",
                severity: "positive",
                title: "You have at least one month of current outflow in savings",
                message: `Current savings cover about ${userStats.comparisons.existingSavingsCoverage.toFixed(1)} months of your latest outflow.`,
                reason: `Savings are ${formatCurrency(userStats.profile.savings)} while current monthly outflow is ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)}.`,
                action: "Keep building that cushion while the budget is still manageable."
            });
        } else {
            addItem(alerts, {
                id: "savings-buffer-low",
                severity: "low",
                title: "Your savings buffer is thin",
                message: `Current savings cover less than one month of your latest outflow.`,
                reason: `Savings are ${formatCurrency(userStats.profile.savings)} while current monthly outflow is ${formatCurrency(userStats.comparisons.totalMonthlyOutflow)}.`,
                action: "Give extra priority to rebuilding your savings cushion while also protecting your monthly goal."
            });
        }
    }

    const healthScore = calculateHealthScore(baseline, userStats, alerts);

    return {
        alerts,
        positives,
        categoryComparisons,
        healthScore
    };
}
