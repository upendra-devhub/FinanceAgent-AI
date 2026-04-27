import { toNumber } from "./stats.js";

export const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

function toIntegerYear(value) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toMonthIndex(month) {
    const normalized = String(month ?? "").trim().toLowerCase();
    return MONTH_NAMES.findIndex((item) => item.toLowerCase() === normalized);
}

export function buildMonthContext(month, year) {
    const monthIndex = toMonthIndex(month);
    const parsedYear = toIntegerYear(year);

    if (monthIndex === -1 || parsedYear === null) {
        return getCurrentMonthContext();
    }

    const monthName = MONTH_NAMES[monthIndex];

    return {
        month: monthName,
        year: parsedYear,
        monthIndex,
        monthKey: `${parsedYear}-${String(monthIndex + 1).padStart(2, "0")}`,
        archiveKey: `${monthName}-${parsedYear}`,
        label: `${monthName} ${parsedYear}`
    };
}

export function buildMonthContextFromDate(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return buildMonthContext(MONTH_NAMES[date.getMonth()], date.getFullYear());
}

export function buildMonthContextFromMonthKey(key) {
    const match = String(key ?? "").match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        return null;
    }

    const year = Number.parseInt(match[1], 10);
    const monthIndex = Number.parseInt(match[2], 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) {
        return null;
    }

    return buildMonthContext(MONTH_NAMES[monthIndex], year);
}

export function buildMonthContextFromArchiveKey(key) {
    const match = String(key ?? "").match(/^([A-Za-z]+)-(\d{4})$/);
    if (!match) {
        return null;
    }

    return buildMonthContext(match[1], Number.parseInt(match[2], 10));
}

export function getCurrentMonthContext() {
    return buildMonthContextFromDate(new Date());
}

export function getNextMonthContext(context) {
    const activeContext = context?.month && context?.year
        ? buildMonthContext(context.month, context.year)
        : getCurrentMonthContext();
    const nextDate = new Date(activeContext.year, activeContext.monthIndex + 1, 1, 12);
    return buildMonthContextFromDate(nextDate);
}

export function normalizeExpenseRecord(expense = {}) {
    const derivedContext = buildMonthContextFromDate(expense.date)
        || (expense.month && expense.year ? buildMonthContext(expense.month, expense.year) : null)
        || getCurrentMonthContext();

    return {
        ...expense,
        month: derivedContext.month,
        year: derivedContext.year
    };
}

export function isExpenseInMonth(expense, context) {
    if (!expense || !context) {
        return false;
    }

    const normalizedExpense = normalizeExpenseRecord(expense);
    const activeContext = buildMonthContext(context.month, context.year);
    return normalizedExpense.month === activeContext.month && normalizedExpense.year === activeContext.year;
}

export function filterExpensesByMonth(expenses = [], context) {
    return expenses
        .map((expense) => normalizeExpenseRecord(expense))
        .filter((expense) => isExpenseInMonth(expense, context));
}

export function getAvailableMonths(expenses = [], completedMonths = {}) {
    const monthMap = new Map();

    expenses.forEach((expense) => {
        const context = buildMonthContextFromDate(expense.date)
            || (expense.month && expense.year ? buildMonthContext(expense.month, expense.year) : null);
        if (context) {
            monthMap.set(context.monthKey, context);
        }
    });

    Object.keys(completedMonths).forEach((key) => {
        const context = buildMonthContextFromArchiveKey(key) || buildMonthContextFromMonthKey(key);
        if (context) {
            monthMap.set(context.monthKey, context);
        }
    });

    return Array.from(monthMap.values()).sort((left, right) => right.monthKey.localeCompare(left.monthKey));
}

export function isMonthCompleted(completedMonths = {}, context) {
    if (!context) {
        return false;
    }

    const activeContext = buildMonthContext(context.month, context.year);
    return Object.prototype.hasOwnProperty.call(completedMonths, activeContext.archiveKey);
}

export function calculateMonthlyBudget(profile) {
    const income = toNumber(profile.income);
    const mandatory = toNumber(profile.mandatory);
    return income - mandatory;
}

export function getMonthlySpending(expenses, context) {
    return filterExpensesByMonth(expenses, context)
        .filter((expense) => expense.transactionType !== "income" && expense.transactionType !== "investment")
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);
}

export function calculateMonthCompletion(context, expenses, profile, currentSavings) {
    const activeContext = buildMonthContext(context.month, context.year);
    const monthExpenses = filterExpensesByMonth(expenses, activeContext);
    const budgetAmount = calculateMonthlyBudget(profile);
    const spentAmount = getMonthlySpending(monthExpenses, activeContext);
    const difference = budgetAmount - spentAmount;
    const previousSavings = toNumber(currentSavings);
    const newSavings = previousSavings + difference;

    return {
        ...activeContext,
        expenses: monthExpenses,
        budgetAmount,
        spentAmount,
        difference,
        isSurplus: difference >= 0,
        previousSavings,
        newSavings,
        savingsChange: difference
    };
}

export function formatCompletionSummary(data) {
    const {
        label,
        budgetAmount,
        spentAmount,
        difference,
        isSurplus,
        previousSavings,
        newSavings
    } = data;

    return {
        title: `Complete ${label}`,
        lines: [
            { label: "Monthly Budget", value: budgetAmount, type: "budget" },
            { label: "Total Spent", value: spentAmount, type: "spent" },
            { label: "Difference", value: Math.abs(difference), type: isSurplus ? "surplus" : "deficit" },
            { label: "Previous Savings", value: previousSavings, type: "savings" },
            { label: "New Savings Balance", value: newSavings, type: "total" }
        ],
        isSurplus,
        archiveKey: data.archiveKey,
        label
    };
}
