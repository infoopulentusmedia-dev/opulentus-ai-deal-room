import { NextRequest, NextResponse } from "next/server";
import { generateOrchestratorPlan, generateAnalysis } from "@/lib/gemini/client";
import { evaluateDeal } from "@/lib/scoring";
import { getLatestScan } from "@/lib/db";
// ──────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ──────────────────────────────────────────────────────────

const ROUTER_SYSTEM = `You are a precise intent-classification engine for a real estate investment app called Opulentus.
You MUST classify the user's latest message into exactly ONE of four intents: "search", "followup", "general", or "property_lookup".

You will be given:
- The conversation history
- A list of VISIBLE PROPERTIES (addresses currently displayed on the user's screen)
- The currently selected Deal Room property (the "activeProperty" if any)
- The latest user message

─── STRICT CONTEXT LOCK RULE ───
If an Active Deal Room Property is present in the context, you MUST assume the user is talking about THAT specific property. 
Do NOT trigger a "search" intent just because the user asks "what about commercial properties here" or uses broad keywords. 
ONLY route to "search" if the user uses EXPLICIT escape phrases like: "Find me other properties", "Show me different options", "Search for something else", or "I don't like this one, show me others".

─── INTENT DEFINITIONS ───

"search" — The user EXPLICITLY wants to FIND NEW properties. Must contain an explicit command to search for something else.
"followup" — The user is asking a QUESTION or making a COMMENT about the active property or visible properties. Examples: "is this a good deal?", "what are the risks?", "why is it priced like this?", "what about zoning here?".
"general" — General real estate questions ("what's a 1031 exchange?") or greetings.
"property_lookup" — A targeted lookup of a SPECIFIC address NOT currently visible.

Return ONLY valid JSON: { "intent": "search" | "followup" | "general" | "property_lookup" }`;


const FOLLOWUP_SYSTEM = `You are Opulentus, a sharp, experienced Michigan real estate investment advisor.

PERSONALITY & ABSOLUTE PRONOUN RESOLUTION:
- Speak like a seasoned deal hunter — direct, confident, practical
- Keep responses concise (2-4 sentences max unless asked for detail)
- The CURRENT DEAL ROOM PROPERTY is the singular focus. All vague pronouns ('it', 'this one', 'the property', 'here') VERY STRICTLY refer to the active Deal Room property. NEVER ask the user which property they mean.
- Do NOT list or recommend new properties yourself. Your job is exclusively to act as an underwriter for the active property.
- If the active property is a terrible fit based on their questions, point out the flaws. You may conclude by asking: 'Would you like me to find some better alternatives?'

You have full access to the conversation history and the active property.
When answering, reference the active property's specific data mathematically.

RESPONSE FORMAT — return valid JSON:
{
  "headline": "Short bold headline (3-6 words)",
  "text": "Your conversational response focused ONLY on the active property"
}`;


const GENERAL_QA_SYSTEM = `You are Opulentus, a world-class Michigan real estate investment advisor with 20+ years of experience.

PERSONALITY:
- Authoritative but approachable — you explain complex concepts simply
- Direct and actionable — give real numbers and frameworks, not vague advice
- You answer like a mentor, not a textbook
- Keep responses focused: 2-5 sentences for simple questions, up to a short paragraph for complex ones
- If someone says hello or thanks, respond warmly but briefly

You have access to today's live market data. Use it when relevant.
If the user's question could benefit from a property search, gently suggest they ask you to find specific listings.

RESPONSE FORMAT — return valid JSON:
{
  "headline": "Short bold headline (3-6 words)",
  "text": "Your helpful response"
}`;


const PROPERTY_LOOKUP_SYSTEM = `You are Opulentus, a Michigan real estate investment advisor.
The user asked about a specific property. You have the property data below.
Provide a concise but insightful analysis: mention the price, key stats, deal score, and one or two notable signals.
Keep it to 2-4 sentences.

RESPONSE FORMAT — return valid JSON:
{
  "headline": "Short headline about the property",
  "text": "Your analysis of this specific property"
}`;


// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────

