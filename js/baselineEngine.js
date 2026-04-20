import { formatMonthLabelFromKey } from "./formatters.js";
import { computeDelta, sortTotalsDescending, summarizeDistribution } from "./stats.js";

function createMonthRecord() {
    return {
        total: 0,
        count: 0,
        categories: new Map(),
        vendors: new Map()
    };
}

export function buildReferenceBaseline(datasetRecords = []) {
    const records = datasetRecords.filter((record) => Number.isFinite(record.amount));
    const categoryMap = new Map();
    const vendorMap = new Map();
    const monthMap = new Map();
    const transactionAmounts = [];

    records.forEach((record) => {
        transactionAmounts.push(record.amount);

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
            const monthValue = monthMap.get(record.monthKey) || createMonthRecord();
            monthValue.total += record.amount;
            monthValue.count += 1;

            const monthCategory = monthValue.categories.get(categoryKey) || { total: 0, count: 0 };
            monthCategory.total += record.amount;
            monthCategory.count += 1;
            monthValue.categories.set(categoryKey, monthCategory);

            if (record.vendor) {
                const monthVendor = monthValue.vendors.get(record.vendor) || { total: 0, count: 0 };
                monthVendor.total += record.amount;
                monthVendor.count += 1;
                monthValue.vendors.set(record.vendor, monthVendor);
            }

            monthMap.set(record.monthKey, monthValue);
        }
    });

    const totalExpense = records.reduce((sum, record) => sum + record.amount, 0);
    const monthlyTrend = Array.from(monthMap.entries())
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => ({
            key,
            label: formatMonthLabelFromKey(key),
            total: value.total,
            count: value.count,
            categories: value.categories,
            vendors: value.vendors
        }));

    const monthTotals = monthlyTrend.map((item) => item.total);
    const monthlyTotalDistribution = summarizeDistribution(monthTotals);
    const monthChanges = monthlyTrend
        .map((item, index) => {
            if (index === 0) {
                return null;
            }

            const previous = monthlyTrend[index - 1];
            return computeDelta(item.total, previous.total);
        })
        .filter((value) => value !== null);
    const monthlyChangeDistribution = summarizeDistribution(monthChanges);

    const overallCategories = sortTotalsDescending(categoryMap).map((item) => ({
        ...item,
        overallShare: totalExpense ? item.total / totalExpense : 0
    }));

    const categoryBaselines = overallCategories.map((item) => {
        const shareSeries = monthlyTrend.map((month) => {
            return month.total ? (month.categories.get(item.name)?.total || 0) / month.total : 0;
        });
        const amountSeries = monthlyTrend.map((month) => month.categories.get(item.name)?.total || 0);
        const transactionSeries = monthlyTrend.map((month) => month.categories.get(item.name)?.count || 0);

        return {
            name: item.name,
            total: item.total,
            count: item.count,
            overallShare: item.overallShare,
            averageTransaction: item.count ? item.total / item.count : 0,
            transactionDistribution: summarizeDistribution(
                records.filter((record) => record.category === item.name).map((record) => record.amount)
            ),
            shareDistribution: summarizeDistribution(shareSeries),
            monthlyAmountDistribution: summarizeDistribution(amountSeries),
            monthlyFrequencyDistribution: summarizeDistribution(transactionSeries)
        };
    });

    const dominantShareSeries = monthlyTrend.map((month) => {
        if (!month.total || month.categories.size === 0) {
            return 0;
        }

        const topCategoryTotal = Math.max(...Array.from(month.categories.values()).map((entry) => entry.total));
        return topCategoryTotal / month.total;
    });

    const vendorBaselines = sortTotalsDescending(vendorMap).map((item) => ({
        ...item,
        overallShare: totalExpense ? item.total / totalExpense : 0
    }));

    const categoryMapByName = new Map(categoryBaselines.map((category) => [category.name, category]));
    const topByAmount = [...categoryBaselines].sort((left, right) => right.total - left.total);
    const topByFrequency = [...categoryBaselines].sort((left, right) => right.count - left.count);

    return {
        metadata: {
            hasRecords: records.length > 0,
            hasDates: monthlyTrend.length > 0,
            hasVendorData: vendorBaselines.length > 0
        },
        summary: {
            recordCount: records.length,
            totalExpense,
            activeMonths: monthlyTrend.length,
            activeCategories: categoryBaselines.length,
            averageTransaction: records.length ? totalExpense / records.length : 0,
            medianTransaction: summarizeDistribution(transactionAmounts).median
        },
        monthly: {
            trend: monthlyTrend.map((item) => ({
                key: item.key,
                label: item.label,
                total: item.total,
                count: item.count
            })),
            totalDistribution: monthlyTotalDistribution,
            changeDistribution: monthlyChangeDistribution,
            dominantShareDistribution: summarizeDistribution(dominantShareSeries)
        },
        categories: {
            list: categoryBaselines,
            byName: categoryMapByName,
            topByAmount,
            topByFrequency
        },
        vendors: {
            list: vendorBaselines.slice(0, 10)
        }
    };
}
