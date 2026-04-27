import { formatMonthLabelFromKey } from "./formatters.js";
import { buildMonthContext, buildMonthContextFromDate } from "./monthlyManager.js";
import {
    buildWeeklyKey,
    computeDelta,
    getMonthKey,
    parseMandatoryLines,
    sortTotalsDescending,
    summarizeDistribution,
    toNumber
} from "./stats.js";

const PROFILE_FIELDS = ["income", "savings", "goal", "mandatory"];

function normalizeUserExpense(expense) {
    const date = expense.date ? new Date(`${expense.date}T12:00:00`) : null;
    const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
    const monthContext = validDate
        ? buildMonthContextFromDate(validDate)
        : expense.month && expense.year
            ? buildMonthContext(expense.month, expense.year)
            : null;
    const monthKey = monthContext?.monthKey || (validDate ? getMonthKey(validDate) : null);

    return {
        id: String(expense.id),
        date: validDate,
        dateLabel: validDate ? validDate.toISOString().slice(0, 10) : expense.date || "",
        monthKey,
        month: monthContext?.month || expense.month || "",
        year: monthContext?.year || expense.year || null,
        amount: toNumber(expense.amount),
        category: expense.category || "Uncategorized",
        vendor: expense.vendor || "",
        description: expense.description || "",
        paymentMode: expense.paymentMode || "",
        transactionType: expense.transactionType || expense.type || "expense",
        raw: expense
    };
}

function buildProfileState(profile = {}) {
    const raw = {
        income: String(profile.income ?? "").trim(),
        savings: String(profile.savings ?? "").trim(),
        goal: String(profile.goal ?? "").trim(),
        mandatory: String(profile.mandatory ?? "").trim()
    };
    const missingFields = PROFILE_FIELDS.filter((field) => raw[field] === "");

    const parsed = {
        ...raw,
        income: toNumber(raw.income),
        goal: toNumber(raw.goal),
        savings: toNumber(raw.savings),
        mandatoryText: raw.mandatory
    };

    parsed.mandatoryItems = parseMandatoryLines(parsed.mandatoryText);
    parsed.mandatoryTotal = parsed.mandatoryItems.reduce((sum, item) => sum + item.amount, 0);
    parsed.missingFields = missingFields;
    parsed.isComplete = missingFields.length === 0;

    return parsed;
}

