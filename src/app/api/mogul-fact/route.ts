import { NextResponse } from "next/server";

/**
 * MOGUL FACT — Static historical facts, zero AI calls.
 * Rotates through 50 curated real estate mogul facts.
 */

const MOGUL_FACTS = [
    "John Jacob Astor bought Manhattan farmland before the grid expanded northward, inventing the strategy of land banking in the path of growth. His principle: buy land, wait, let the city come to you.",
    "Arthur Zeckendorf popularized assembling small parcels into massive developments, proving that the assembled whole is always worth more than the sum of its parts.",
    "Sam Zell built a $40B empire by buying distressed assets when others panicked. His rule: the riskiest move is the one everyone else is making.",
    "Gerald Hines pioneered hiring world-class architects for commercial buildings, proving that design premiums command 20-30% higher rents.",
    "Trammell Crow became America's largest landlord by building warehouses near highways before the logistics boom. He saw distribution as the backbone of commerce decades before Amazon.",
    "Harry Helmsley acquired the Empire State Building for $65M and doubled its value in 5 years through aggressive lease-up and tenant mix optimization.",
    "Stephen Ross built Related Companies into a $60B firm by mastering public-private partnerships, using tax incentives to make impossible projects pencil.",
    "Donald Bren became America's wealthiest real estate developer by master-planning entire communities in Irvine, controlling land supply to maintain pricing power.",
    "William Levitt invented the modern suburb with Levittown, applying assembly-line techniques to homebuilding and proving that standardization scales wealth.",
    "Larry Silverstein rebuilt the World Trade Center site, demonstrating that long-term ground leases can generate generational wealth from a single asset.",
    "Joseph Kennedy Sr. bought real estate during the Great Depression at pennies on the dollar, then held through recovery. His principle: be greedy when others are fearful.",
    "Conrad Hilton purchased his first hotel for $40,000 during a Texas oil bust, recognizing that hospitality assets are cyclical and the best time to buy is the worst time for the market.",
    "Rick Caruso built The Grove and Americana by creating experiential retail destinations, proving that physical retail thrives when it offers what Amazon cannot.",
    "Jorge Perez transformed Miami's skyline through condo development, pioneering the strategy of pre-selling units to fund construction with minimal equity.",
    "Barry Sternlicht founded Starwood Capital by recognizing that hotel brands are worth more than hotel buildings, separating management from ownership.",
    "Henry Flagler built the Florida East Coast Railway to make his Palm Beach real estate investments accessible, proving that infrastructure creates value.",
    "Walt Disney secretly acquired 27,000 acres near Orlando through shell companies to prevent price speculation — the original off-market acquisition strategy.",
    "Sam LeFrak built 40,000 apartment units in New York by vertically integrating construction, proving that controlling the supply chain protects margins.",
    "Paul Reichmann bet his entire fortune on Canary Wharf in London when no one believed East London could rival The City. The project eventually transformed an entire district.",
    "Eli Broad co-founded Kaufman and Broad by building affordable suburban homes in the 1950s, recognizing that the American Dream was a business model.",
    "A.P. Giannini founded Bank of America specifically to lend to immigrants and small builders, creating the mortgage industry that fueled American real estate.",
    "Fred Trump built his empire on FHA-backed housing during WWII, mastering the art of government-subsidized development decades before anyone called it public-private partnership.",
    "Victor Gruen designed the first enclosed shopping mall in 1956, fundamentally changing how Americans shop and creating an entirely new asset class.",
    "Ross Perot Jr. built Alliance Airport and surrounding development in Fort Worth, proving that private infrastructure investment can anchor billions in commercial real estate value.",
    "Zhang Xin went from factory worker to building SOHO China into a $5B empire, focusing on iconic architectural design to command price premiums in Beijing's commercial market.",
    "Lee Shau-Kee became one of Asia's richest by buying Hong Kong land when the British lease expiration created panic, then holding through the handover.",
    "Marty Edelman revolutionized real estate law by creating the modern CMBS structure, enabling the securitization that scaled commercial real estate finance globally.",
    "William Zeckendorf Sr. pioneered the concept of selling air rights above existing buildings in Manhattan, monetizing something that technically didn't exist yet.",
    "Robert Simon planned the city of Reston, Virginia as a complete live-work community in 1964, decades before mixed-use development became mainstream.",
    "Charles Fraser developed Hilton Head Island from swampland into a luxury resort destination, proving that place-making creates value from nothing.",
    "Steve Wynn transformed Las Vegas from a gambling town into a luxury destination by building The Mirage, proving that hospitality is really about experience design.",
    "Forest City Ratner built Barclays Center and the surrounding Pacific Park in Brooklyn by assembling 22 acres over a decade, showing that patience in assemblage pays exponential returns.",
    "Meyer Lansky reportedly understood that owning the land under casinos was more valuable than operating the casinos themselves — the original ground lease arbitrage.",
    "John D. Rockefeller built Rockefeller Center during the Great Depression, hiring 75,000 workers and proving that building counter-cyclically creates legacy assets at discount costs.",
    "The Lefcourt brothers built 31 buildings on Manhattan's West Side in the 1920s by pioneering the concept of syndicated real estate investment — an early precursor to REITs.",
    "Henry Crown bought the Empire State Building with no equity by structuring a master lease with sublease income exceeding his payment, perfecting the concept of leverage arbitrage.",
    "James Rouse built the first urban festival marketplace at Faneuil Hall in Boston, proving that adaptive reuse of historic buildings could revitalize entire downtowns.",
    "William Pereira planned the city of Irvine as a master-planned community around UC Irvine, showing that anchoring development around an institution guarantees long-term demand.",
    "Meshulam Riklis pioneered the leveraged buyout in real estate, acquiring properties with minimal cash by using the asset's own income stream as collateral.",
    "Tom Barrack built Colony Capital by buying real estate debt at discounts during the S&L crisis, proving that distressed debt is often a better entry point than equity.",
    "Grosvenor Group has owned 300 acres of London's Mayfair and Belgravia since 1677, proving that ultra-long-term land ownership is the most powerful wealth strategy in history.",
    "Stephen Schwarzman built Blackstone Real Estate into the world's largest commercial landlord by institutionalizing what was previously a fragmented cottage industry.",
    "Richard LeFrak standardized modular construction for apartment buildings in the 1960s, cutting build times by 40% and proving that construction innovation is a competitive moat.",
    "Irvine Company founder James Irvine II refused to sell his 93,000-acre ranch for development during the post-WWII boom, instead master-planning it over decades — patience turned a ranch into a $30B+ portfolio.",
    "The Aga Khan built a real estate and hospitality empire by investing in emerging markets before institutional capital arrived, proving that first-mover advantage applies to geography.",
    "Guo Guangchang built Fosun into China's largest private conglomerate by applying Warren Buffett's insurance float strategy to real estate acquisitions worldwide.",
    "Aby Rosen built RFR Holding by acquiring trophy Midtown Manhattan buildings and repositioning them through art installations and luxury hospitality, proving that curation creates value.",
    "Bruce Ratner assembled the Atlantic Yards site in Brooklyn by combining eminent domain, community benefits agreements, and air rights purchases — a masterclass in complex urban assemblage.",
    "Andrew Carnegie believed in buying land near railroad crossings, knowing that commerce naturally concentrates at transportation nodes — a principle that applies to highways and logistics today.",
    "The Ghermezian family built the Mall of America and West Edmonton Mall by creating destination entertainment that draws visitors from hundreds of miles away, redefining the concept of retail trade area.",
];

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Use day of year to rotate through facts deterministically
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now.getTime() - start.getTime();
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
        const factIndex = dayOfYear % MOGUL_FACTS.length;

        return NextResponse.json({ fact: MOGUL_FACTS[factIndex] });
    } catch (error: any) {
        console.error("[Mogul Fact] Error:", error.message);
        return NextResponse.json({ fact: MOGUL_FACTS[0] });
    }
}
