/* Local-only state persistence, matching, recipe, shopping and analytics logic. */
const STORAGE_KEY = "mise-static-state-v1";
const irregular = { tomatoes: "tomato", potatoes: "potato", leaves: "leaf", loaves: "loaf", knives: "knife", berries: "berry" };
const units = new Set(["mg", "g", "kg", "ml", "cl", "dl", "l", "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons", "cup", "cups", "can", "cans", "pack", "packs", "slice", "slices", "clove", "cloves", "pinch", "handful", "bunch", "piece", "pieces", "item", "items"]);
const STOCK_STATUS_KEYS = ["open", "frozen", "expiring", "leftover"];
const STOCK_STATUS_LABELS = { open: "open", frozen: "frozen", expiring: "near expiry", leftover: "leftover" };

function itemStatuses(item) {
    if (!item) return [];
    if (Array.isArray(item.statuses)) return Array.from(new Set(item.statuses.filter(status => STOCK_STATUS_KEYS.includes(status))));
    return STOCK_STATUS_KEYS.includes(item.status) ? [item.status] : [];
}
function hasStatus(item, status) { return itemStatuses(item).includes(status); }
function statusText(item) { return itemStatuses(item).map(status => STOCK_STATUS_LABELS[status] || status); }
function toggleItemStatus(item, status) {
    const current = itemStatuses(item);
    return current.includes(status) ? current.filter(value => value !== status) : [...current, status];
}

function singular(word) {
    if (irregular[word]) return irregular[word];
    if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
    if (word.endsWith("ses")) return word.slice(0, -1);
    if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
    return word;
}
function normalise(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/pre[ -]?made/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map(singular).join(" ").trim();
}
function matchesName(a, b) {
    const one = normalise(a), two = normalise(b);
    if (!one || !two) return false;
    if (one === two || one.includes(two) || two.includes(one)) return true;
    const left = one.split(" ").filter(t => t.length > 2), right = new Set(two.split(" "));
    return left.length > 0 && left.every(t => right.has(t));
}