export function buildUserStats({ manualExpenses = [], profile = {}, activeMonthContext = null }) {
    const allRecords = manualExpenses
        .map(normalizeUserExpense)
        .filter((record) => Number.isFinite(record.amount) && record.amount > 0);
    const incomeRecords = allRecords.filter((record) => record.transactionType === "income");
    const investmentRecords = allRecords.filter((record) => record.transactionType === "investment");
    const records = allRecords.filter((record) => record.transactionType === "expense");

    const parsedProfile = buildProfileState(profile);

    const totalExpense = records.reduce((sum, record) => sum + record.amount, 0);
    const averageExpense = records.length ? totalExpense / records.length : 0;
    const biggestExpense = records.reduce((largest, record) => {
        return !largest || record.amount > largest.amount ? record : largest;
    }, null);

    const categoryMap = new Map();
    const vendorMap = new Map();
    const monthMap = new Map();
    const weekMap = new Map();
    const dateSet = new Set();

    records.forEach((record) => {
        const categoryKey = record.category || "Uncategorized";
        const categoryValue = categoryMap.get(categoryKey) || { total: 0, count: 0 };
        categoryValue.total += record.amount;
        categoryValue.count += 1;
        categoryMap.set(categoryKey, categoryValue);

        if (record.vendor) {
            const vendorValue = vendorMap.get(record.vendor) || { total: 0, count: 0 };
            vendorValue.total += record.amount;
            vendorValue.count += 1;
            vendorMap.set(record.vendor, vendorValue);
        }

        if (record.monthKey) {
            const monthValue = monthMap.get(record.monthKey) || { total: 0, count: 0, categories: new Map() };
            monthValue.total += record.amount;
            monthValue.count += 1;
            const monthCategory = monthValue.categories.get(categoryKey) || { total: 0, count: 0 };
            monthCategory.total += record.amount;
            monthCategory.count += 1;
            monthValue.categories.set(categoryKey, monthCategory);
            monthMap.set(record.monthKey, monthValue);
        }

        if (record.date) {
            const weekKey = buildWeeklyKey(record.date);
            const weekValue = weekMap.get(weekKey) || { total: 0, count: 0 };
            weekValue.total += record.amount;
            weekValue.count += 1;
            weekMap.set(weekKey, weekValue);
            dateSet.add(record.date.toISOString().slice(0, 10));
        }
    });

    const categoryBreakdown = sortTotalsDescending(categoryMap).map((item) => ({
        ...item,
        share: totalExpense ? item.total / totalExpense : 0
    }));
    const vendorBreakdown = sortTotalsDescending(vendorMap).map((item) => ({
        ...item,
        share: totalExpense ? item.total / totalExpense : 0
    }));
    const monthlyTrend = Array.from(monthMap.entries())
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => ({
            key,
            label: formatMonthLabelFromKey(key),
            total: value.total,
            count: value.count,
            categories: value.categories
        }));
    const weeklyTrend = Array.from(weekMap.entries())
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => ({
            key,
            total: value.total,
            count: value.count
        }));

    const latestPeriod = monthlyTrend[monthlyTrend.length - 1] || null;
    const previousPeriod = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2] : null;
    const resolvedActiveMonth = activeMonthContext?.month && activeMonthContext?.year
        ? buildMonthContext(activeMonthContext.month, activeMonthContext.year)
        : null;
    const activePeriod = resolvedActiveMonth
        ? monthlyTrend.find((item) => item.key === resolvedActiveMonth.monthKey) || {
            key: resolvedActiveMonth.monthKey,
            label: resolvedActiveMonth.label,
            total: 0,
            count: 0,
            categories: new Map()
        }
        : latestPeriod;

    const categoryMonthSeries = new Map();
    categoryBreakdown.forEach((category) => {
        const series = monthlyTrend.map((month) => ({
            key: month.key,
            total: month.categories.get(category.name)?.total || 0,
            share: month.total ? (month.categories.get(category.name)?.total || 0) / month.total : 0
        }));
        categoryMonthSeries.set(category.name, series);
    });

    const currentSpend = activePeriod?.total ?? latestPeriod?.total ?? totalExpense;
    const currentPeriodLabel = activePeriod?.label ?? latestPeriod?.label ?? "Current spending";
    const totalMonthlyOutflow = currentSpend + parsedProfile.mandatoryTotal;
    const discretionaryBudget = parsedProfile.income > 0
        ? Math.max(parsedProfile.income - parsedProfile.mandatoryTotal, 0)
        : null;
    const afterGoalBudget = parsedProfile.income > 0
        ? parsedProfile.income - parsedProfile.mandatoryTotal - parsedProfile.goal
        : null;
    const savingsCapacity = parsedProfile.income > 0
        ? parsedProfile.income - totalMonthlyOutflow
        : null;
    const expenseToIncomeRatio = parsedProfile.income > 0 ? currentSpend / parsedProfile.income : null;
    const totalBudgetLoad = parsedProfile.income > 0 ? totalMonthlyOutflow / parsedProfile.income : null;
    const actualSavingsRate = parsedProfile.income > 0 ? savingsCapacity / parsedProfile.income : null;
    const targetSavingsRate = parsedProfile.income > 0 && parsedProfile.goal > 0
        ? parsedProfile.goal / parsedProfile.income
        : null;
    const savingsGap = parsedProfile.goal > 0 && savingsCapacity !== null
        ? parsedProfile.goal - savingsCapacity
        : null;
    const savingsGoalCoverage = parsedProfile.goal > 0 && savingsCapacity !== null
        ? savingsCapacity / parsedProfile.goal
        : null;
    const discretionaryUsage = discretionaryBudget !== null && discretionaryBudget > 0
        ? currentSpend / discretionaryBudget
        : null;
    const existingSavingsCoverage = totalMonthlyOutflow > 0
        ? parsedProfile.savings / totalMonthlyOutflow
        : null;

    return {
        profile: parsedProfile,
        allRecords,
        incomeRecords,
        investmentRecords,
        records,
        totals: {
            totalExpense,
            uploadedIncome: incomeRecords.reduce((sum, record) => sum + record.amount, 0),
            investmentTotal: investmentRecords.reduce((sum, record) => sum + record.amount, 0),
            averageExpense,
            transactionCount: allRecords.length,
            expenseCount: records.length,
            biggestExpense,
            activeMonths: monthlyTrend.length,
            activeWeeks: weeklyTrend.length,
            medianTransaction: summarizeDistribution(records.map((record) => record.amount)).median
        },
        categories: {
            list: categoryBreakdown,
            byName: new Map(categoryBreakdown.map((category) => [category.name, category])),
            monthlySeries: categoryMonthSeries
        },
        vendors: {
            list: vendorBreakdown,
            byName: new Map(vendorBreakdown.map((vendor) => [vendor.name, vendor]))
        },
        monthly: {
            trend: monthlyTrend.map((month) => ({
                key: month.key,
                label: month.label,
                total: month.total,
                count: month.count
            })),
            activePeriod,
            latestPeriod,
            previousPeriod
        },
        expenseFrequency: {
            transactionsPerMonth: monthlyTrend.length ? records.length / monthlyTrend.length : records.length,
            transactionsPerWeek: weeklyTrend.length ? records.length / weeklyTrend.length : records.length,
            activeDays: dateSet.size
        },
        comparisons: {
            currentVsPrevious: latestPeriod && previousPeriod ? computeDelta(latestPeriod.total, previousPeriod.total) : null,
            monthlyAverage: monthlyTrend.length
                ? monthlyTrend.reduce((sum, month) => sum + month.total, 0) / monthlyTrend.length
                : 0,
            currentSpend,
            currentPeriodLabel,
            totalMonthlyOutflow,
            discretionaryBudget,
            afterGoalBudget,
            expenseToIncomeRatio,
            totalBudgetLoad,
            savingsCapacity,
            actualSavingsRate,
            targetSavingsRate,
            savingsGap,
            savingsGoalCoverage,
            discretionaryUsage,
            existingSavingsCoverage
        },
        investments: {
            total: investmentRecords.reduce((sum, record) => sum + record.amount, 0),
            list: sortTotalsDescending(investmentRecords.reduce((map, record) => {
                const key = record.category || "Investment";
                const value = map.get(key) || { total: 0, count: 0 };
                value.total += record.amount;
                value.count += 1;
                map.set(key, value);
                return map;
            }, new Map()))
        },
        metadata: {
            hasRecords: records.length > 0,
            hasTransactions: allRecords.length > 0,
            hasDates: monthlyTrend.length > 0,
            hasVendors: vendorBreakdown.length > 0,
            activeMonthLabel: currentPeriodLabel,
            activeMonthKey: resolvedActiveMonth?.monthKey || activePeriod?.key || null
        }
    };
}
