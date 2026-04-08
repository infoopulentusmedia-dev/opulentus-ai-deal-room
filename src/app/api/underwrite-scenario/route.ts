import { NextRequest, NextResponse } from "next/server";

/**
 * UNDERWRITE SCENARIO — Pure financial math, zero AI calls.
 * Calculates NOI, cap rate, cash-on-cash, DSCR, debt service, and sensitivity grid.
 */

// Michigan market rent assumptions per sqft (NNN annual)
const RENT_PER_SQFT: Record<string, number> = {
    "industrial": 5.50,
    "warehouse": 5.50,
    "retail": 14.00,
    "strip": 14.00,
    "office": 12.00,
    "medical": 18.00,
    "residential": 10.00,     // Not really NNN but proxy
    "multifamily": 10.00,
    "auto": 8.00,
    "land": 0,
    "default": 10.00,
};

// Expense ratio by type
const EXPENSE_RATIO: Record<string, number> = {
    "industrial": 0.25,
    "warehouse": 0.25,
    "retail": 0.30,
    "strip": 0.30,
    "office": 0.35,
    "medical": 0.30,
    "residential": 0.40,
    "multifamily": 0.45,
    "auto": 0.20,
    "default": 0.30,
};

function getTypeKey(propertyType: string): string {
    const t = (propertyType || "").toLowerCase();
    if (t.includes("industrial") || t.includes("warehouse")) return "industrial";
    if (t.includes("retail") || t.includes("strip") || t.includes("plaza")) return "retail";
    if (t.includes("office")) return "office";
    if (t.includes("medical") || t.includes("dental")) return "medical";
    if (t.includes("multi") || t.includes("apartment")) return "multifamily";
    if (t.includes("residential") || t.includes("single") || t.includes("house")) return "residential";
    if (t.includes("auto") || t.includes("mechanic")) return "auto";
    return "default";
}