/* Quantity + unit intelligence. Base units are grams and millilitres. */
const unitAliases = {
    milligram: "mg", milligrams: "mg", mg: "mg",
    gram: "g", grams: "g", g: "g",
    kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg", kg: "kg",
    millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml", ml: "ml",
    centilitre: "cl", centilitres: "cl", centiliter: "cl", centiliters: "cl", cl: "cl",
    decilitre: "dl", decilitres: "dl", deciliter: "dl", deciliters: "dl", dl: "dl",
    litre: "l", litres: "l", liter: "l", liters: "l", l: "l",
    teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
    tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp",
    cup: "cup", cups: "cup",
    piece: "piece", pieces: "piece", item: "piece", items: "piece", pc: "piece", pcs: "piece",
    can: "can", cans: "can", pack: "pack", packs: "pack", packet: "pack", packets: "pack",
    slice: "slice", slices: "slice", clove: "clove", cloves: "clove", bunch: "bunch", bunches: "bunch"
};
const unitMeasures = {
    mg: { family: "mass", factor: 0.001 }, g: { family: "mass", factor: 1 }, kg: { family: "mass", factor: 1000 },
    ml: { family: "volume", factor: 1 }, cl: { family: "volume", factor: 10 }, dl: { family: "volume", factor: 100 }, l: { family: "volume", factor: 1000 },
    tsp: { family: "volume", factor: 5 }, tbsp: { family: "volume", factor: 15 }, cup: { family: "volume", factor: 240 }
};
function normaliseUnit(unit) {
    const raw = String(unit || "").trim().toLowerCase().replace(/\.$/, "");
    return unitAliases[raw] || raw;
}
function convertQuantity(quantity, fromUnit, toUnit) {
    const amount = Number(quantity);
    if (!Number.isFinite(amount)) return null;
    const from = normaliseUnit(fromUnit), to = normaliseUnit(toUnit);
    if (from === to) return amount;
    if (!from && !to) return amount;
    const a = unitMeasures[from], b = unitMeasures[to];
    if (a && b && a.family === b.family) return amount * a.factor / b.factor;
    return null;
}
function defaultIncrementForUnit(unit) {
    const value = normaliseUnit(unit);
    if (value === "kg" || value === "l") return 0.1;
    if (value === "g" || value === "ml") return 50;
    if (value === "cl") return 5;
    if (value === "dl") return 0.5;
    return 1;
}
function itemIncrement(item) {
    const value = Number(item?.increment);
    return Number.isFinite(value) && value > 0 ? value : defaultIncrementForUnit(item?.unit);
}
function roundQuantity(value) { return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000; }
function formatQuantity(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value || "");
    return Number.isInteger(num) ? String(num) : String(Math.round(num * 1000) / 1000);
}
function parseNumberish(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const mixed = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const fraction = raw.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);
    const num = Number(raw.replace(",", "."));
    return Number.isFinite(num) ? num : null;
}
function parseAmountText(value) {
    const text = String(value || "").trim();
    if (!text) return { quantity: null, unit: "", text: "" };
    const match = text.match(/^((?:\d+\s+)?\d+(?:[.,]\d+)?(?:\/\d+)?)\s*([^\s].*)?$/);
    if (!match) return { quantity: null, unit: "", text };
    return { quantity: parseNumberish(match[1]), unit: String(match[2] || "").trim(), text };
}
function amountLabel(ingredient) {
    if (!ingredient) return "";
    if (ingredient.amountText && ingredient.quantity == null) return ingredient.amountText;
    if (ingredient.quantity == null) return ingredient.unit || "";
    return `${formatQuantity(ingredient.quantity)}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
}

function cleanIngredient(line) {
    const before = String(line || "").replace(/^\s*[-*•]\s*/, "").replace(/^\[(stock|buy)\]\s*/i, "").split("|")[0].trim();
    const words = before.replace(/^\d+[\d\s/.,-]*\s*/, "").split(/\s+/).filter(word => !units.has(normalise(word)));
    return words.join(" ").replace(/[,:;]+$/, "").trim();
}
function recipeTitle(text) {
    const explicit = String(text || "").match(/^\s*TITLE\s*:\s*(.+)$/im)?.[1];
    return (explicit || String(text || "").split(/\r?\n/).find(line => line.trim()) || "Untitled recipe").replace(/^#+\s*/, "").trim().slice(0, 90);
}
function recipeIngredientObjects(recipe) {
    return (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map(value => {
        if (value && typeof value === "object") return { name: String(value.name || "Ingredient"), source: value.source === "buy" ? "buy" : "stock", quantity: value.quantity == null ? null : Number(value.quantity), unit: String(value.unit || ""), amountText: String(value.amountText || "") };
        return { name: String(value || "Ingredient"), source: "stock", quantity: null, unit: "", amountText: "" };
    }).filter(item => item.name.trim());
}
function ingredientNames(recipe) { return recipeIngredientObjects(recipe).map(item => item.name); }
function parseRecipeIngredients(text) { return parseSingleRecipe(text).ingredients; }

function parseDuration(value) {
    const text = String(value || "").toLowerCase();
    const hours = Number(text.match(/([\d.]+)\s*(?:h|hr|hour)/)?.[1] || 0);
    const mins = Number(text.match(/([\d.]+)\s*(?:m|min|minute)/)?.[1] || 0);
    if (hours || mins) return Math.round(hours * 60 + mins);
    const number = Number(text.match(/[\d.]+/)?.[0]);
    return Number.isFinite(number) ? Math.round(number) : null;
}
function lineField(text, name) {
    return String(text || "").match(new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*:\\s*(.+)$`, "im"))?.[1]?.trim() || "";
}
function parseIngredientLine(line) {
    const stripped = String(line || "").replace(/^\s*[-*•]\s*/, "").trim();
    const source = stripped.match(/^\[(stock|buy)\]\s*/i)?.[1]?.toLowerCase() || "stock";
    const body = stripped.replace(/^\[(stock|buy)\]\s*/i, "").trim();
    const parts = body.split("|").map(part => part.trim());
    if (parts.length >= 3) {
        const quantity = parseNumberish(parts[1]);
        return { name: parts[0], source, quantity, unit: parts[2], amountText: `${parts[1]}${parts[2] ? ` ${parts[2]}` : ""}`.trim() };
    }
    if (parts.length === 2) {
        const amount = parseAmountText(parts[1]);
        return { name: parts[0], source, quantity: amount.quantity, unit: amount.unit, amountText: parts[1] };
    }
    const leading = body.match(/^((?:\d+\s+)?\d+(?:[.,]\d+)?(?:\/\d+)?)\s+([a-zA-Z]+)?\s*(.+)$/);
    if (leading) {
        const maybeUnit = normaliseUnit(leading[2] || "");
        const knownUnit = maybeUnit && (unitMeasures[maybeUnit] || units.has(maybeUnit) || unitAliases[maybeUnit]);
        if (knownUnit) return { name: leading[3].trim(), source, quantity: parseNumberish(leading[1]), unit: leading[2] || "", amountText: `${leading[1]} ${leading[2] || ""}`.trim() };
    }
    return { name: cleanIngredient(body) || body, source, quantity: null, unit: "", amountText: "" };
}
function parseSteps(text) {
    const lines = String(text || "").split(/\r?\n/);
    const start = lines.findIndex(line => /^\s*(steps|method|instructions)\s*:?\s*$/i.test(line));
    if (start < 0) return [];
    const result = [];
    for (const line of lines.slice(start + 1)) {
        if (/^\s*===\s*END RECIPE\s*===/i.test(line)) break;
        const numbered = line.match(/^\s*(?:\d+[.)]|[-*•])\s*(.+)$/);
        if (numbered) result.push(numbered[1].trim());
        else if (line.trim() && result.length) result[result.length - 1] += ` ${line.trim()}`;
    }
    return result.filter(Boolean);
}
function parseSingleRecipe(text) {
    const raw = String(text || "").trim();
    const lines = raw.split(/\r?\n/);
    const ingredientStart = lines.findIndex(line => /^\s*(ingredients|ingredients used)\s*:?\s*$/i.test(line));
    const stepStart = lines.findIndex((line, index) => index > ingredientStart && /^\s*(steps|method|instructions)\s*:?\s*$/i.test(line));
    const ingredientLines = ingredientStart >= 0 ? lines.slice(ingredientStart + 1, stepStart > ingredientStart ? stepStart : undefined).filter(line => /^\s*[-*•]\s+/.test(line)) : lines.filter(line => /^\s*[-*•]\s+(?:\[(?:stock|buy)\])?/i.test(line));
    const ingredients = ingredientLines.map(parseIngredientLine).filter(item => item.name && normalise(item.name) !== "water");
    const timeLine = lineField(raw, "TIME");
    const activeField = lineField(raw, "ACTIVE MINUTES");
    const totalField = lineField(raw, "TOTAL MINUTES");
    const timeParts = timeLine.split("|");
    const activeMinutes = parseDuration(activeField || timeParts[0]);
    const totalMinutes = parseDuration(totalField || timeParts[1] || timeLine);
    const tags = lineField(raw, "TAGS").split(/[,;|]/).map(tag => tag.trim()).filter(Boolean).slice(0, 8);
    const mode = lineField(raw, "MODE") || "";
    if (mode && !tags.some(tag => normalise(tag) === normalise(mode))) tags.unshift(mode);
    return {
        id: uuid(),
        title: recipeTitle(raw),
        mode,
        cuisine: lineField(raw, "CUISINE"),
        tags,
        servings: Number(lineField(raw, "SERVINGS")) || null,
        activeMinutes,
        totalMinutes,
        leadTime: lineField(raw, "LEAD TIME") || "none",
        ingredients,
        steps: parseSteps(raw),
        text: raw,
        createdAt: Date.now(),
        timesCooked: 0,
        lastCookedAt: null
    };
}
function parseRecipeBlocks(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    const matches = [...raw.matchAll(/===\s*RECIPE\s*===([\s\S]*?)(?:===\s*END RECIPE\s*===|(?====\s*RECIPE\s*===)|$)/gi)];
    const blocks = matches.length ? matches.map(match => match[1].trim()).filter(Boolean) : [raw];
    return blocks.map(parseSingleRecipe).filter(recipe => recipe.title && !/^skip$/i.test(recipe.title));
}
function parseShoppingText(text) {
    const lines = String(text || "").split(/\r?\n/);
    const start = lines.findIndex(line => /^\s*\[?shopping\]?\s*:?\s*$/i.test(line));
    const end = start >= 0 ? lines.findIndex((line, index) => index > start && /^\s*\[?end shopping\]?\s*$/i.test(line)) : -1;
    const chosen = start >= 0 ? lines.slice(start + 1, end > start ? end : undefined) : lines;
    return Array.from(new Set(chosen.flatMap(line => line.split(",")).map(line => line.replace(/^\s*[-*•]\s*/, "").replace(/^\[(buy|stock)\]\s*/i, "").split("|")[0].trim()).filter(Boolean)));
}
function usageCount(name, recipes) { return recipes.reduce((sum, recipe) => sum + (ingredientNames(recipe).some(ingredient => matchesName(ingredient, name)) ? 1 : 0), 0); }