/** Extract all visible property addresses from chat history */
function extractVisibleAddresses(history: any[]): string[] {
  const addresses: string[] = [];
  for (const msg of (history || [])) {
    if (msg.properties && Array.isArray(msg.properties)) {
      for (const p of msg.properties) {
        if (p.address) addresses.push(p.address);
      }
    }
  }
  return [...new Set(addresses)]; // deduplicate
}

/** Build a market snapshot string for Gemini context */
async function buildMarketSnapshot(): Promise<string> {
  const latestScan = await getLatestScan();
  if (!latestScan || latestScan.properties.length === 0) {
    return "\n\nTODAY'S MARKET: No properties scraped yet today.";
  }

  const props = latestScan.properties;
  const crexiProps = props.filter(p => p.platform === 'crexi');
  const loopnetProps = props.filter(p => p.platform === 'loopnet');
  const priced = props.filter(p => p.price && p.price > 0);
  const avgPrice = priced.length > 0 ? Math.round(priced.reduce((s, p) => s + (p.price || 0), 0) / priced.length) : 0;
  const cheapest = priced.length > 0 ? priced.reduce((min, p) => (p.price || Infinity) < (min.price || Infinity) ? p : min, priced[0]) : null;
  const mostExpensive = priced.length > 0 ? priced.reduce((max, p) => (p.price || 0) > (max.price || 0) ? p : max, priced[0]) : null;

  // Collect unique property types
  const types = [...new Set(props.map(p => p.propertyType).filter(Boolean))];
  // Collect unique cities
  const cities = [...new Set(props.map(p => p.city).filter(Boolean))].slice(0, 10);

  let snapshot = `\n\nTODAY'S LIVE MARKET SNAPSHOT (${latestScan.date}):`;
  snapshot += `\n- Total Properties: ${props.length} (${crexiProps.length} from Crexi, ${loopnetProps.length} from LoopNet)`;
  snapshot += `\n- Average Price: $${avgPrice.toLocaleString()}`;
  if (cheapest) snapshot += `\n- Cheapest: $${(cheapest.price || 0).toLocaleString()} — ${cheapest.address}, ${cheapest.city} (${cheapest.propertyType})`;
  if (mostExpensive) snapshot += `\n- Most Expensive: $${(mostExpensive.price || 0).toLocaleString()} — ${mostExpensive.address}, ${mostExpensive.city} (${mostExpensive.propertyType})`;
  snapshot += `\n- Property Types: ${types.join(', ')}`;
  snapshot += `\n- Cities Covered: ${cities.join(', ')}`;

  return snapshot;
}

