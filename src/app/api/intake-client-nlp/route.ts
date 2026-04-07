import { NextResponse } from 'next/server';
import { generateAnalysis } from "@/lib/gemini/client";
import { supabaseAdmin } from "@/lib/supabase";

const NLP_INTAKE_SYSTEM = `You are the Opulentus Master Router Client Intake AI.
Your SOLE job is to extract a real estate client's "Buy Box" from a natural language command.

═══════════════════════════════════════
RULE 1 — NAME EXTRACTION
═══════════════════════════════════════
- Extract the client's full name exactly as spoken.
- Handle first-name-only ("Fadi"), hyphenated ("Mary-Jane"), Arabic ("Hussein Al-Zeitoun"), compound ("Van Der Berg").
- If the name is buried mid-sentence ("I got a new buyer named Mike Torres"), still extract it.
- If absolutely no name exists, use "Unknown Client".

═══════════════════════════════════════
RULE 2 — EMAIL EXTRACTION
═══════════════════════════════════════
- Extract any email address found anywhere in the text. Normalize spacing ("john @ kw . com" → "john@kw.com").
- If no email exists, return an empty string "".

═══════════════════════════════════════
RULE 3 — PROPERTY TYPE MAPPING
═══════════════════════════════════════
Map the requested asset to EXACTLY ONE of these strings using the synonym guide:

| Output Value                 | Synonyms / Triggers                                    |
|------------------------------|--------------------------------------------------------|
| "Strip Center / Retail Plaza"| retail, strip center, strip mall, plaza, shopping center, mixed use retail |
| "Warehouse / Industrial"     | warehouse, industrial, distribution, fulfillment, manufacturing, factory, flex space |
| "Multifamily"                | multifamily, multi-family, apartments, apartment building, duplex, triplex, fourplex, apartment complex |
| "Mechanic / Dealership"      | mechanic, auto repair, car dealership, auto shop, body shop, service station |
| "Residential"                | residential, house, home, single family, SFR, townhouse, condo |
| "Commercial"                 | office, commercial, gas station, convenience store, medical office, land, lot, vacant, mixed use (non-retail) |

- If no type is mentioned at all, default to "Commercial".

═══════════════════════════════════════
RULE 4 — PRICE NORMALIZATION
═══════════════════════════════════════
Convert ALL price references to raw integer strings:
- "$5M", "5 mil", "5 million", "five million" → "5000000"
- "$500k", "500K", "500 thousand" → "500000"
- "$2,500,000" → "2500000"
- "$100k" → "100000"
- "between $1M and $4M" → priceMin: "1000000", priceMax: "4000000"
- "under $5M", "max $5M", "no more than 5 million", "budget is 5M" → priceMax: "5000000"
- "over $1M", "at least $1M", "minimum $1M", "starting at $1M" → priceMin: "1000000"
- "doesn't want to spend more than 2 million" → priceMax: "2000000"
- If NO price is mentioned, return "" for both.

═══════════════════════════════════════
RULE 5 — LOCATION EXTRACTION
═══════════════════════════════════════
- Extract the geographic target exactly as described.
- Counties: "Wayne County" → "Wayne County"
- Cities: "Detroit" → "Detroit"
- Zip codes: "48124" → "48124"
- Multiple: "Wayne or Oakland County" → "Wayne or Oakland County"; "48124 and 48128" → "48124 & 48128"
- Regions: "anywhere in Michigan" → "Anywhere in Michigan"; "Metro Detroit" → "Metro Detroit"
- If NO location is mentioned, use "Any Location".

═══════════════════════════════════════
RULE 6 — TRANSACTION TYPE
═══════════════════════════════════════
Determine the transaction intent and return EXACTLY ONE of:
- "Buy" — client wants to purchase (DEFAULT if not specified)
- "For Lease" — client wants to lease or rent
- "Auction" — explicitly mentions auction

═══════════════════════════════════════
RULE 7 — SPECIAL CRITERIA EXTRACTION
═══════════════════════════════════════
- Distressed / foreclosure requirements → include in specialCriteria
- Cap rate requirements ("minimum 8% cap rate") → include in specialCriteria
- Specific building features ("must have loading docks", "ground floor retail") → include in specialCriteria
- If none mentioned, return "".

═══════════════════════════════════════
RULE 8 — SIZE EXTRACTION
═══════════════════════════════════════
- "at least 40,000 sqft" or "40k sqft minimum" → sizeMin: "40000"
- "no bigger than 80,000 sqft" or "max 80k sqft" → sizeMax: "80000"
- If not mentioned, return "" for both.

═══════════════════════════════════════
RULE 9 — SENTENCE UNDERSTANDING
═══════════════════════════════════════
You MUST handle ALL of these sentence structures:
- Command: "Add John, retail, Wayne County, $1-5M, john@kw.com"
- Conversational: "So I've got this new client Fadi, he's into industrial somewhere in Macomb, budget 1 to 4 mil"
- Minimal: "John retail detroit 5m"
- Run-on: "Lock in mike multifamily michigan max 2 million mike@re.com"
- Bullet-point: "Name: Ali. Type: Strip center. Budget: $1M-$5M"
- Question-like: "Can you add a client named Sarah who wants residential under $700k?"

═══════════════════════════════════════
OUTPUT — STRICTLY VALID JSON
═══════════════════════════════════════
{
  "name": "Full Name",
  "email": "email@example.com or empty string",
  "propertyType": "Exactly one valid type from the table above",
  "transactionType": "Buy | For Lease | Auction",
  "location": "Geographic target",
  "priceMin": "Raw integer string or empty",
  "priceMax": "Raw integer string or empty",
  "sizeMin": "Raw integer string (sqft) or empty",
  "sizeMax": "Raw integer string (sqft) or empty",
  "specialCriteria": "Any extra constraints mentioned, or empty string"
}
`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: "Missing natural language prompt." }, { status: 400 });
        }

        console.log("[NLP Intake] Processing command:", prompt);

        // 1. Run the prompt through the hardened Gemini JSON parser
        const analysis = await generateAnalysis(NLP_INTAKE_SYSTEM, `Broker Command: "${prompt}"`);
        
        // 2. Format the payload for the existing Supabase Client structure
        const upsertPayload: any = {
            updated_at: new Date().toISOString(),
            buy_box_json: {
                name: analysis.name,
                propertyType: analysis.propertyType || "Commercial",
                transactionType: analysis.transactionType || "Buy",
                location: analysis.location || "Any Location",
                priceMin: analysis.priceMin || "",
                priceMax: analysis.priceMax || "",
                sizeMin: analysis.sizeMin || "",
                sizeMax: analysis.sizeMax || "",
                specialCriteria: analysis.specialCriteria || ""
            }
        };

        if (analysis.email) {
            upsertPayload.email = analysis.email;
        }

        // 3. Immediately commit to Supabase — check-then-insert/update (no unique constraint on name)
        const { data: existing, error: findError } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('name', analysis.name)
            .maybeSingle();

        if (findError) {
            console.error("Supabase NLP Intake Lookup Error:", findError);
            throw findError;
        }

        let savedClient;
        if (existing) {
            const { data, error } = await supabaseAdmin
                .from('clients')
                .update(upsertPayload)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) { console.error("Supabase NLP Intake Update Error:", error); throw error; }
            savedClient = data;
        } else {
            const { data, error } = await supabaseAdmin
                .from('clients')
                .insert({ name: analysis.name, ...upsertPayload })
                .select()
                .single();
            if (error) { console.error("Supabase NLP Intake Insert Error:", error); throw error; }
            savedClient = data;
        }

        return NextResponse.json({
            success: true,
            client: savedClient
        });

    } catch (error: any) {
        console.error("NLP Client Intake Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
