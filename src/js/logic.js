/* Local-only state persistence, matching, recipe, shopping and analytics logic. */
const STORAGE_KEY = "mise-static-state-v1";
const irregular = { tomatoes: "tomato", potatoes: "potato", leaves: "leaf", loaves: "loaf", knives: "knife", berries: "berry" };
const units = new Set(["g", "kg", "ml", "l", "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons", "cup", "cups", "can", "cans", "pack", "packs", "slice", "slices", "clove", "cloves", "pinch", "handful", "bunch"]);
function singular(word) { if (irregular[word])
    return irregular[word]; if (word.endsWith("ies") && word.length > 4)
    return `${word.slice(0, -3)}y`; if (word.endsWith("ses"))
    return word.slice(0, -1); if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3)
    return word.slice(0, -1); return word; }
function normalise(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/pre[ -]?made/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map(singular).join(" ").trim(); }
function matchesName(a, b) { const one = normalise(a), two = normalise(b); if (!one || !two)
    return false; if (one === two || one.includes(two) || two.includes(one))
    return true; const left = one.split(" ").filter(t => t.length > 2), right = new Set(two.split(" ")); return left.length > 0 && left.every(t => right.has(t)); }
function cleanIngredient(line) { const before = line.replace(/^\s*[-*•]\s*/, "").replace(/^\[(stock|buy)\]\s*/i, "").split("|")[0].trim(); const words = before.replace(/^\d+[\d\s/.,-]*\s*/, "").split(/\s+/).filter(word => !units.has(normalise(word))); return words.join(" ").replace(/[,:;]+$/, "").trim(); }
function parseRecipeIngredients(text) { const lines = text.split(/\r?\n/); const start = lines.findIndex(line => /^\s*(ingredients|ingredients used)\s*:?\s*$/i.test(line)); const end = start >= 0 ? lines.findIndex((line, index) => index > start && /^\s*(steps|method|instructions)\s*:?\s*$/i.test(line)) : -1; const section = start >= 0 ? lines.slice(start + 1, end > start ? end : undefined) : lines.filter(line => /^\s*[-*•]\s+/.test(line)); return Array.from(new Set(section.filter(line => /^\s*[-*•]\s+/.test(line)).map(cleanIngredient).filter(name => name && normalise(name) !== "water"))); }
function recipeTitle(text) { const explicit = text.match(/^\s*TITLE\s*:\s*(.+)$/im)?.[1]; return (explicit || text.split(/\r?\n/).find(line => line.trim()) || "Untitled recipe").replace(/^#+\s*/, "").trim().slice(0, 90); }
function parseShoppingText(text) { const lines = text.split(/\r?\n/); const start = lines.findIndex(line => /^\s*\[?shopping\]?\s*:?\s*$/i.test(line)); const end = start >= 0 ? lines.findIndex((line, index) => index > start && /^\s*\[?end shopping\]?\s*$/i.test(line)) : -1; const chosen = start >= 0 ? lines.slice(start + 1, end > start ? end : undefined) : lines; return Array.from(new Set(chosen.flatMap(line => line.split(",")).map(line => line.replace(/^\s*[-*•]\s*/, "").replace(/^\[(buy|stock)\]\s*/i, "").split("|")[0].trim()).filter(Boolean))); }
function usageCount(name, recipes) { return recipes.reduce((sum, recipe) => sum + (recipe.ingredients.some(i => matchesName(i, name)) ? 1 : 0), 0); }
function analyticsFor(state, name) { return state.analytics[normalise(name)] || { shoppingAdds: 0, stockAdds: 0, stockedAt: [] }; }
function bumpAnalytics(state, name, kind, at = Date.now()) { const key = normalise(name), current = analyticsFor(state, name); return { ...state.analytics, [key]: kind === "shop" ? { ...current, shoppingAdds: current.shoppingAdds + 1, lastShoppingAt: at } : { ...current, stockAdds: current.stockAdds + 1, lastStockedAt: at, stockedAt: [...current.stockedAt.slice(-9), at] } }; }
function humanAge(timestamp) { if (!timestamp)
    return ""; const days = Math.floor((Date.now() - timestamp) / 86400000); if (days < 1)
    return "today"; if (days === 1)
    return "yesterday"; return `${days}d ago`; }
function smartRecommendations(state) {
    const inList = new Set(state.shopping.map(i => normalise(i.name)));
    const names = new Map();
    state.stock.forEach(i => names.set(normalise(i.name), i.name));
    state.recipes.flatMap(r => r.ingredients).forEach(name => names.set(normalise(name), name));
    stapleIdeas.forEach(name => names.set(normalise(name), name));
    Object.keys(state.analytics).forEach(key => { if (!names.has(key))
        names.set(key, key.replace(/\b\w/g, c => c.toUpperCase())); });
    return [...names.values()].filter(name => !inList.has(normalise(name))).map(name => {
        const item = state.stock.find(i => matchesName(i.name, name)), analytics = analyticsFor(state, name), recipes = usageCount(name, state.recipes);
        let score = stapleIdeas.some(s => matchesName(s, name)) ? 8 : 0;
        const reasons = [];
        if (item?.status === "out" || item?.quantity === 0) {
            score += 100;
            reasons.push("Out of stock");
        }
        else if (item?.status === "low") {
            score += 78;
            reasons.push("Running low");
        }
        if (recipes) {
            score += Math.min(48, recipes * 14);
            reasons.push(`Used in ${recipes} recipe${recipes === 1 ? "" : "s"}`);
        }
        if (analytics.shoppingAdds) {
            score += Math.min(40, analytics.shoppingAdds * 8);
            reasons.push(`Added ${analytics.shoppingAdds}× before`);
        }
        if (analytics.stockAdds > 1) {
            score += Math.min(24, analytics.stockAdds * 5);
            reasons.push(`Restocked ${analytics.stockAdds}×`);
        }
        if (analytics.lastShoppingAt && Date.now() - analytics.lastShoppingAt < 2 * 86400000)
            score -= 18;
        if (item && item.quantity > 2 && item.status === "ready")
            score -= 35;
        if (!reasons.length)
            reasons.push("Useful pantry unlock");
        return { name, score, reasons: reasons.slice(0, 2), source: item?.status === "out" || item?.status === "low" ? "restock" : "smart" };
    }).filter(r => r.score > 5).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 8);
}
function recentShopping(state) { return [...state.shopping].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5); }
function topRecipeItems(state) { return state.stock.map(item => ({ item, count: usageCount(item.name, state.recipes) })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 4); }
function frequentBuys(state) { return state.stock.map(item => ({ item, count: analyticsFor(state, item.name).shoppingAdds })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 4); }
function recipeAvailability(recipe, stock) { const available = stock.filter(i => i.quantity > 0 && i.status !== "out"); const matched = recipe.ingredients.filter(name => available.some(item => matchesName(name, item.name))); const missing = recipe.ingredients.filter(name => !available.some(item => matchesName(name, item.name))); return { matched, missing, ready: recipe.ingredients.length > 0 && missing.length === 0 }; }
function inferCategory(name, categories, stock) {
    const previous = stock.find(item => matchesName(item.name, name) && item.categoryId && categories.some(c => c.id === item.categoryId));
    if (previous)
        return previous.categoryId;
    const key = normalise(name);
    const groups = { Produce: ["tomato", "pepper", "carrot", "lettuce", "mushroom", "onion", "garlic", "potato", "lemon", "coriander", "fruit", "apple", "banana", "spinach"], Protein: ["pork", "beef", "chicken", "bacon", "tuna", "egg", "chorizo", "fish", "tofu"], Dairy: ["milk", "cream", "butter", "cheese", "mozzarella", "parmigiano", "yoghurt"], Pantry: ["pasta", "rice", "bread", "noodle", "oil", "vinegar", "flour", "chickpea"], Sauces: ["sauce", "pesto", "soy", "juice"], Spices: ["salt", "pepper", "paprika", "basil", "parsley", "rosemary", "seasoning", "bay"], Drinks: ["beer", "wine", "water", "juice"] };
    for (const [category, words] of Object.entries(groups)) {
        if (words.some(word => key.includes(word))) {
            const found = categories.find(c => normalise(c.name) === normalise(category));
            if (found)
                return found.id;
        }
    }
    return null;
}
function makePrompt(state, tone) {
    const available = state.stock.filter(i => i.quantity > 0 && i.status !== "out").map(i => `${i.name} (${i.quantity}${i.unit ? ` ${i.unit}` : ""}${i.status !== "ready" ? `, ${i.status}` : ""})`).join(", ");
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

OPTIONS FOR NOW
1. FAST + ALONE — genuinely quick, minimal washing up
2. MEDIUM — a little more effort, one portion
3. COOK ONCE — four freezer-friendly portions
4. WILD CARD — a clever cuisine or combination

PREP AHEAD
5. PREP AHEAD — include this when worthwhile. Suggest something I can start now but deliberately finish tomorrow or later because long inactive time improves it: for example a 4–48 hour marinade, overnight brine/soak/proof, slow ferment/pickle, cured preparation, or another long-resting technique. Prefer stock that is open, low, or likely to benefit from being used soon. Make it tempting enough that, while choosing tonight's meal, I might save this recipe for the next day. Clearly separate WHAT TO DO NOW from HOW TO FINISH LATER. Give refrigeration/storage instructions and conservative food-safety timing; never suggest leaving raw meat, fish, dairy, or other perishable food at room temperature for a long rest. If no sensible long-prep recipe fits the stock, say PREP AHEAD: SKIP rather than forcing one.

For every proposed recipe include cuisine, active/total time, exact amounts, substitutions, heat levels and visual doneness cues. Prioritise open and low items. Flag thawing. Never assume an unlisted ingredient is available.

Use this exact machine-readable format for every recipe you do provide:
=== RECIPE ===
TITLE: Recipe name
MODE: Fast | Medium | Cook once | Wild card | Prep ahead
SERVINGS: number
TIME: active minutes | total minutes
LEAD TIME: none | X hours | X days
INGREDIENTS:
- [STOCK] Exact stock item name | exact amount
- [BUY] Missing ingredient name | exact amount
STEPS:
1. Detailed step
=== END RECIPE ===

For PREP AHEAD, the numbered steps must explicitly say what I should do now, how to store/rest it, and what I should do tomorrow/later.

Then provide a strategic shopping-unlock list. This is NOT a combined list of every [BUY] ingredient used above. Recommend only 0–3 additional ingredients total, chosen as a set to unlock the maximum number and variety of realistic extra recipes when combined with CURRENT STOCK. Think of this as a small set-cover problem: prefer ingredients that complete many near-miss meals, avoid redundant picks that unlock mostly the same dishes, and favour versatile ingredients that connect strongly to several things I already have. Do not recommend an item merely because it is a generally useful staple. If buying nothing would meaningfully improve recipe coverage, return an empty block.

[SHOPPING]
- Item name | practical quantity | concise reason naming the kinds of recipes it unlocks
[END SHOPPING]
Use 0, 1, 2, or 3 lines only inside [SHOPPING]. No commentary inside marked blocks.`;
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.version === 1)
                return parsed;
        }
    }
    catch { }
    const state = freshState();
    try {
        const oldItems = JSON.parse(localStorage.getItem("mise-items") || "null");
        const oldShopping = JSON.parse(localStorage.getItem("mise-shopping") || "null");
        const oldRecipes = JSON.parse(localStorage.getItem("mise-recipes") || "null");
        if (oldItems) {
            state.stock = oldItems.map((item, index) => { const category = defaultCategories.find(c => normalise(c.name) === normalise(String(item.category || ""))); return { id: String(item.id || `migrated-${index}`), name: String(item.name || "Ingredient"), quantity: Number(item.quantity || 0), unit: String(item.unit || ""), categoryId: category?.id || null, status: (item.status === "fresh" ? "ready" : item.status || "ready"), createdAt: Date.now(), updatedAt: Date.now() }; });
        }
        if (oldShopping) {
            state.shopping = oldShopping.map((item, index) => ({ id: String(item.id || `shop-${index}`), name: String(item.name || "Item"), quantity: 1, unit: "", checked: Boolean(item.done), addedAt: Date.now() - index, source: "manual" }));
        }
        if (oldRecipes) {
            state.recipes = oldRecipes.map((recipe, index) => ({ id: String(recipe.id || `recipe-${index}`), title: String(recipe.title || "Recipe"), text: String(recipe.text || ""), ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(String) : [], createdAt: Number(recipe.createdAt || Date.now()) }));
        }
    }
    catch { }
    return state;
}
function saveState(state) { try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
catch { } }
function timeLabel(timestamp) { return humanAge(timestamp); }
function newShoppingItem(name, source) { return { id: uuid(), name: name.trim(), quantity: 1, unit: "", checked: false, addedAt: Date.now(), source }; }

const palette = ["#67a64a", "#d15336", "#5f91c9", "#c3903f", "#a45f91", "#e17833", "#3b9a9a", "#7b6bd1", "#db4f83"];
const statusButtons = [{ status: "frozen", label: "Frozen", icon: Snowflake }, { status: "open", label: "Open", icon: PackageOpen }, { status: "low", label: "Low", icon: Gauge }];