function analyticsFor(state, name) { return state.analytics[normalise(name)] || { shoppingAdds: 0, stockAdds: 0, stockedAt: [] }; }
function bumpAnalytics(state, name, kind, at = Date.now()) {
    const key = normalise(name), current = analyticsFor(state, name);
    return { ...state.analytics, [key]: kind === "shop" ? { ...current, shoppingAdds: current.shoppingAdds + 1, lastShoppingAt: at } : { ...current, stockAdds: current.stockAdds + 1, lastStockedAt: at, stockedAt: [...current.stockedAt.slice(-9), at] } };
}
function humanAge(timestamp) {
    if (!timestamp) return "";
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    return `${days}d ago`;
}
function smartRecommendations(state) {
    const inList = new Set(state.shopping.map(i => normalise(i.name)));
    const names = new Map();
    state.stock.forEach(i => names.set(normalise(i.name), i.name));
    state.recipes.flatMap(recipeIngredientObjects).forEach(ingredient => names.set(normalise(ingredient.name), ingredient.name));
    stapleIdeas.forEach(name => names.set(normalise(name), name));
    Object.keys(state.analytics).forEach(key => { if (!names.has(key)) names.set(key, key.replace(/\b\w/g, c => c.toUpperCase())); });
    return [...names.values()].filter(name => !inList.has(normalise(name))).map(name => {
        const item = state.stock.find(i => matchesName(i.name, name)), analytics = analyticsFor(state, name), recipes = usageCount(name, state.recipes);
        let score = stapleIdeas.some(s => matchesName(s, name)) ? 8 : 0;
        const reasons = [];
        if (item?.quantity === 0) { score += 100; reasons.push("Out of stock"); }
        else if (hasStatus(item, "expiring") || hasStatus(item, "leftover")) { score = -1000; reasons.push(hasStatus(item, "expiring") ? "Use before expiry" : "Use leftover first"); }
        if (recipes) { score += Math.min(48, recipes * 14); reasons.push(`Used in ${recipes} recipe${recipes === 1 ? "" : "s"}`); }
        if (analytics.shoppingAdds) { score += Math.min(40, analytics.shoppingAdds * 8); reasons.push(`Added ${analytics.shoppingAdds}× before`); }
        if (analytics.stockAdds > 1) { score += Math.min(24, analytics.stockAdds * 5); reasons.push(`Restocked ${analytics.stockAdds}×`); }
        if (analytics.lastShoppingAt && Date.now() - analytics.lastShoppingAt < 2 * 86400000) score -= 18;
        if (item && item.quantity > 2 && itemStatuses(item).length === 0) score -= 35;
        if (!reasons.length) reasons.push("Useful pantry unlock");
        return { name, score, reasons: reasons.slice(0, 2), source: item?.quantity === 0 ? "restock" : "smart" };
    }).filter(r => r.score > 5).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 8);
}
function recentShopping(state) { return [...state.shopping].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5); }
function topRecipeItems(state) { return state.stock.map(item => ({ item, count: usageCount(item.name, state.recipes) })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 4); }
function frequentBuys(state) { return state.stock.map(item => ({ item, count: analyticsFor(state, item.name).shoppingAdds })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 4); }