function calcMonthlyMortgage(principal: number, annualRate: number, years: number): number {
    const r = annualRate / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { property, purchasePrice: overridePrice, downPaymentPct: overrideDown } = body;

        if (!property) {
            return NextResponse.json({ error: "Missing property data" }, { status: 400 });
        }

        // Parse inputs
        const price = overridePrice || property.listPrice || property.price || 0;
        const purchasePrice = typeof price === "number" ? price : parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
        const sqft = property.squareFeet || property.sqft || property.buildingSizeSqft || 0;
        const typeKey = getTypeKey(property.propertyType || "");
        const downPct = (overrideDown || 25) / 100;

        if (purchasePrice === 0) {
            return NextResponse.json({ error: "Cannot underwrite with $0 purchase price" }, { status: 400 });
        }

        // Assumptions
        const interestRate = 0.0725;          // 7.25% (current market)
        const amortYears = 25;
        const vacancyRate = typeKey === "industrial" ? 0.05 : typeKey === "retail" ? 0.08 : 0.07;
        const capexReserve = 0.05;
        const managementFee = typeKey === "residential" || typeKey === "multifamily" ? 0.10 : 0.05;

        // Revenue estimate
        const rentPerSqft = RENT_PER_SQFT[typeKey] || RENT_PER_SQFT["default"];
        const grossRentAnnual = sqft > 0 ? sqft * rentPerSqft : purchasePrice * 0.08; // Fallback: 8% gross yield
        const grossRentMonthly = grossRentAnnual / 12;
        const effectiveGross = grossRentAnnual * (1 - vacancyRate);

        // Expenses
        const expenseRatio = EXPENSE_RATIO[typeKey] || EXPENSE_RATIO["default"];
        const totalExpenses = effectiveGross * expenseRatio;
        const annualInsurance = purchasePrice * 0.004;
        const annualTaxes = purchasePrice * 0.015;    // Michigan avg ~1.5%

        // NOI
        const noi = effectiveGross - totalExpenses;

        // Debt service
        const loanAmount = purchasePrice * (1 - downPct);
        const monthlyMortgage = calcMonthlyMortgage(loanAmount, interestRate, amortYears);
        const annualDebtService = monthlyMortgage * 12;

        // Key metrics
        const capRate = (noi / purchasePrice) * 100;
        const cashOnCash = loanAmount > 0
            ? ((noi - annualDebtService) / (purchasePrice * downPct)) * 100
            : (noi / purchasePrice) * 100;
        const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;
        const totalCashNeeded = purchasePrice * downPct + (purchasePrice * 0.03); // 3% closing costs
        const annualCashFlow = noi - annualDebtService;

        // Narrative
        let narrative: string;
        if (capRate >= 7 && cashOnCash >= 10 && dscr >= 1.3) {
            narrative = `Strong investment at a ${capRate.toFixed(1)}% cap rate with ${cashOnCash.toFixed(1)}% cash-on-cash return. The ${dscr.toFixed(2)}x DSCR provides comfortable debt coverage. This deal pencils well for a value-oriented investor.`;
        } else if (capRate >= 5 && dscr >= 1.15) {
            narrative = `Moderate deal at a ${capRate.toFixed(1)}% cap rate. Cash-on-cash of ${cashOnCash.toFixed(1)}% is acceptable but not exceptional. DSCR of ${dscr.toFixed(2)}x is adequate — consider negotiating a lower price to improve returns.`;
        } else if (dscr < 1.0) {
            narrative = `Caution: At the current price and terms, this property generates negative cash flow (DSCR ${dscr.toFixed(2)}x). The ${capRate.toFixed(1)}% cap rate is below financing costs. Requires a significant price reduction or value-add strategy to pencil.`;
        } else {
            narrative = `Thin margins at a ${capRate.toFixed(1)}% cap rate and ${cashOnCash.toFixed(1)}% cash-on-cash. The ${dscr.toFixed(2)}x DSCR leaves limited room for error. Consider this only with a clear value-add plan or at a reduced purchase price.`;
        }

        // Risks
        const risks: string[] = [];
        if (dscr < 1.2) risks.push("Tight debt service coverage — sensitive to vacancy increases");
        if (capRate < 5) risks.push("Sub-5% cap rate — below typical investor thresholds");
        if (vacancyRate >= 0.08) risks.push("Higher vacancy assumption for this property type");
        if (purchasePrice > 2000000) risks.push("Larger deal size may limit buyer pool on exit");
        if (sqft === 0) risks.push("Square footage unknown — rent estimates are approximated");
        const yearBuilt = property.yearBuilt;
        if (yearBuilt && yearBuilt < 1980) risks.push(`Built in ${yearBuilt} — factor in higher maintenance/capex reserves`);

        // Sensitivity grid
        const sensitivityGrid = [
            {
                scenario: "Base Case",
                capRate: Math.round(capRate * 10) / 10,
                cashOnCash: Math.round(cashOnCash * 10) / 10,
            },
            {
                scenario: "10% Price Reduction",
                capRate: Math.round((noi / (purchasePrice * 0.9)) * 1000) / 10,
                cashOnCash: Math.round(((noi - calcMonthlyMortgage(purchasePrice * 0.9 * (1 - downPct), interestRate, amortYears) * 12) / (purchasePrice * 0.9 * downPct)) * 1000) / 10,
            },
            {
                scenario: "5% Vacancy Increase",
                capRate: Math.round(((effectiveGross * (1 - 0.05) - totalExpenses) / purchasePrice) * 1000) / 10,
                cashOnCash: Math.round((((effectiveGross * (1 - 0.05) - totalExpenses) - annualDebtService) / (purchasePrice * downPct)) * 1000) / 10,
            },
            {
                scenario: "Rate Drop to 6.5%",
                capRate: Math.round(capRate * 10) / 10,
                cashOnCash: Math.round(((noi - calcMonthlyMortgage(loanAmount, 0.065, amortYears) * 12) / (purchasePrice * downPct)) * 1000) / 10,
            },
        ];

        const confidence = dscr >= 1.3 && capRate >= 6 ? "high" : dscr >= 1.1 ? "medium" : "low";

        return NextResponse.json({
            assumptions: {
                purchasePrice,
                downPaymentPct: downPct * 100,
                interestRate: interestRate * 100,
                amortizationYears: amortYears,
                capexReservePct: capexReserve * 100,
                vacancyRatePct: vacancyRate * 100,
                monthlyGrossRent: Math.round(grossRentMonthly),
                annualInsurance: Math.round(annualInsurance),
                annualTaxes: Math.round(annualTaxes),
                managementFeePct: managementFee * 100,
            },
            metrics: {
                NOI: Math.round(noi),
                capRate: Math.round(capRate * 100) / 100,
                cashOnCash: Math.round(cashOnCash * 100) / 100,
                DSCR: Math.round(dscr * 100) / 100,
                totalCashNeeded: Math.round(totalCashNeeded),
                annualDebtService: Math.round(annualDebtService),
                monthlyMortgage: Math.round(monthlyMortgage),
                annualCashFlow: Math.round(annualCashFlow),
            },
            narrative,
            risks,
            sensitivityGrid,
            confidence,
            engine: "deterministic",
        });

    } catch (error) {
        console.error("Underwrite error:", error);
        return NextResponse.json({ error: "Underwriting analysis failed" }, { status: 500 });
    }
}