/** Search the real live Apify feed instead of relying on broken Vercel filesystem cron data */
async function searchApifyDB(parameters: any, investmentIntent: string, top: number = 10) {
  const scan = await getLatestScan();
  const allProps = scan?.properties || [];
  let dataSource = allProps.length > 0 ? "apify" : "empty";

  // Apply filters from the parsed parameters
  let filtered = [...allProps];

  if (parameters.city) {
    const cityLower = parameters.city.toLowerCase();
    filtered = filtered.filter(p => (p.city || '').toLowerCase().includes(cityLower));
  }

  if (parameters.county) {
    // County-level matching via city names (Wayne County = Detroit, Dearborn, etc.)
    const countyLower = parameters.county.toLowerCase();
    // We'll keep all if county matches known MI counties and we can't filter further
    // In practice the data is already MI-only
  }

  if (parameters.zipCodes && parameters.zipCodes.length > 0) {
    filtered = filtered.filter(p => parameters.zipCodes.includes(p.zipCode));
  }

  if (parameters.minPrice) {
    filtered = filtered.filter(p => (p.price || 0) >= parameters.minPrice);
  }

  if (parameters.maxPrice) {
    filtered = filtered.filter(p => p.price && p.price <= parameters.maxPrice);
  }

  if (parameters.minSqft) {
    filtered = filtered.filter(p => (p.buildingSizeSqft || 0) >= parameters.minSqft);
  }

  if (parameters.maxSqft) {
    filtered = filtered.filter(p => p.buildingSizeSqft && p.buildingSizeSqft <= parameters.maxSqft);
  }

  if (parameters.propertyTypes && parameters.propertyTypes.length > 0) {
    const typeMap: Record<string, string[]> = {
      'COM': ['commercial', 'retail', 'industrial', 'office', 'mixed use', 'warehouse', 'strip'],
      'SFR': ['residential', 'single family', 'house', 'home'],
      'CND': ['condo', 'condominium'],
      'RI': ['multi-family', 'multifamily', 'apartment', 'duplex', 'triplex'],
      'LL': ['land', 'lot', 'vacant'],
    };
    const searchTerms: string[] = [];
    for (const pt of parameters.propertyTypes) {
      searchTerms.push(...(typeMap[pt] || [pt.toLowerCase()]));
    }
    if (parameters.propertySubTypes) {
      searchTerms.push(...parameters.propertySubTypes.map((s: string) => s.toLowerCase()));
    }
    filtered = filtered.filter(p => {
      const pType = (p.propertyType || '').toLowerCase();
      return searchTerms.some(term => pType.includes(term));
    });
  }

  if (parameters.keywords && parameters.keywords.length > 0) {
    const kws = parameters.keywords.map((k: string) => k.toLowerCase());
    filtered = filtered.filter(p => {
      const text = `${p.address} ${p.city} ${p.propertyType} ${p.description || ''}`.toLowerCase();
      return kws.some((kw: string) => text.includes(kw));
    });
  }

  // Map to Deal Room format and score
  const scoredProperties = filtered.map(p => {
    const mapped = {
      listingId: p.sourceId,
      mlsNumber: p.sourceId,
      address: p.address || 'Unknown',
      city: p.city || '',
      state: p.state || 'MI',
      zip: p.zipCode || '',
      pricing: { listPrice: p.price || 0 },
      listPrice: p.price || 0,
      sqft: p.buildingSizeSqft || 0,
      squareFeet: p.buildingSizeSqft || 0,
      propertyType: p.propertyType || 'Commercial',
      dom: p.daysOnPlatform || 0,
      capRate: p.capRate || null,
      remarks: p.description || '',
      propertyUrl: p.propertyUrl || '',
      platform: p.platform,
      lotSizeAcres: p.lotSizeAcres || null,
      yearBuilt: (p as any).yearBuilt || null,
      features: [],
      bedrooms: null,
      bathrooms: null,
    };

    const scoreObj = evaluateDeal(mapped, investmentIntent || 'investor');

    return {
      ...mapped,
      dealScore: scoreObj.totalScore,
      scoreBreakdown: scoreObj.breakdown,
      dealReasons: scoreObj.reasons,
    };
  }).sort((a, b) => b.dealScore - a.dealScore).slice(0, top);

  return { scoredProperties, dataSource };
}