function recipeAvailability(recipe, stock) {
    const ingredients = recipeIngredientObjects(recipe);
    const entries = ingredients.map(ingredient => {
        const item = stock.find(candidate => candidate.quantity > 0 && matchesName(candidate.name, ingredient.name));
        if (!item) return { ingredient, item: null, state: "missing", requiredInStockUnit: null };
        if (ingredient.quantity == null) return { ingredient, item, state: "available", requiredInStockUnit: null };
        const converted = convertQuantity(ingredient.quantity, ingredient.unit, item.unit);
        if (converted == null) return { ingredient, item, state: "available", requiredInStockUnit: null };
        const enough = Number(item.quantity) + 1e-9 >= converted;
        return { ingredient, item, state: enough ? "available" : "short", requiredInStockUnit: converted, shortage: enough ? 0 : roundQuantity(converted - Number(item.quantity)) };
    });
    const matched = entries.filter(entry => entry.state === "available").map(entry => entry.ingredient.name);
    const short = entries.filter(entry => entry.state === "short").map(entry => entry.ingredient.name);
    const missing = entries.filter(entry => entry.state === "missing").map(entry => entry.ingredient.name);
    const ready = ingredients.length > 0 && !missing.length && !short.length;
    const availableCount = matched.length;
    return { entries, matched, short, missing, ready, total: ingredients.length, pct: ingredients.length ? Math.round(availableCount / ingredients.length * 100) : 0 };
}
function consumeRecipeStock(recipe, stock) {
    const ingredients = recipeIngredientObjects(recipe);
    let consumed = 0, skipped = 0, depleted = 0;
    const next = stock.map(item => ({ ...item, statuses: itemStatuses(item) }));
    ingredients.forEach(ingredient => {
        const index = next.findIndex(item => item.quantity > 0 && matchesName(item.name, ingredient.name));
        if (index < 0 || ingredient.quantity == null) { skipped += 1; return; }
        const item = next[index];
        const required = convertQuantity(ingredient.quantity, ingredient.unit, item.unit);
        if (required == null) { skipped += 1; return; }
        const quantity = roundQuantity(Math.max(0, Number(item.quantity) - required));
        if (quantity === 0 && Number(item.quantity) > 0) depleted += 1;
        next[index] = { ...item, quantity, statuses: quantity === 0 ? [] : itemStatuses(item), updatedAt: Date.now() };
        consumed += 1;
    });
    return { stock: next, consumed, skipped, depleted };
}
function recipeTotalMinutes(recipe) { return Number(recipe?.totalMinutes) || Number(recipe?.activeMinutes) || Infinity; }

