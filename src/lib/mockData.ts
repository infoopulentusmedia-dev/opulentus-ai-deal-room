// Realistic mock property data for development/demo when RealComp API is unavailable
export function getMockProperties(params: any): any[] {
    const allMocks = [
        {
            ListingKeyNumeric: 20241001, ListingId: "RCM-20241001",
            StreetNumber: "19420", StreetName: "Grand River Ave", UnparsedAddress: "19420 Grand River Ave",
            City: "Detroit", StateOrProvince: "MI", PostalCode: "48223", CountyOrParish: "Wayne",
            ListPrice: 145000, BedroomsTotal: 6, BathroomsFull: 3, LivingArea: 3400,
            PropertyType: "RI", YearBuilt: 1926, DaysOnMarket: 124, MlsStatus: "Active",
            PhotosCount: 4, PublicRemarks: "Cash only. Major roof repair needed. 4-unit multifamily. Estate sale. Great investment potential."
        },
        {
            ListingKeyNumeric: 20241002, ListingId: "RCM-20241002",
            StreetNumber: "8124", StreetName: "E Jefferson Ave", UnparsedAddress: "8124 E Jefferson Ave",
            City: "Detroit", StateOrProvince: "MI", PostalCode: "48214", CountyOrParish: "Wayne",
            ListPrice: 189000, BedroomsTotal: 4, BathroomsFull: 2, LivingArea: 2200,
            PropertyType: "SFR", YearBuilt: 1955, DaysOnMarket: 67, MlsStatus: "Active",
            PhotosCount: 8, PublicRemarks: "Recently reduced. Motivated seller. Needs cosmetic updates. Great bones."
        },
        {
            ListingKeyNumeric: 20241003, ListingId: "RCM-20241003",
            StreetNumber: "4510", StreetName: "Michigan Ave", UnparsedAddress: "4510 Michigan Ave",
            City: "Dearborn", StateOrProvince: "MI", PostalCode: "48126", CountyOrParish: "Wayne",
            ListPrice: 2400000, BedroomsTotal: 0, BathroomsFull: 2, LivingArea: 12000,
            PropertyType: "COM", YearBuilt: 1985, DaysOnMarket: 45, MlsStatus: "Active",
            PhotosCount: 12, PublicRemarks: "Retail strip center. 6 units. Fully leased. NNN leases. Cap rate 8.2%."
        },
        {
            ListingKeyNumeric: 20241004, ListingId: "RCM-20241004",
            StreetNumber: "22100", StreetName: "Telegraph Rd", UnparsedAddress: "22100 Telegraph Rd",
            City: "Southfield", StateOrProvince: "MI", PostalCode: "48033", CountyOrParish: "Oakland",
            ListPrice: 3200000, BedroomsTotal: 0, BathroomsFull: 4, LivingArea: 18500,
            PropertyType: "COM", YearBuilt: 1990, DaysOnMarket: 30, MlsStatus: "Active",
            PhotosCount: 15, PublicRemarks: "Strip center with anchor tenant. High traffic location. Oakland County."
        },
        {
            ListingKeyNumeric: 20241005, ListingId: "RCM-20241005",
            StreetNumber: "14600", StreetName: "Rotunda Dr", UnparsedAddress: "14600 Rotunda Dr",
            City: "Dearborn", StateOrProvince: "MI", PostalCode: "48120", CountyOrParish: "Wayne",
            ListPrice: 1800000, BedroomsTotal: 0, BathroomsFull: 2, LivingArea: 55000,
            PropertyType: "COM", YearBuilt: 1978, DaysOnMarket: 89, MlsStatus: "Active",
            PhotosCount: 6, PublicRemarks: "Industrial warehouse. Loading docks. 55,000 sqft. Wayne County. Motivated seller."
        },
        {
            ListingKeyNumeric: 20241006, ListingId: "RCM-20241006",
            StreetNumber: "7250", StreetName: "Wyoming Ave", UnparsedAddress: "7250 Wyoming Ave",
            City: "Dearborn", StateOrProvince: "MI", PostalCode: "48126", CountyOrParish: "Wayne",
            ListPrice: 450000, BedroomsTotal: 0, BathroomsFull: 1, LivingArea: 4500,
            PropertyType: "COM", YearBuilt: 1972, DaysOnMarket: 150, MlsStatus: "Active",
            PhotosCount: 5, PublicRemarks: "Mechanic shop with 3 bays. Includes lift equipment. High visibility corner lot."
        },
        {
            ListingKeyNumeric: 20241007, ListingId: "RCM-20241007",
            StreetNumber: "350", StreetName: "S Main St", UnparsedAddress: "350 S Main St",
            City: "Ann Arbor", StateOrProvince: "MI", PostalCode: "48104", CountyOrParish: "Washtenaw",
            ListPrice: 625000, BedroomsTotal: 4, BathroomsFull: 3, LivingArea: 2800,
            PropertyType: "SFR", YearBuilt: 2005, DaysOnMarket: 12, MlsStatus: "Active",
            PhotosCount: 20, PublicRemarks: "Updated colonial. Open concept. Finished basement. Premium location."
        },
        {
            ListingKeyNumeric: 20241008, ListingId: "RCM-20241008",
            StreetNumber: "1520", StreetName: "Monroe St", UnparsedAddress: "1520 Monroe St",
            City: "Dearborn", StateOrProvince: "MI", PostalCode: "48124", CountyOrParish: "Wayne",
            ListPrice: 525000, BedroomsTotal: 4, BathroomsFull: 3, LivingArea: 2400,
            PropertyType: "SFR", YearBuilt: 1998, DaysOnMarket: 18, MlsStatus: "Active",
            PhotosCount: 16, PublicRemarks: "Move-in ready. Updated kitchen. 48124 zip code. Near schools and parks."
        },
        {
            ListingKeyNumeric: 20241009, ListingId: "RCM-20241009",
            StreetNumber: "2200", StreetName: "Nowlin St", UnparsedAddress: "2200 Nowlin St",
            City: "Dearborn", StateOrProvince: "MI", PostalCode: "48124", CountyOrParish: "Wayne",
            ListPrice: 575000, BedroomsTotal: 5, BathroomsFull: 3, LivingArea: 3100,
            PropertyType: "SFR", YearBuilt: 2002, DaysOnMarket: 22, MlsStatus: "Active",
            PhotosCount: 18, PublicRemarks: "Spacious 5 bed colonial. Hardwood floors. Finished basement. 48124."
        },
        {
            ListingKeyNumeric: 20241010, ListingId: "RCM-20241010",
            StreetNumber: "6380", StreetName: "Chase Rd", UnparsedAddress: "6380 Chase Rd",
            City: "Dearborn", StateOrProvince: "MI", PostalCode: "48128", CountyOrParish: "Wayne",
            ListPrice: 545000, BedroomsTotal: 4, BathroomsFull: 2, LivingArea: 2600,
            PropertyType: "SFR", YearBuilt: 1995, DaysOnMarket: 35, MlsStatus: "Active",
            PhotosCount: 14, PublicRemarks: "West Dearborn gem. Updated bath. Large lot. 48128 zip."
        },
        {
            ListingKeyNumeric: 20241011, ListingId: "RCM-20241011",
            StreetNumber: "33000", StreetName: "Ford Rd", UnparsedAddress: "33000 Ford Rd",
            City: "Westland", StateOrProvince: "MI", PostalCode: "48185", CountyOrParish: "Wayne",
            ListPrice: 350000, BedroomsTotal: 0, BathroomsFull: 1, LivingArea: 5200,
            PropertyType: "COM", YearBuilt: 1980, DaysOnMarket: 110, MlsStatus: "Active",
            PhotosCount: 7, PublicRemarks: "Collision repair shop. Spray booth. Office space. Busy corridor."
        },
        {
            ListingKeyNumeric: 20241012, ListingId: "RCM-20241012",
            StreetNumber: "15800", StreetName: "Joy Rd", UnparsedAddress: "15800 Joy Rd",
            City: "Detroit", StateOrProvince: "MI", PostalCode: "48228", CountyOrParish: "Wayne",
            ListPrice: 175000, BedroomsTotal: 0, BathroomsFull: 1, LivingArea: 3800,
            PropertyType: "COM", YearBuilt: 1965, DaysOnMarket: 200, MlsStatus: "Active",
            PhotosCount: 4, PublicRemarks: "Former car dealership lot. 3800 sqft showroom. Large lot for inventory. As-is condition."
        },
    ];

    // Simple filter matching based on params
    let filtered = [...allMocks];

    if (params?.city) {
        filtered = filtered.filter(p => p.City.toLowerCase() === params.city.toLowerCase());
    }
    if (params?.county) {
        filtered = filtered.filter(p => p.CountyOrParish.toLowerCase() === params.county.toLowerCase());
    }
    if (params?.zipCodes && params.zipCodes.length > 0) {
        filtered = filtered.filter(p => params.zipCodes.includes(p.PostalCode));
    }
    if (params?.minPrice) {
        filtered = filtered.filter(p => p.ListPrice >= params.minPrice);
    }
    if (params?.maxPrice) {
        filtered = filtered.filter(p => p.ListPrice <= params.maxPrice);
    }
    if (params?.minBeds) {
        filtered = filtered.filter(p => p.BedroomsTotal >= params.minBeds);
    }
    if (params?.minSqft) {
        filtered = filtered.filter(p => p.LivingArea >= params.minSqft);
    }
    if (params?.maxSqft) {
        filtered = filtered.filter(p => p.LivingArea <= params.maxSqft);
    }
    if (params?.maxDom) {
        filtered = filtered.filter(p => p.DaysOnMarket <= params.maxDom);
    }
    if (params?.motivatedSeller) {
        filtered = filtered.filter(p => p.DaysOnMarket >= 90 || p.PublicRemarks.toLowerCase().includes('motivated'));
    }
    if (params?.propertyTypes && params.propertyTypes.length > 0) {
        filtered = filtered.filter(p => params.propertyTypes.includes(p.PropertyType));
    }
    if (params?.keywords && params.keywords.length > 0) {
        filtered = filtered.filter(p =>
            params.keywords.some((kw: string) => p.PublicRemarks.toLowerCase().includes(kw.toLowerCase()))
        );
    }

    // If filtering emptied everything, return the top 3 overall matches
    if (filtered.length === 0) {
        filtered = allMocks.slice(0, 3);
    }

    return filtered.slice(0, 5);
}

