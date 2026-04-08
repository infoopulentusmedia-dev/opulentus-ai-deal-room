import { ApifyPropertyListing } from "../apify/mockFeed";

/**
 * Validates a raw Realcomp OData property against the strict IDX compliance rules.
 * @param property The raw JSON object from Realcomp `/Property` endpoint
 */
export function isRealcompCompliant(property: any): boolean {
    // 1. Must allow internet display
    if (property.InternetEntireListingDisplayYN === false) {
        return false;
    }

    // 2. Must be syndicated to IDX
    const syndicateTo = property.SyndicateTo || "";
    if (
        !syndicateTo.includes("Internet Data Exchange (IDX)") &&
        !syndicateTo.includes("InternetDataExchangeIDX") &&
        !syndicateTo.includes("IDX")
    ) {
        return false;
    }

    return true;
}

/**
 * Maps a compliant Realcomp RESO Web API property to the internal ApifyPropertyListing schema.
 * Safely handles edge cases like missing square footage or prices.
 */
export function mapRealcompProperty(property: any): ApifyPropertyListing | null {
    // CRITICAL: Skip properties without a ListingId — random IDs cause
    // phantom duplicates on every scrape and can never be found again.
    if (!property.ListingId) {
        console.warn("[MLS Mapper] Skipping property with no ListingId:", property.UnparsedAddress || "unknown");
        return null;
    }

    // Safely parse square footage (edge case handling)
    let buildingSize: number | null = null;
    if (typeof property.BuildingAreaTotal === "number" && property.BuildingAreaTotal > 0) {
        buildingSize = property.BuildingAreaTotal;
    }

    // Determine normalized property type
    let propertyType = "Commercial";
    if (property.PropertySubType) {
        propertyType = property.PropertySubType;
    } else if (property.PropertyType) {
        propertyType = property.PropertyType;
    }

    // Handle price
    let price: number | null = null;
    if (typeof property.ListPrice === "number" && isFinite(property.ListPrice)) {
        price = property.ListPrice;
    }

    // Placeholder image (RESO Web API usually requires a secondary /Media call if $expand=Media isn't used)
    const images: string[] = ["https://via.placeholder.com/800x600.png?text=Image+Not+Provided"];

    // Safe address with fallback
    const address = property.UnparsedAddress || property.StreetName || "Unknown Address";
    const city = property.City || property.PostalCity || "";
    const state = property.StateOrProvince || "MI";
    const zipCode = property.PostalCode || "";

    return {
        platform: "mls",
        sourceId: property.ListingId,
        propertyUrl: `https://www.zillow.com/homes/${encodeURIComponent((address + ' ' + zipCode).trim())}_rb/`,
        address,
        city,
        state,
        zipCode,
        price,
        propertyType,
        buildingSizeSqft: buildingSize,
        lotSizeAcres: typeof property.LotSizeAcres === 'number' ? property.LotSizeAcres : null,
        capRate: null,
        description: property.PublicRemarks || "No description provided.",
        images,
        brokerName: property.ListAgentFullName || "Realcomp IDX Agent",
        daysOnPlatform: typeof property.DaysOnMarket === 'number' ? property.DaysOnMarket : 0,
        _ghostListingData: null
    };
}
