export interface ApifyPropertyListing {
    platform: "crexi" | "loopnet" | "mls";
    sourceId: string;
    propertyUrl: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    price: number | null;
    propertyType: string;
    buildingSizeSqft: number | null;
    lotSizeAcres: number | null;
    capRate: number | null;
    description: string;
    images: string[];
    brokerName?: string;
    daysOnPlatform?: number;
    _historicalOriginalPrice?: number | null;
    _historicalPriceDrop?: number | null;
    _ghostListingData?: {
        otherPlatform: "crexi" | "loopnet" | "mls";
        otherUrl: string;
        priceDifference: number; // positive means the other one is more expensive
        daysDifference: number; // positive means the other one has been on market longer
    } | null;
}

export const MOCK_APIFY_DAILY_FEED: ApifyPropertyListing[] = [
    {
        platform: "loopnet",
        sourceId: "LN-3829104",
        propertyUrl: "https://www.loopnet.com/Listing/123-Main-St-Detroit-MI/3829104/",
        address: "123 Main St",
        city: "Detroit",
        state: "MI",
        zipCode: "48226",
        price: 3500000,
        propertyType: "Retail",
        buildingSizeSqft: 15000,
        lotSizeAcres: 0.5,
        capRate: 7.5,
        description: "Prime retail strip center in heart of downtown Detroit. Fully stabilized with national credit tenants. Recent roof and HVAC upgrades.",
        images: ["https://images.loopnet.com/mock-image-1.jpg"],
        brokerName: "CBRE Detroit",
        daysOnPlatform: 2
    },
    {
        platform: "crexi",
        sourceId: "CRX-998273",
        propertyUrl: "https://www.crexi.com/properties/998273/michigan-industrial-warehouse",
        address: "8400 Outer Drive",
        city: "Detroit",
        state: "MI",
        zipCode: "48239",
        price: 1250000,
        propertyType: "Industrial",
        buildingSizeSqft: 45000,
        lotSizeAcres: 2.1,
        capRate: null,
        description: "Value-add industrial warehouse opportunity. Currently 40% vacant. 3 loading docks, 18ft clear heights. Heavy power.",
        images: ["https://images.crexi.com/mock-image-2.jpg"],
        daysOnPlatform: 1
    },
    {
        platform: "crexi",
        sourceId: "CRX-445122",
        propertyUrl: "https://www.crexi.com/properties/445122/wayne-county-retail-plaza",
        address: "15500 Southfield Rd",
        city: "Allen Park",
        state: "MI",
        zipCode: "48101",
        price: 2100000,
        propertyType: "Retail",
        buildingSizeSqft: 12500,
        lotSizeAcres: 1.2,
        capRate: 8.2,
        description: "Neighborhood retail plaza in Wayne County. Great visibility. Upside through increasing below-market rents.",
        images: ["https://images.crexi.com/mock-image-3.jpg"],
        daysOnPlatform: 4
    }
];