export const WATCHLIST_PROPERTIES = [
    {
        ListingKeyNumeric: 20241088, ListingId: "RCM-20241088",
        StreetNumber: "1250", StreetName: "Woodward Ave", UnparsedAddress: "1250 Woodward Ave",
        City: "Detroit", StateOrProvince: "MI", PostalCode: "48226", CountyOrParish: "Wayne",
        ListPrice: 4200000, BedroomsTotal: 0, BathroomsFull: 4, LivingArea: 25000,
        PropertyType: "COM", YearBuilt: 1920, DaysOnMarket: 45, MlsStatus: "Active",
        PhotosCount: 18, PublicRemarks: "Prime downtown Detroit mixed-use retail/office. High foot traffic. Partial vacancy offers value-add opportunity."
    },
    {
        ListingKeyNumeric: 20241089, ListingId: "RCM-20241089",
        StreetNumber: "2850", StreetName: "W Grand Blvd", UnparsedAddress: "2850 W Grand Blvd",
        City: "Detroit", StateOrProvince: "MI", PostalCode: "48202", CountyOrParish: "Wayne",
        ListPrice: 1850000, BedroomsTotal: 0, BathroomsFull: 2, LivingArea: 12000,
        PropertyType: "COM", YearBuilt: 1955, DaysOnMarket: 120, MlsStatus: "Active",
        PhotosCount: 12, PublicRemarks: "New Center commercial building. Creative office buildout. Motivated seller."
    },
    {
        ListingKeyNumeric: 20241090, ListingId: "RCM-20241090",
        StreetNumber: "450", StreetName: "E 11 Mile Rd", UnparsedAddress: "450 E 11 Mile Rd",
        City: "Royal Oak", StateOrProvince: "MI", PostalCode: "48067", CountyOrParish: "Oakland",
        ListPrice: 2100000, BedroomsTotal: 0, BathroomsFull: 2, LivingArea: 8000,
        PropertyType: "COM", YearBuilt: 1985, DaysOnMarket: 15, MlsStatus: "Active",
        PhotosCount: 10, PublicRemarks: "Fully stabilized retail strip in Royal Oak. NNN leases with 5+ years remaining on 3 of 4 units."
    }
];