function inferCategory(name, categories, stock) {
    const previous = stock.find(item => matchesName(item.name, name) && item.categoryId && categories.some(c => c.id === item.categoryId));
    if (previous) return previous.categoryId;
    const key = normalise(name);
    const groups = { Produce: ["tomato", "pepper", "carrot", "lettuce", "mushroom", "onion", "garlic", "potato", "lemon", "coriander", "fruit", "apple", "banana", "spinach"], Protein: ["pork", "beef", "chicken", "bacon", "tuna", "egg", "chorizo", "fish", "tofu"], Dairy: ["milk", "cream", "butter", "cheese", "mozzarella", "parmigiano", "yoghurt"], Pantry: ["pasta", "rice", "bread", "noodle", "oil", "vinegar", "flour", "chickpea"], Sauces: ["sauce", "pesto", "soy", "juice"], Spices: ["salt", "pepper", "paprika", "basil", "parsley", "rosemary", "seasoning", "bay"], Drinks: ["beer", "wine", "water", "juice"] };
    for (const [category, words] of Object.entries(groups)) {
        if (words.some(word => key.includes(word))) {
            const found = categories.find(c => normalise(c.name) === normalise(category));
            if (found) return found.id;
        }
    }
    return null;
}

function makePrompt(state, tone) {
    const categoryById = Object.fromEntries(state.categories.map(category => [category.id, category.name]));
    const available = state.stock.filter(i => i.quantity > 0).map(i => {
        const category = i.categoryId ? categoryById[i.categoryId] : "";
        const statuses = statusText(i);
        return `${i.name} (${formatQuantity(i.quantity)}${i.unit ? ` ${i.unit}` : ""}${category ? `, ${category}` : ""}${statuses.length ? `, ${statuses.join(", ")}` : ""})`;
    }).join(", ");
    const favourites = topRecipeItems(state).map(x => `${x.item.name} (${x.count} saved recipes)`).join(", ") || "No history yet";
    return `Act as my practical, inventive home cook. Use my real stock and return four clearly different recipes I could cook now, plus one PREP AHEAD recipe when the stock genuinely supports it. The prep-ahead recipe is intentionally allowed to be for tomorrow or later rather than tonight.

KITCHEN
- Hob
- Conventional oven (no fan)
- Very small air fryer
- Default: 1 portion
- Longer freezer-friendly meals: 4 portions, eat 1 and freeze 3
- Portuguese food matters, but include Mediterranean, South American and Asian ideas
- Preference: ${tone === "healthy" ? "health-forward and deeply flavourful" : tone === "comfort" ? "bold comfort food without being careless" : "mostly healthy, always flavour-first, occasional cheaty option"}

CURRENT STOCK
${available}

LOCAL HABITS
Frequently represented in saved recipes: ${favourites}

STOCK TAGS
- Tags are independent and can stack. An item can be open + near expiry, frozen + leftover, or any other sensible combination.
- open = the package/container has been opened.
- near expiry = use-soon urgency.
- frozen = currently frozen and may need thawing or direct-from-frozen handling.
- leftover = already cooked/prepared food, not a raw ingredient. A leftover can be reheated and plated as a side/base, or safely repurposed inside another dish. Do not tell me to cook a leftover from raw again. If a leftover is also frozen, account for safe thawing/reheating.

OPTIONS FOR NOW
1. FAST + ALONE — genuinely quick, minimal washing up
2. MEDIUM — a little more effort, one portion
3. COOK ONCE — four freezer-friendly portions
4. WILD CARD — a clever cuisine or combination

PREP AHEAD
5. PREP AHEAD — include this when worthwhile. Suggest something I can start now but deliberately finish tomorrow or later because long inactive time improves it: for example a 4–48 hour marinade, overnight brine/soak/proof, slow ferment/pickle, cured preparation, or another long-resting technique. Prefer stock that is open, near expiry, or otherwise likely to benefit from being used soon. Make it tempting enough that, while choosing tonight's meal, I might save this recipe for the next day. Clearly separate WHAT TO DO NOW from HOW TO FINISH LATER. Give refrigeration/storage instructions and conservative food-safety timing; never suggest leaving raw meat, fish, dairy, or other perishable food at room temperature for a long rest. If no sensible long-prep recipe fits the stock, say PREP AHEAD: SKIP rather than forcing one.

For every proposed recipe include cuisine, tags, active/total time, exact measurable amounts, substitutions, heat levels and visual doneness cues. Prioritise near-expiry items and refrigerated leftovers first, then opened ingredients and genuinely fresh produce. Treat vegetables, leafy greens, mushrooms, fresh fruit, fresh herbs and similar short-lived ingredients as use-soon by default even when they have no urgency tag. Leftovers are already cooked/prepared: use them as a ready-made component, side, base, filling or repurposed ingredient, and only describe reheating/crisping/seasoning/combining steps that are still needed. Frozen leftovers are available but are not automatically urgent; flag appropriate thawing/reheating. Never assume an unlisted ingredient is available.

IMPORTANT FOR STOCK TRACKING: for every [STOCK] ingredient, copy its stock name exactly. Whenever practical, express the recipe amount in the same unit shown in CURRENT STOCK, or a directly convertible metric unit (g↔kg, ml↔cl↔dl↔L). Avoid vague amounts such as "some" for stock ingredients when a realistic quantity can be stated.

Use this exact machine-readable format for every recipe you do provide:
=== RECIPE ===
TITLE: Recipe name
MODE: Fast | Medium | Cook once | Wild card | Prep ahead
CUISINE: cuisine or style
TAGS: 2-5 short comma-separated tags such as quick, Portuguese, pasta, freezer-friendly, leftover-friendly
SERVINGS: number
ACTIVE MINUTES: number
TOTAL MINUTES: number
LEAD TIME: none | X hours | X days
INGREDIENTS:
- [STOCK] Exact stock item name | numeric amount | unit
- [BUY] Missing ingredient name | numeric amount | unit
STEPS:
1. One complete actionable step, including heat/time/doneness cues where relevant.
2. Next complete step.
=== END RECIPE ===

Use an empty unit after the final | for countable ingredients with no unit. For PREP AHEAD, the numbered steps must explicitly say what I should do now, how to store/rest it, and what I should do tomorrow/later.

Then provide a strategic shopping-unlock list. This is NOT a combined list of every [BUY] ingredient used above. Recommend only 0–3 additional ingredients total, chosen as a set to unlock the maximum number and variety of realistic extra recipes when combined with CURRENT STOCK. Think of this as a small set-cover problem: prefer ingredients that complete many near-miss meals, avoid redundant picks that unlock mostly the same dishes, and favour versatile ingredients that connect strongly to several things I already have. Do not recommend an item merely because it is a generally useful staple. If buying nothing would meaningfully improve recipe coverage, return an empty block.

[SHOPPING]
- Item name | practical quantity | concise reason naming the kinds of recipes it unlocks
[END SHOPPING]
Use 0, 1, 2, or 3 lines only inside [SHOPPING]. No commentary inside marked blocks.`;
}

