export interface ApifyCompListing {
    sourceId: string;
    platform: "crexi_sold" | "loopnet_sold" | "costar";
    address: string;
    city: string;
    state: string;
    zipCode: string;
    propertyType: string;
    buildingSizeSqft: number | null;
    lotSizeAcres: number | null;
    yearBuilt: number | null;
    salePrice: number;
    saleDate: string; // ISO String mapping to when it sold
    pricePerSqft: number | null;
    capRate: number | null;
}

export const mockClosedComps: ApifyCompListing[] = [
    // RETAIL / STRIP CENTERS
    {
        sourceId: "comp_1",
        platform: "costar",
        address: "Michigan Ave & Schaefer",
        city: "Dearborn",
        state: "MI",
        zipCode: "48126",
        propertyType: "Strip Center / Retail Plaza",
        buildingSizeSqft: 12500,
        lotSizeAcres: 0.8,
        yearBuilt: 1985,
        salePrice: 1850000,
        saleDate: "2023-11-15T00:00:00.000Z",
        pricePerSqft: 148,
        capRate: 7.2
    },
    {
        sourceId: "comp_2",
        platform: "loopnet_sold",
        address: "Ford Rd Retail Strip",
        city: "Dearborn Heights",
        state: "MI",
        zipCode: "48127",
        propertyType: "Strip Center / Retail Plaza",
        buildingSizeSqft: 8000,
        lotSizeAcres: 0.5,
        yearBuilt: 1999,
        salePrice: 1400000,
        saleDate: "2024-01-20T00:00:00.000Z",
        pricePerSqft: 175,
        capRate: 6.8
    },

    // INDUSTRIAL / WAREHOUSE
    {
        sourceId: "comp_3",
        platform: "crexi_sold",
        address: "Romulus Logistics Hub",
        city: "Romulus",
        state: "MI",
        zipCode: "48174",
        propertyType: "Warehouse / Industrial",
        buildingSizeSqft: 45000,
        lotSizeAcres: 3.2,
        yearBuilt: 1978,
        salePrice: 2200000,
        saleDate: "2023-09-10T00:00:00.000Z",
        pricePerSqft: 48,
        capRate: null
    },
    {
        sourceId: "comp_4",
        platform: "costar",
        address: "Livonia Light Industrial",
        city: "Livonia",
        state: "MI",
        zipCode: "48150",
        propertyType: "Warehouse / Industrial",
        buildingSizeSqft: 28000,
        lotSizeAcres: 1.5,
        yearBuilt: 1992,
        salePrice: 1950000,
        saleDate: "2023-12-05T00:00:00.000Z",
        pricePerSqft: 69,
        capRate: 8.1
    },

    // AUTOMOTIVE / MECHANIC
    {
        sourceId: "comp_5",
        platform: "loopnet_sold",
        address: "Warren Ave Auto",
        city: "Detroit",
        state: "MI",
        zipCode: "48228",
        propertyType: "Mechanic / Collision / Dealership",
        buildingSizeSqft: 5500,
        lotSizeAcres: 0.3,
        yearBuilt: 1965,
        salePrice: 320000,
        saleDate: "2024-02-12T00:00:00.000Z",
        pricePerSqft: 58,
        capRate: null
    },

    // RESIDENTIAL (INVESTMENT)
    {
        sourceId: "comp_6",
        platform: "crexi_sold",
        address: "Westborn District Duplex",
        city: "Dearborn",
        state: "MI",
        zipCode: "48124",
        propertyType: "Residential",
        buildingSizeSqft: 2200,
        lotSizeAcres: 0.15,
        yearBuilt: 1955,
        salePrice: 315000,
        saleDate: "2024-01-05T00:00:00.000Z",
        pricePerSqft: 143,
        capRate: 8.5
    },
    {
        sourceId: "comp_7",
        platform: "costar",
        address: "East Dearborn Quadplex",
        city: "Dearborn",
        state: "MI",
        zipCode: "48126",
        propertyType: "Residential",
        buildingSizeSqft: 4000,
        lotSizeAcres: 0.2,
        yearBuilt: 1940,
        salePrice: 550000,
        saleDate: "2023-10-22T00:00:00.000Z",
        pricePerSqft: 137,
        capRate: 9.1
    }
];