// ──────────────────────────────────────────────────────────
// MAIN ROUTE HANDLER
// ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, activeProperty, visibleProperties: clientVisibleProps, investmentIntent } = await req.json();

    // Build conversation context string
    const historyText = (history || [])
      .filter((m: any) => m.text)
      .map((m: any) => {
        let line = `${m.role === "user" ? "User" : "Agent"}: ${m.text}`;
        if (m.properties && m.properties.length > 0) {
          line += "\n[Properties shown: " + m.properties.map((p: any) =>
            `${p.address} (${p.city}, MI ${p.zip}) — $${(p.listPrice || 0).toLocaleString()}, Score: ${p.dealScore || '?'}, DOM: ${p.dom || '?'}, Type: ${p.propertyType}`
          ).join("; ") + "]";
        }
        return line;
      })
      .join("\n");

    const activePropertyContext = activeProperty
      ? `\n\nCurrently selected property in Deal Room: ${activeProperty.address}, ${activeProperty.city} MI ${activeProperty.zip} — $${(activeProperty.listPrice || 0).toLocaleString()}, Score: ${activeProperty.dealScore || '?'}, Type: ${activeProperty.propertyType}, DOM: ${activeProperty.dom || '?'}, Remarks: ${activeProperty.remarks || 'None'}`
      : "";

    // Build visible properties list from history (server-side) + any client-provided list
    const serverVisibleAddresses = extractVisibleAddresses(history);
    const allVisibleAddresses = [...new Set([
      ...serverVisibleAddresses,
      ...(clientVisibleProps || [])
    ])];
    const visiblePropertiesContext = allVisibleAddresses.length > 0
      ? `\n\nVISIBLE PROPERTIES ON SCREEN:\n${allVisibleAddresses.map(a => `- ${a}`).join("\n")}`
      : "\n\nVISIBLE PROPERTIES ON SCREEN: None";


    // ── STEP 1: CLASSIFY THE INTENT ──
    let intent = "general"; // Safe default — never triggers MLS unnecessarily
    try {
      const routerPrompt = `Conversation so far:\n${historyText}\n${activePropertyContext}${visiblePropertiesContext}\n\nLatest user message: "${prompt}"`;
      const classification = await generateAnalysis(ROUTER_SYSTEM, routerPrompt);
      if (classification && classification.intent) {
        const validIntents = ["search", "followup", "general", "property_lookup"];
        intent = validIntents.includes(classification.intent) ? classification.intent : "general";
      }
    } catch (err) {
      console.warn("Intent classification failed, defaulting to general. Error:", err);
      intent = "general";
    }

    console.log(`[Intent Router] "${prompt}" → ${intent}`);


    // ── STEP 2A: GENERAL — real estate Q&A, no MLS ──
    if (intent === "general") {
      try {
        const marketSnapshot = await buildMarketSnapshot();
        const conversationPrompt = `CONVERSATION HISTORY:\n${historyText}\n${activePropertyContext}${marketSnapshot}\n\nUSER: ${prompt}`;
        const response = await generateAnalysis(GENERAL_QA_SYSTEM, conversationPrompt);

        return NextResponse.json({
          intent: "general",
          headline: "Opulentus",
          text: response.text || "Happy to help with any real estate questions.",
          data: { properties: [] }
        });
      } catch (err) {
        console.error("General QA response failed:", err);
        return NextResponse.json({
          intent: "general",
          headline: "Opulentus",
          text: "I'm here to help. Could you rephrase your question?",
          data: { properties: [] }
        });
      }
    }


    // ── STEP 2B: FOLLOWUP — discuss a visible property, no MLS ──
    if (intent === "followup") {
      try {
        const marketSnapshot = await buildMarketSnapshot();
        const conversationPrompt = `CONVERSATION HISTORY:\n${historyText}\n${activePropertyContext}${marketSnapshot}\n\nUSER: ${prompt}`;
        const response = await generateAnalysis(FOLLOWUP_SYSTEM, conversationPrompt);

        return NextResponse.json({
          intent: "followup",
          headline: response.headline || "Opulentus",
          text: response.text || "Let me look into that for you.",
          data: { properties: [] }
        });
      } catch (err) {
        console.error("Followup response failed:", err);
        return NextResponse.json({
          intent: "followup",
          headline: "Processing",
          text: "I'm having trouble processing that. Could you rephrase?",
          data: { properties: [] }
        });
      }
    }


    // ── STEP 2C: PROPERTY_LOOKUP — targeted MLS lookup for a specific address ──
    if (intent === "property_lookup") {
      try {
        // Extract the address/MLS from the user's message using Gemini
        const extractPrompt = `The user wants to look up a specific property. Extract the address or MLS number from their message.
If you can identify a city, include it. If an MLS number is mentioned, include it.

User message: "${prompt}"

Return valid JSON:
{
  "address": "street address or null",
  "city": "city name or null",
  "mlsNumber": "MLS number or null",
  "keywords": ["any address keywords"] or null
}`;

        const extracted = await generateOrchestratorPlan(extractPrompt);

        // Build a narrow search filter for this specific property
        const lookupParams: any = {};
        if (extracted.city) lookupParams.city = extracted.city;
        if (extracted.keywords) lookupParams.keywords = extracted.keywords;
        if (extracted.address) {
          // Use address parts as keywords for a targeted search
          lookupParams.keywords = [...(lookupParams.keywords || []), ...extracted.address.split(/\s+/)];
        }

        const { scoredProperties, dataSource } = await searchApifyDB(lookupParams, investmentIntent || "investor", 3);

        // Generate a narrative about what was found
        if (scoredProperties.length > 0) {
          const propertyContext = scoredProperties.map((p: any) =>
            `${p.address}, ${p.city} MI ${p.zip} — $${(p.listPrice || 0).toLocaleString()}, Score: ${p.dealScore}, DOM: ${p.dom}, Type: ${p.propertyType}, Remarks: ${p.remarks || 'None'}`
          ).join("\n");

          const narrativePrompt = `The user asked: "${prompt}"\n\nHere is the property data I found:\n${propertyContext}`;
          let narrative;
          try {
            narrative = await generateAnalysis(PROPERTY_LOOKUP_SYSTEM, narrativePrompt);
          } catch {
            narrative = { headline: "Property Found", text: "Here's what I found." };
          }

          return NextResponse.json({
            intent: "property_lookup",
            headline: narrative.headline || "Property Found",
            text: narrative.text || "Here's what I found.",
            dataSource,
            data: { properties: scoredProperties }
          });
        } else {
          return NextResponse.json({
            intent: "general",
            headline: "Property Not Found",
            text: `I couldn't find a listing matching "${extracted.address || prompt}" in the MLS. It may be off-market, unlisted, or the address may need to be more specific. Want me to search the area instead?`,
            data: { properties: [] }
          });
        }
      } catch (err) {
        console.error("Property lookup failed:", err);
        return NextResponse.json({
          intent: "general",
          headline: "Lookup Issue",
          text: "I had trouble looking up that specific property. Could you double-check the address?",
          data: { properties: [] }
        });
      }
    }


    // ── STEP 2D: SEARCH — parse parameters and find properties ──
    const parserPrompt = `
      Conversation history:\n${historyText}\n${activePropertyContext}

      Latest user query: "${prompt}"
      
      Extract search parameters. If the user referenced criteria from earlier in the conversation (like a zip code, price range, or property type they mentioned before), USE those — don't ask again.
      
      Return valid JSON exactly matching this schema:
      {
        "intent": "search",
        "headline": "A short response headline",
        "parameters": {
          "city": "string or null",
          "county": "string or null",
          "zipCodes": ["string"] or null,
          "minPrice": "number or null",
          "maxPrice": "number or null",
          "minBeds": "number or null",
          "minBaths": "number or null",
          "minSqft": "number or null ('sqft' 'square feet' 'sf')",
          "maxSqft": "number or null",
          "maxDom": "number or null (if they ask for fresh/new listings)",
          "minDom": "number or null (if they ask for stale listings)",
          "propertyTypes": ["SFR", "CND", "RI", "COM", "LL"] or null,
          "propertySubTypes": ["Retail", "Industrial", "Office", "Mixed Use", "Warehouse", "Commercial"] or null,
          "zoning": ["string"] or null,
          "motivatedSeller": "boolean (true if asking for distressed, motivated, long DOM, or price drops)",
          "keywords": ["string"] or null
        }
      }
      
      MAPPING RULES:
      - Property types: SFR=Single Family, CND=Condo, RI=Multi-family, COM=Commercial, LL=Land.
      - Commercial Sub-Types: If they ask for "strip center", "plaza", "retail" -> use propertyTypes=["COM"] and propertySubTypes=["Retail"]. If they ask for "warehouse", "mechanic", "collision" -> use propertyTypes=["COM"] and propertySubTypes=["Industrial", "Warehouse"].
      - Return ONLY the JSON. No markdown formatting blocks.
    `;

    let plan;
    try {
      plan = await generateOrchestratorPlan(parserPrompt);
    } catch (geminiErr) {
      console.error("Gemini Parse failed", geminiErr);
      return NextResponse.json({ error: "Failed to understand query" }, { status: 500 });
    }

    if (!plan.parameters) {
      return NextResponse.json({
        intent: "general",
        headline: plan.headline || "Processing",
        text: plan.text || "Could you clarify what you're looking for?",
        data: { properties: [] }
      });
    }

    const { scoredProperties, dataSource } = await searchApifyDB(plan.parameters, investmentIntent || "investor");

    return NextResponse.json({
      intent: "search",
      headline: plan.headline || `Found ${scoredProperties.length} matches`,
      nextBestAction: "open_deal_room",
      dataSource,
      data: { properties: scoredProperties }
    });

  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Failed to process orchestrator command" }, { status: 500 });
  }
}