function migrateLegacyStatuses(state) {
    if (!state || !Array.isArray(state.stock)) return state;
    return {
        ...state,
        stock: state.stock.map(item => {
            const legacy = item.status === "low" || item.status === "fresh" || item.status === "ready" || item.status === "out" ? [] : itemStatuses(item);
            const statuses = Array.isArray(item.statuses) ? itemStatuses(item) : legacy;
            const { status: _legacyStatus, ...rest } = item;
            return { ...rest, statuses, increment: itemIncrement(item) };
        }),
        recipes: (Array.isArray(state.recipes) ? state.recipes : []).map((recipe, index) => {
            if (recipe && Array.isArray(recipe.ingredients) && recipe.ingredients.some(value => value && typeof value === "object")) {
                return { ...recipe, id: String(recipe.id || `recipe-${index}`), ingredients: recipeIngredientObjects(recipe), steps: Array.isArray(recipe.steps) ? recipe.steps.map(String) : parseSteps(recipe.text || ""), tags: Array.isArray(recipe.tags) ? recipe.tags.map(String) : [], createdAt: Number(recipe.createdAt || Date.now()), timesCooked: Number(recipe.timesCooked || 0), lastCookedAt: recipe.lastCookedAt || null };
            }
            const parsed = parseSingleRecipe(recipe?.text || `TITLE: ${recipe?.title || "Recipe"}\nINGREDIENTS:\n${(recipe?.ingredients || []).map(name => `- ${name}`).join("\n")}\nSTEPS:`);
            return { ...parsed, id: String(recipe?.id || `recipe-${index}`), title: String(recipe?.title || parsed.title), createdAt: Number(recipe?.createdAt || Date.now()) };
        })
    };
}


/* Device-to-device transfer. The payload is kept in the URL fragment, so it is
   never sent to GitHub Pages. Incoming data is merged by human-facing names:
   matching records update, new records are added, and receiver-only records stay. */
