export function toNumber(value) {
    const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildWeeklyKey(date) {
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function quantile(values, q) {
    if (!values.length) {
        return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }

    return sorted[base];
}

export function summarizeDistribution(values) {
    const cleaned = values.filter((value) => Number.isFinite(value));
    if (!cleaned.length) {
        return {
            count: 0,
            min: 0,
            max: 0,
            mean: 0,
            median: 0,
            q1: 0,
            q3: 0,
            iqr: 0,
            stdDev: 0,
            lowerFence: 0,
            upperFence: 0
        };
    }

    const sorted = [...cleaned].sort((left, right) => left - right);
    const count = sorted.length;
    const sum = sorted.reduce((total, value) => total + value, 0);
    const mean = sum / count;
    const median = quantile(sorted, 0.5);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const variance = sorted.reduce((total, value) => total + ((value - mean) ** 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const iqr = q3 - q1;

    return {
        count,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean,
        median,
        q1,
        q3,
        iqr,
        stdDev,
        lowerFence: q1 - iqr,
        upperFence: q3 + iqr
    };
}

export function sortTotalsDescending(map) {
    return Array.from(map.entries())
        .map(([name, value]) => ({ name, ...value }))
        .sort((left, right) => right.total - left.total);
}

export function computeDelta(currentValue, previousValue) {
    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) {
        return null;
    }

    return (currentValue - previousValue) / previousValue;
}

export function parseMandatoryLines(text = "") {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const amountMatch = line.match(/-?\d[\d,]*(?:\.\d+)?/);
            const amount = amountMatch ? toNumber(amountMatch[0]) : 0;
            const label = amountMatch ? line.replace(amountMatch[0], "").replace(/[:\-]+/g, " ").trim() : line;

            return {
                id: `mandatory-${index}`,
                label: label || `Item ${index + 1}`,
                amount
            };
        });
}
