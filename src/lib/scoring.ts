export const MARKET_CONSTANTS = {
    avgDaysOnMarket: {
        Troy: 5, Birmingham: 13, "Royal Oak": 6, Dearborn: 8,
        Detroit: 15, Warren: 12, Ferndale: 7, Northville: 10,
        Plymouth: 9, "Ann Arbor": 8, Default: 10
    },
    avgPricePerSqft: {
        Troy: 200, Birmingham: 350, "Royal Oak": 180, Dearborn: 150,
        Detroit: 80, Warren: 140, Ferndale: 170, Northville: 220,
        Plymouth: 210, "Ann Arbor": 240, Default: 150
    }
};

const PROFILE_WEIGHTS: Record<string, any> = {
    investor: { investmentROI: 40, belowMarketValue: 25, speedToClose: 20, conditionValue: 15 },
    luxury: { conditionValue: 35, belowMarketValue: 30, investmentROI: 10, speedToClose: 25 },
    firstTimeBuyer: { conditionValue: 35, belowMarketValue: 30, speedToClose: 20, investmentROI: 15 },
    commercial: { investmentROI: 45, belowMarketValue: 20, speedToClose: 20, conditionValue: 15 }
};

function calculateSpeedScore(listing: any): number {
    if (!listing.dom) return 50;
    const avgDOM = MARKET_CONSTANTS.avgDaysOnMarket[listing.city as keyof typeof MARKET_CONSTANTS.avgDaysOnMarket] || MARKET_CONSTANTS.avgDaysOnMarket.Default;
    if (listing.dom > avgDOM * 3) return 90; // High negotiation leverage
    if (listing.dom < avgDOM) return 70; // Hot property
    return 50;
}

function calculateValueScore(listing: any): number {
    if (!listing.listPrice || !listing.sqft) return 50;
    const avgPPS = MARKET_CONSTANTS.avgPricePerSqft[listing.city as keyof typeof MARKET_CONSTANTS.avgPricePerSqft] || MARKET_CONSTANTS.avgPricePerSqft.Default;
    const currentPPS = listing.listPrice / listing.sqft;
    // Score is higher if current PPS is lower than average
    const score = 50 + ((avgPPS - currentPPS) / avgPPS) * 200;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateConditionScore(listing: any): number {
    if (!listing.yearBuilt) return 50;
    const age = new Date().getFullYear() - listing.yearBuilt;
    if (age < 10) return 85;
    if (age < 30) return 70;
    if (age > 60) return 40;
    return 60;
}

function calculateROIMeasure(listing: any): number {
    // Rough cap rate proxy if rent isn't provided (assumes 0.8% of price as monthly rent)
    if (!listing.listPrice) return 50;
    const assumedRent = listing.listPrice * 0.008;
    const annualRent = assumedRent * 12;
    const roughCap = (annualRent * 0.5) / listing.listPrice; // simple 50% expense ratio
    const capScore = roughCap > 0.08 ? 100 : Math.max(0, Math.min(100, (roughCap / 0.08) * 100));
    return Math.round(capScore);
}

export function evaluateDeal(listing: any, investmentIntent: string = "investor") {
    const profile = PROFILE_WEIGHTS[investmentIntent] || PROFILE_WEIGHTS.investor;

    const speedScore = calculateSpeedScore(listing);
    const valueScore = calculateValueScore(listing);
    const conditionScore = calculateConditionScore(listing);
    const roiScore = calculateROIMeasure(listing);

    const weightedTotal = Math.round(
        (speedScore * (profile.speedToClose || 0) / 100) +
        (roiScore * (profile.investmentROI || 0) / 100) +
        (valueScore * (profile.belowMarketValue || 0) / 100) +
        (conditionScore * (profile.conditionValue || 0) / 100)
    );

    const reasons = [];
    if (speedScore >= 80) reasons.push("Motivated seller (long DOM)");
    if (valueScore >= 70) reasons.push("Priced below market average");
    if (roiScore >= 75 && investmentIntent === "investor") reasons.push("Strong cash flow potential proxy");
    if (conditionScore >= 75) reasons.push("Excellent property condition based on age");

    return {
        totalScore: weightedTotal,
        breakdown: {
            speedScore,
            valueScore,
            conditionScore,
            roiScore
        },
        reasons
    };
}