const TRANSFER_PARAM = "mise-transfer";
const TRANSFER_FALLBACK_URL = "https://anjomort0.github.io/cooking_prompt_generator/";

function bytesToBase64Url(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value) {
    let base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
async function compressTransferText(text) {
    const source = new TextEncoder().encode(text);
    if (typeof CompressionStream !== "function") return `r.${bytesToBase64Url(source)}`;
    try {
        const stream = new Blob([source]).stream().pipeThrough(new CompressionStream("gzip"));
        const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
        return `g.${bytesToBase64Url(compressed)}`;
    }
    catch { return `r.${bytesToBase64Url(source)}`; }
}
async function decompressTransferText(token) {
    const [mode, encoded] = String(token || "").split(".", 2);
    if (!encoded || !["g", "r"].includes(mode)) throw new Error("Invalid Mise transfer link");
    const bytes = base64UrlToBytes(encoded);
    if (mode === "r") return new TextDecoder().decode(bytes);
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot unpack the transfer link");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
function transferBaseUrl() {
    try {
        const current = new URL(location.href);
        if (current.protocol === "http:" || current.protocol === "https:") {
            if (!["localhost", "127.0.0.1"].includes(current.hostname)) { current.hash = ""; current.search = ""; return current.href; }
        }
    }
    catch { }
    return TRANSFER_FALLBACK_URL;
}
async function makeTransferLink(state) {
    const payload = { kind: "mise-transfer", version: 1, createdAt: Date.now(), state: migrateLegacyStatuses(state) };
    const encoded = await compressTransferText(JSON.stringify(payload));
    return `${transferBaseUrl()}#${TRANSFER_PARAM}=${encoded}`;
}
function transferTokenFromLocation() {
    try { return new URLSearchParams(String(location.hash || "").replace(/^#/, "")).get(TRANSFER_PARAM) || ""; }
    catch { return ""; }
}
function clearTransferHash() {
    try { const url = new URL(location.href); url.hash = ""; history.replaceState(null, "", url.href); } catch { }
}
async function decodeTransferLinkToken(token) {
    const payload = JSON.parse(await decompressTransferText(token));
    if (payload?.kind !== "mise-transfer" || payload.version !== 1 || !payload.state || !Array.isArray(payload.state.stock) || !Array.isArray(payload.state.categories)) throw new Error("Invalid Mise transfer data");
    return { ...payload, state: migrateLegacyStatuses(payload.state) };
}
function mergeAnalytics(current = {}, incoming = {}) {
    const result = { ...current };
    for (const [key, value] of Object.entries(incoming || {})) {
        const existing = result[key] || {};
        const times = Array.from(new Set([...(existing.stockedAt || []), ...(value?.stockedAt || [])].map(Number).filter(Number.isFinite))).sort((a, b) => a - b).slice(-20);
        result[key] = {
            ...existing, ...value,
            shoppingAdds: Math.max(Number(existing.shoppingAdds || 0), Number(value?.shoppingAdds || 0)),
            stockAdds: Math.max(Number(existing.stockAdds || 0), Number(value?.stockAdds || 0)),
            lastShoppingAt: Math.max(Number(existing.lastShoppingAt || 0), Number(value?.lastShoppingAt || 0)) || undefined,
            lastStockedAt: Math.max(Number(existing.lastStockedAt || 0), Number(value?.lastStockedAt || 0)) || undefined,
            stockedAt: times
        };
    }
    return result;
}
function mergeNamedRecords(current, incoming, nameOf, prepareIncoming = value => value) {
    const records = [...(current || [])];
    let added = 0, updated = 0;
    for (const raw of incoming || []) {
        const value = prepareIncoming(raw);
        const key = normalise(nameOf(value));
        if (!key) continue;
        const index = records.findIndex(existing => normalise(nameOf(existing)) === key);
        if (index >= 0) { records[index] = { ...records[index], ...value, id: records[index].id || value.id || uuid() }; updated++; }
        else { records.push({ ...value, id: value.id || uuid() }); added++; }
    }
    return { records, added, updated };
}
function mergeTransferredState(currentState, incomingState) {
    const current = migrateLegacyStatuses(currentState);
    const incoming = migrateLegacyStatuses(incomingState);

    const categories = [...(current.categories || [])];
    const categoryMap = new Map();
    let categoriesAdded = 0, categoriesUpdated = 0;
    for (const category of incoming.categories || []) {
        const key = normalise(category.name);
        if (!key) continue;
        const index = categories.findIndex(existing => normalise(existing.name) === key);
        if (index >= 0) {
            const targetId = categories[index].id;
            categories[index] = { ...categories[index], ...category, id: targetId };
            categoryMap.set(category.id, targetId); categoriesUpdated++;
        } else {
            let id = category.id || uuid();
            if (categories.some(existing => existing.id === id)) id = uuid();
            categories.push({ ...category, id });
            categoryMap.set(category.id, id); categoriesAdded++;
        }
    }

    const stockMerge = mergeNamedRecords(current.stock, incoming.stock, item => item.name, item => ({
        ...item,
        categoryId: item.categoryId ? (categoryMap.get(item.categoryId) || (categories.some(category => category.id === item.categoryId) ? item.categoryId : null)) : null,
        statuses: itemStatuses(item),
        increment: itemIncrement(item)
    }));
    const recipeMerge = mergeNamedRecords(current.recipes, incoming.recipes, recipe => recipe.title, recipe => ({
        ...recipe, ingredients: recipeIngredientObjects(recipe), steps: Array.isArray(recipe.steps) ? recipe.steps.map(String) : [], tags: Array.isArray(recipe.tags) ? recipe.tags.map(String) : []
    }));
    const shoppingMerge = mergeNamedRecords(current.shopping, incoming.shopping, item => item.name, item => ({ ...item, quantity: Number(item.quantity || 1), checked: Boolean(item.checked) }));

    const activityKey = entry => `${entry?.type || ""}|${entry?.label || ""}|${Number(entry?.at || 0)}`;
    const seenActivity = new Set();
    const activity = [...(incoming.activity || []), ...(current.activity || [])].filter(entry => { const key = activityKey(entry); if (seenActivity.has(key)) return false; seenActivity.add(key); return true; }).sort((a, b) => Number(b.at || 0) - Number(a.at || 0)).slice(0, 100);

    return {
        state: {
            ...current,
            version: 1,
            categories,
            stock: stockMerge.records,
            recipes: recipeMerge.records,
            shopping: shoppingMerge.records,
            analytics: mergeAnalytics(current.analytics, incoming.analytics),
            activity
        },
        summary: {
            categoriesAdded, categoriesUpdated,
            stockAdded: stockMerge.added, stockUpdated: stockMerge.updated,
            recipesAdded: recipeMerge.added, recipesUpdated: recipeMerge.updated,
            shoppingAdded: shoppingMerge.added, shoppingUpdated: shoppingMerge.updated
        }
    };
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.version === 1) return migrateLegacyStatuses(parsed);
        }
    }
    catch { }
    const state = freshState();
    try {
        const oldItems = JSON.parse(localStorage.getItem("mise-items") || "null");
        const oldShopping = JSON.parse(localStorage.getItem("mise-shopping") || "null");
        const oldRecipes = JSON.parse(localStorage.getItem("mise-recipes") || "null");
        if (oldItems) {
            state.stock = oldItems.map((item, index) => {
                const category = defaultCategories.find(c => normalise(c.name) === normalise(String(item.category || "")));
                const legacyStatus = String(item.status || "");
                const statuses = STOCK_STATUS_KEYS.includes(legacyStatus) ? [legacyStatus] : [];
                const unit = String(item.unit || "");
                return { id: String(item.id || `migrated-${index}`), name: String(item.name || "Ingredient"), quantity: Number(item.quantity || 0), unit, increment: defaultIncrementForUnit(unit), categoryId: category?.id || null, statuses, createdAt: Date.now(), updatedAt: Date.now() };
            });
        }
        if (oldShopping) state.shopping = oldShopping.map((item, index) => ({ id: String(item.id || `shop-${index}`), name: String(item.name || "Item"), quantity: 1, unit: "", checked: Boolean(item.done), addedAt: Date.now() - index, source: "manual" }));
        if (oldRecipes) state.recipes = oldRecipes.map((recipe, index) => ({ ...parseSingleRecipe(recipe.text || `TITLE: ${recipe.title || "Recipe"}`), id: String(recipe.id || `recipe-${index}`), title: String(recipe.title || "Recipe"), createdAt: Number(recipe.createdAt || Date.now()) }));
    }
    catch { }
    return migrateLegacyStatuses(state);
}
function saveState(state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { } }
function timeLabel(timestamp) { return humanAge(timestamp); }
function newShoppingItem(name, source) { return { id: uuid(), name: name.trim(), quantity: 1, unit: "", checked: false, addedAt: Date.now(), source }; }

const palette = ["#67a64a", "#d15336", "#5f91c9", "#c3903f", "#a45f91", "#e17833", "#3b9a9a", "#7b6bd1", "#db4f83"];
const statusButtons = [
    { status: "frozen", label: "Frozen", icon: Snowflake },
    { status: "open", label: "Open", icon: PackageOpen },
    { status: "expiring", label: "Near expiry", icon: CalendarClock },
    { status: "leftover", label: "Leftover", icon: Utensils }
];
