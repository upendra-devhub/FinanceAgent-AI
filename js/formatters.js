const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
});

export function formatCurrency(value) {
    if (!Number.isFinite(value)) {
        return "₹0";
    }

    return currencyFormatter.format(value);
}

export function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "0";
    }

    return numberFormatter.format(value);
}

export function formatPercent(value, digits = 0) {
    if (!Number.isFinite(value)) {
        return "0%";
    }

    return `${(value * 100).toFixed(digits)}%`;
}

export function formatMonthLabelFromKey(key) {
    if (!key) {
        return "No period";
    }

    const [year, month] = key.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);

    if (Number.isNaN(date.getTime())) {
        return key;
    }

    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
