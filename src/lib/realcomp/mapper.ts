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
export function mapRealcompProperty(property: any): ApifyPropertyListing {
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
    if (typeof property.ListPrice === "number") {
        price = property.ListPrice;
    }

    // Placeholder image (RESO Web API usually requires a secondary /Media call if $expand=Media isn't used)
    // We'll use a placeholder until we implement the deep media fetcher.
    const images: string[] = ["https://via.placeholder.com/800x600.png?text=Image+Not+Provided"];

    return {
        platform: "mls",
        sourceId: property.ListingId || `RC-${Math.random().toString(36).substring(7)}`,
        propertyUrl: `https://www.realcomp.com/listing/${property.ListingId}`, // Mock URL as RESO doesn't provide a public consumer URL directly
        address: property.UnparsedAddress || "Unknown Address",
        city: property.City || property.PostalCity || "Unknown City",
        state: property.StateOrProvince || "MI",
        zipCode: property.PostalCode || "",
        price: price,
        propertyType: propertyType,
        buildingSizeSqft: buildingSize,
        lotSizeAcres: property.LotSizeAcres || null,
        capRate: null, // MLS typically doesn't provide cap rate directly
        description: property.PublicRemarks || "No description provided.",
        images: images,
        brokerName: property.ListAgentFullName || "Realcomp IDX Agent",
        daysOnPlatform: property.DaysOnMarket || 0,
        _ghostListingData: null
    };
}
