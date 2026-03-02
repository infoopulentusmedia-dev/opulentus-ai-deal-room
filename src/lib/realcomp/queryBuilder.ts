export interface ParsedQueryParameters {
    city?: string;
    county?: string;
    zipCodes?: string[];
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    minBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    maxDom?: number;
    minDom?: number;
    propertyTypes?: string[];    // "SFR", "COM", "RI", etc.
    propertySubTypes?: string[]; // "Retail", "Industrial", "Warehouse", "Mixed Use"
    zoning?: string[];           // "Commercial", "Industrial", etc.
    keywords?: string[];         // search within remarks
    motivatedSeller?: boolean;   // true if asking for price drops or high DOM
}

export function buildRealCompODataFilter(params: ParsedQueryParameters): string {
    const filters: string[] = [];

    // Basic active status requirement
    filters.push("MlsStatus eq 'Active'");

    if (params.city) {
        filters.push(`City eq '${params.city}'`);
    }

    if (params.county) {
        filters.push(`CountyOrParish eq '${params.county}'`);
    }

    if (params.zipCodes && params.zipCodes.length > 0) {
        const zipFilters = params.zipCodes.map(zip => `PostalCode eq '${zip}'`);
        filters.push(`(${zipFilters.join(' or ')})`);
    }

    if (params.minPrice) {
        filters.push(`ListPrice ge ${params.minPrice}`);
    }

    if (params.maxPrice) {
        filters.push(`ListPrice le ${params.maxPrice}`);
    }

    if (params.minBeds) {
        filters.push(`BedroomsTotal ge ${params.minBeds}`);
    }

    if (params.minBaths) {
        filters.push(`BathroomsFull ge ${params.minBaths}`);
    }

    if (params.propertyTypes && params.propertyTypes.length > 0) {
        const typeMapping: Record<string, string> = {
            'COM': 'Commercial',
            'SFR': 'Residential',
            'CND': 'Residential',
            'RI': 'Residential Income',
            'LL': 'Land'
        };

        const typeFilters = params.propertyTypes.map(pt => {
            const mappedType = typeMapping[pt] || pt;
            return `PropertyType eq '${mappedType}'`;
        });
        filters.push(`(${typeFilters.join(' or ')})`);
    }

    if (params.propertySubTypes && params.propertySubTypes.length > 0) {
        const subTypeFilters = params.propertySubTypes.map(st => `PropertySubType eq '${st}'`);
        filters.push(`(${subTypeFilters.join(' or ')})`);
    }

    // Commercial and residential square footage check
    if (params.minSqft) {
        const sqftField = params.propertyTypes?.includes('COM') ? 'BuildingAreaTotal' : 'LivingArea';
        filters.push(`${sqftField} ge ${params.minSqft}`);
    }

    if (params.maxSqft) {
        const sqftField = params.propertyTypes?.includes('COM') ? 'BuildingAreaTotal' : 'LivingArea';
        filters.push(`${sqftField} le ${params.maxSqft}`);
    }

    if (params.minDom) {
        filters.push(`DaysOnMarket ge ${params.minDom}`);
    }

    if (params.maxDom) {
        filters.push(`DaysOnMarket le ${params.maxDom}`);
    }

    // Handle keywords (searching within PublicRemarks)
    if (params.keywords && params.keywords.length > 0) {
        const keywordFilters = params.keywords.map(kw => `contains(tolower(PublicRemarks), '${kw.toLowerCase()}')`);
        filters.push(`(${keywordFilters.join(' or ')})`);
    }

    return filters.join(' and ');
}
