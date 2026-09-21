/* Mise UI. Loaded as a classic script so file:// works without a web server. */
function Modal({ title, onClose, children, wide = false }) {
    useEffect(() => { const close = (event) => event.key === "Escape" && onClose(); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
    return h("div", { className: "modal-backdrop", role: "presentation", onMouseDown: event => event.target === event.currentTarget && onClose() },
        h("section", { className: `modal ${wide ? "modal-wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
            h("header", null,
                h("h2", null, title),
                h("button", { className: "icon-button", onClick: onClose, "aria-label": "Close" },
                    h(X, null))),
            children));
}
/* Category icons stay semantic rather than using coloured circles alone. */
const categoryIconChoices = [
    { id: "", label: "Auto", Icon: Tags },
    { id: "apple", label: "Produce", Icon: Apple },
    { id: "carrot", label: "Veg", Icon: Carrot },
    { id: "beef", label: "Protein", Icon: Beef },
    { id: "milk", label: "Dairy", Icon: Milk },
    { id: "package", label: "Pantry", Icon: Package },
    { id: "sprout", label: "Herbs", Icon: Sprout },
    { id: "cup-soda", label: "Drinks", Icon: CupSoda },
    { id: "candy", label: "Sweets", Icon: Candy },
    { id: "cookie", label: "Baking", Icon: Cookie },
    { id: "cake-slice", label: "Dessert", Icon: CakeSlice },
    { id: "coffee", label: "Hot drinks", Icon: Coffee },
    { id: "sandwich", label: "Meals", Icon: Sandwich },
    { id: "wheat", label: "Grains", Icon: Wheat }
];
const categoryIconMap = Object.fromEntries(categoryIconChoices.filter(choice => choice.id).map(choice => [choice.id, choice.Icon]));
function categoryIconFor(category) {
    if (category?.icon && categoryIconMap[category.icon]) return categoryIconMap[category.icon];
    const key = normalise(`${category?.id || ""} ${category?.name || ""}`);
    if (/sweet|chocolate|dessert|candy|confection/.test(key)) return Candy;
    if (/bake|biscuit|cookie|pastry|cake/.test(key)) return Cookie;
    if (/produce|fruit|vegetable|veg|fresh/.test(key)) return Apple;
    if (/protein|meat|fish|seafood/.test(key)) return Beef;
    if (/dairy|milk|cheese/.test(key)) return Milk;
    if (/pantry|cupboard|dry|staple/.test(key)) return Package;
    if (/sauce|condiment|dip/.test(key)) return Soup;
    if (/spice|herb|season/.test(key)) return Sprout;
    if (/drink|beverage/.test(key)) return CupSoda;
    return Tags;
}
function CategoryGlyph({ category, size = 16 }) {
    const Icon = categoryIconFor(category);
    return h("span", { className: "category-glyph", style: { "--category": category?.color || "#92958d" } }, h(Icon, { size }));
}

function Stepper({ value, onMinus, onPlus, label }) { return h("div", { className: "stepper", "aria-label": label },
    h("button", { onClick: onMinus, "aria-label": `Decrease ${label}` },
        h(Minus, null)),
    h("strong", null, formatQuantity(value)),
    h("button", { onClick: onPlus, "aria-label": `Increase ${label}` },
        h(Plus, null))); }
function App() {
    const [state, setState] = useState(() => loadState());
    const [tab, setTab] = useState("stock");
    const [query, setQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [showAdd, setShowAdd] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [incomingTransfer, setIncomingTransfer] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [shoppingText, setShoppingText] = useState("");
    const [shoppingImport, setShoppingImport] = useState("");
    const [recipeDraft, setRecipeDraft] = useState("");
    const [showRecipeImport, setShowRecipeImport] = useState(false);
    const [selectedRecipeId, setSelectedRecipeId] = useState(null);
    const [recipeQuery, setRecipeQuery] = useState("");
    const [recipeAvailabilityFilter, setRecipeAvailabilityFilter] = useState("all");
    const [recipeTagFilter, setRecipeTagFilter] = useState("all");
    const [recipeSort, setRecipeSort] = useState("newest");
    const [tone, setTone] = useState("balanced");
    const [toast, setToast] = useState("");
    const [online, setOnline] = useState(navigator.onLine);
    const [newItem, setNewItem] = useState({ name: "", quantity: 1, unit: "", increment: 1, categoryId: state.categories[0]?.id || "", statuses: [] });
    const importRef = useRef(null);
    useEffect(() => saveState(state), [state]);
    useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
    const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 1800); };
    useEffect(() => {
        const token = transferTokenFromLocation();
        if (!token) return;
        let cancelled = false;
        decodeTransferLinkToken(token).then(payload => { if (!cancelled) setIncomingTransfer(payload); }).catch(() => { if (!cancelled) { clearTransferHash(); notify("That Mise transfer link is not valid"); } });
        return () => { cancelled = true; };
    }, []);
    const activity = (type, label) => ({ id: uuid(), type, label, at: Date.now() });
    const addToShopping = (name, source = "manual") => setState(current => { const existing = current.shopping.find(item => matchesName(item.name, name)); const shopping = existing ? current.shopping.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + 1, addedAt: Date.now(), checked: false } : item) : [newShoppingItem(name, source), ...current.shopping]; return { ...current, shopping, analytics: bumpAnalytics(current, name, "shop"), activity: [activity("shop", `${name} added to shopping`), ...current.activity].slice(0, 100) }; });
    const adjustStock = (id, direction) => setState(current => ({ ...current, stock: current.stock.map(item => { if (item.id !== id)
            return item; const quantity = roundQuantity(Math.max(0, Number(item.quantity) + itemIncrement(item) * direction)); return { ...item, quantity, statuses: quantity === 0 ? [] : itemStatuses(item), updatedAt: Date.now() }; }) }));
    const toggleStatus = (id, status) => setState(current => {
        const target = current.stock.find(item => item.id === id);
        const wasActive = target ? hasStatus(target, status) : false;
        const label = STOCK_STATUS_LABELS[status] || status;
        return {
            ...current,
            stock: current.stock.map(item => item.id === id ? { ...item, quantity: item.quantity || 1, statuses: toggleItemStatus(item, status), updatedAt: Date.now() } : item),
            activity: [activity("status", `${target?.name || "Item"} ${wasActive ? "unmarked" : "marked"} ${label}`), ...current.activity].slice(0, 100)
        };
    });
    const adjustShopping = (id, amount) => setState(current => ({ ...current, shopping: current.shopping.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item) }));
    const stockShoppingItem = (shoppingItem) => setState(current => { const existing = current.stock.find(item => matchesName(item.name, shoppingItem.name)); const stock = existing ? current.stock.map(item => item.id === existing.id ? { ...item, quantity: roundQuantity(Number(item.quantity) + Number(shoppingItem.quantity)), statuses: itemStatuses(item), updatedAt: Date.now() } : item) : [{ id: uuid(), name: shoppingItem.name, quantity: shoppingItem.quantity, unit: shoppingItem.unit, increment: defaultIncrementForUnit(shoppingItem.unit), categoryId: inferCategory(shoppingItem.name, current.categories, current.stock), statuses: [], createdAt: Date.now(), updatedAt: Date.now() }, ...current.stock]; return { ...current, stock, shopping: current.shopping.filter(item => item.id !== shoppingItem.id), analytics: bumpAnalytics(current, shoppingItem.name, "stock"), activity: [activity("stock", `${shoppingItem.quantity} ${shoppingItem.name} moved into stock`), ...current.activity].slice(0, 100) }; });
    const stockChecked = () => { const checked = state.shopping.filter(i => i.checked); checked.forEach(stockShoppingItem); notify(`${checked.length} item${checked.length === 1 ? "" : "s"} stocked`); };
    const saveRecipe = () => {
        if (!recipeDraft.trim()) return;
        const recipes = parseRecipeBlocks(recipeDraft);
        if (!recipes.length) { notify("No recipe found"); return; }
        setState(current => ({
            ...current,
            recipes: [...recipes, ...current.recipes],
            activity: [...recipes.map(recipe => activity("recipe", `${recipe.title} saved`)), ...current.activity].slice(0, 100)
        }));
        setRecipeDraft("");
        setShowRecipeImport(false);
        setSelectedRecipeId(recipes[0].id);
        notify(`${recipes.length} recipe${recipes.length === 1 ? "" : "s"} imported`);
    };
    const importShopping = () => { const names = parseShoppingText(shoppingImport); names.forEach(name => addToShopping(name, "import")); setShoppingImport(""); setShowImport(false); notify(`${names.length} item${names.length === 1 ? "" : "s"} imported`); };
    const smart = useMemo(() => smartRecommendations(state), [state]);
    const recent = useMemo(() => recentShopping(state), [state]);
    const recipeStars = useMemo(() => topRecipeItems(state), [state]);
    const frequent = useMemo(() => frequentBuys(state), [state]);
    const useFirst = useMemo(() => state.stock.filter(item => item.quantity > 0 && (hasStatus(item, "expiring") || hasStatus(item, "open") || hasStatus(item, "leftover"))).sort((a, b) => {
        const rank = item => hasStatus(item, "expiring") ? 0 : hasStatus(item, "leftover") && !hasStatus(item, "frozen") ? 1 : hasStatus(item, "open") ? 2 : 3;
        return rank(a) - rank(b) || a.updatedAt - b.updatedAt;
    }), [state.stock]);
    const visibleStock = useMemo(() => state.stock.filter(item => (categoryFilter === "all" || categoryFilter === "unsorted" ? categoryFilter !== "unsorted" || !item.categoryId : item.categoryId === categoryFilter) && (statusFilter === "all" || (statusFilter === "out" ? item.quantity === 0 : hasStatus(item, statusFilter))) && normalise(item.name).includes(normalise(query))).sort((a, b) => (a.quantity === 0 ? 1 : 0) - (b.quantity === 0 ? 1 : 0) || a.name.localeCompare(b.name)), [state.stock, categoryFilter, statusFilter, query]);
    const recipeTags = useMemo(() => Array.from(new Set(state.recipes.flatMap(recipe => recipe.tags || []).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [state.recipes]);
    const visibleRecipes = useMemo(() => state.recipes.filter(recipe => {
        const availability = recipeAvailability(recipe, state.stock);
        if (recipeQuery && !normalise(`${recipe.title} ${recipe.cuisine || ""} ${(recipe.tags || []).join(" ")}`).includes(normalise(recipeQuery))) return false;
        if (recipeAvailabilityFilter === "ready" && !availability.ready) return false;
        if (recipeAvailabilityFilter === "missing" && availability.ready) return false;
        if (recipeAvailabilityFilter === "prep" && normalise(recipe.mode) !== "prep ahead") return false;
        if (recipeTagFilter !== "all" && !(recipe.tags || []).some(tag => normalise(tag) === normalise(recipeTagFilter))) return false;
        return true;
    }).sort((a, b) => {
        if (recipeSort === "quickest") return recipeTotalMinutes(a) - recipeTotalMinutes(b) || a.title.localeCompare(b.title);
        if (recipeSort === "match") return recipeAvailability(b, state.stock).pct - recipeAvailability(a, state.stock).pct || recipeTotalMinutes(a) - recipeTotalMinutes(b);
        if (recipeSort === "cooked") return Number(b.timesCooked || 0) - Number(a.timesCooked || 0) || Number(b.createdAt) - Number(a.createdAt);
        if (recipeSort === "az") return a.title.localeCompare(b.title);
        return Number(b.createdAt) - Number(a.createdAt);
    }), [state.recipes, state.stock, recipeQuery, recipeAvailabilityFilter, recipeTagFilter, recipeSort]);
    const selectedRecipe = state.recipes.find(recipe => recipe.id === selectedRecipeId) || null;
    const prompt = useMemo(() => makePrompt(state, tone), [state, tone]);
    const addStock = (event) => { event.preventDefault(); if (!newItem.name.trim())
        return; setState(current => ({ ...current, stock: [{ id: uuid(), name: newItem.name.trim(), quantity: Math.max(0, Number(newItem.quantity) || 0), unit: newItem.unit.trim(), increment: Number(newItem.increment) > 0 ? Number(newItem.increment) : defaultIncrementForUnit(newItem.unit), categoryId: newItem.categoryId || null, statuses: Number(newItem.quantity) === 0 ? [] : itemStatuses(newItem), createdAt: Date.now(), updatedAt: Date.now() }, ...current.stock], activity: [activity("stock", `${newItem.name.trim()} added to stock`), ...current.activity].slice(0, 100) })); setNewItem({ name: "", quantity: 1, unit: "", increment: 1, categoryId: state.categories[0]?.id || "", statuses: [] }); setShowAdd(false); notify("Added to stock"); };
    const editStock = (item) => setEditingItem({ ...item, increment: itemIncrement(item), categoryId: item.categoryId || "", statuses: itemStatuses(item) });
    const deleteStockItem = () => {
        if (!editingItem || !window.confirm(`Delete ${editingItem.name} from stock? This cannot be undone.`)) return;
        const name = editingItem.name;
        setState(current => ({ ...current, stock: current.stock.filter(item => item.id !== editingItem.id), activity: [activity("stock", `${name} deleted`), ...current.activity].slice(0, 100) }));
        setEditingItem(null);
        notify("Ingredient deleted");
    };
    const saveStockEdit = (event) => {
        event.preventDefault();
        if (!editingItem?.name.trim()) return;
        const nextName = editingItem.name.trim();
        const nextQuantity = Math.max(0, Number(editingItem.quantity) || 0);
        const nextStatuses = nextQuantity === 0 ? [] : itemStatuses(editingItem);
        setState(current => {
            const previous = current.stock.find(item => item.id === editingItem.id);
            let analytics = current.analytics;
            if (previous && normalise(previous.name) !== normalise(nextName)) {
                const oldKey = normalise(previous.name);
                const newKey = normalise(nextName);
                const oldSignals = current.analytics[oldKey];
                if (oldSignals && newKey) {
                    const existing = current.analytics[newKey] || { shoppingAdds: 0, stockAdds: 0, stockedAt: [] };
                    const { [oldKey]: _removed, ...rest } = current.analytics;
                    analytics = { ...rest, [newKey]: {
                        ...existing,
                        shoppingAdds: (existing.shoppingAdds || 0) + (oldSignals.shoppingAdds || 0),
                        stockAdds: (existing.stockAdds || 0) + (oldSignals.stockAdds || 0),
                        lastShoppingAt: Math.max(existing.lastShoppingAt || 0, oldSignals.lastShoppingAt || 0) || undefined,
                        lastStockedAt: Math.max(existing.lastStockedAt || 0, oldSignals.lastStockedAt || 0) || undefined,
                        stockedAt: [...(existing.stockedAt || []), ...(oldSignals.stockedAt || [])].sort((a, b) => a - b).slice(-10)
                    } };
                }
            }
            return {
                ...current,
                analytics,
                stock: current.stock.map(item => item.id === editingItem.id ? {
                    ...item,
                    name: nextName,
                    quantity: nextQuantity,
                    unit: editingItem.unit.trim(),
                    increment: Number(editingItem.increment) > 0 ? Number(editingItem.increment) : defaultIncrementForUnit(editingItem.unit),
                    categoryId: editingItem.categoryId || null,
                    statuses: nextStatuses,
                    updatedAt: Date.now()
                } : item),
                activity: [activity("stock", `${nextName} updated`), ...current.activity].slice(0, 100)
            };
        });
        setEditingItem(null);
        notify("Ingredient updated");
    };
    const cookRecipe = (recipe) => {
        if (!recipe || !window.confirm(`Mark “${recipe.title}” as cooked and subtract its measurable ingredients from stock?`)) return;
        let result = null;
        setState(current => {
            result = consumeRecipeStock(recipe, current.stock);
            return {
                ...current,
                stock: result.stock,
                recipes: current.recipes.map(item => item.id === recipe.id ? { ...item, timesCooked: Number(item.timesCooked || 0) + 1, lastCookedAt: Date.now() } : item),
                activity: [activity("cook", `${recipe.title} cooked`), ...current.activity].slice(0, 100)
            };
        });
        window.setTimeout(() => notify(result?.skipped ? `Stock updated · ${result.consumed} measured · ${result.skipped} not measurable` : `Stock updated from ${result?.consumed || 0} ingredient${result?.consumed === 1 ? "" : "s"}`), 0);
    };
    const deleteRecipe = (recipe) => {
        if (!recipe || !window.confirm(`Delete “${recipe.title}” from your recipe library?`)) return;
        setState(current => ({ ...current, recipes: current.recipes.filter(item => item.id !== recipe.id) }));
        setSelectedRecipeId(null);
        notify("Recipe deleted");
    };
    const copyPrompt = async () => { try {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(prompt);
        }
        else {
            const area = document.createElement("textarea");
            area.value = prompt;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand("copy");
            area.remove();
            if (!ok)
                throw new Error("copy unavailable");
        }
        notify("Prompt copied");
    }
    catch {
        window.prompt("Copy this cooking prompt:", prompt);
    } };
    const exportData = () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `mise-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); notify("Backup downloaded"); };
    const restoreData = async (file) => { try {
        const parsed = JSON.parse(await file.text());
        if (parsed.version !== 1 || !Array.isArray(parsed.stock) || !Array.isArray(parsed.categories))
            throw new Error();
        setState(migrateLegacyStatuses(parsed));
        setShowSettings(false);
        notify("Backup restored");
    }
    catch {
        notify("That backup is not valid");
    } };
    const mergeIncomingTransfer = (payload) => {
        const merged = mergeTransferredState(state, payload.state);
        setState(merged.state);
        setIncomingTransfer(null);
        clearTransferHash();
        const added = merged.summary.stockAdded + merged.summary.recipesAdded + merged.summary.categoriesAdded + merged.summary.shoppingAdded;
        const updated = merged.summary.stockUpdated + merged.summary.recipesUpdated + merged.summary.categoriesUpdated + merged.summary.shoppingUpdated;
        notify(`Data merged · ${added} new · ${updated} matched`);
    };
    const dismissIncomingTransfer = () => { setIncomingTransfer(null); clearTransferHash(); };
    return h("main", null,
        h("div", { className: "app-shell" },
            h("header", { className: "topbar" },
                h("button", { className: "brand", onClick: () => setTab("stock"), "aria-label": "Mise home" },
                    h("span", null,
                        h(CookingPot, null)),
                    h("strong", null, "MISE")),
                h("div", { className: "top-actions" },
                    h("span", { className: `privacy-pill ${online ? "" : "offline"}` },
                        online ? h(Wifi, null) : h(WifiOff, null),
                        online ? "Online" : "Offline cache"),
                    h("button", { className: "icon-button", onClick: () => setShowSettings(true), "aria-label": "Settings" },
                        h(Settings, null)),
                    h("button", { className: "primary-button", onClick: () => setShowAdd(true) },
                        h(Plus, null),
                        "Add stock"))),
            h("nav", { className: "desktop-nav", "aria-label": "Main navigation" },
                h(NavButton, { active: tab === "stock", onClick: () => setTab("stock"), icon: h(Box, null), label: "Stock" }),
                h(NavButton, { active: tab === "shopping", onClick: () => setTab("shopping"), icon: h(ShoppingBasket, null), label: "Shopping", count: state.shopping.length }),
                h(NavButton, { active: tab === "recipes", onClick: () => setTab("recipes"), icon: h(BookOpen, null), label: "Recipes", count: state.recipes.length }),
                h(NavButton, { active: tab === "cook", onClick: () => setTab("cook"), icon: h(Sparkles, null), label: "Cook" })),
            tab === "stock" && h("section", { className: "page stock-page" },
                h("div", { className: "signal-card" },
                    h("div", { className: "signal-copy" },
                        h("span", { className: "eyebrow" },
                            h(Sparkles, null),
                            " TONIGHT'S SIGNAL"),
                        h("h1", null, useFirst[0] ? h(Fragment, null,
                            "Use ",
                            h("em", null, useFirst[0].name),
                            " first.") : h(Fragment, null,
                            "Your kitchen is",
                            h("br", null),
                            h("em", null, "ready."))),
                        h("p", null, useFirst[0] ? `${hasStatus(useFirst[0], "expiring") ? "Near expiry" : hasStatus(useFirst[0], "leftover") ? "Leftover" : "Already open"} · ${usageCount(useFirst[0].name, state.recipes)} saved recipe matches` : "Nothing urgent. Explore your stock or build a cooking brief.")),
                    h("button", { className: "cook-now", onClick: () => setTab("cook") },
                        h("span", null,
                            h(Sparkles, null)),
                        h("b", null, "Make me a plan"),
                        h(ChevronRight, null)),
                    h("div", { className: "signal-orbit" })),
                h("div", { className: "insight-grid" },
                    h(Insight, { icon: h(PackageOpen, null), label: "Use first", value: useFirst[0]?.name || "All clear", meta: useFirst.length ? `${useFirst.length} use-soon or leftover` : "No urgent items" }),
                    h(Insight, { icon: h(BookOpen, null), label: "Recipe magnet", value: recipeStars[0]?.item.name || "Learning…", meta: recipeStars[0] ? `${recipeStars[0].count} saved recipes` : "Save recipes to train this" }),
                    h(Insight, { icon: h(History, null), label: "Restock rhythm", value: frequent[0]?.item.name || "Learning…", meta: frequent[0] ? `Added ${frequent[0].count}× to shopping` : "Shopping history stays here" })),
                h("div", { className: "section-head" },
                    h("div", null,
                        h("span", { className: "eyebrow" },
                            h(Box, null),
                            " PANTRY"),
                        h("h2", null,
                            "Your stock ",
                            h("small", null,
                                state.stock.filter(i => i.quantity > 0).length,
                                " in"))),
                    h("div", { className: "toolbar" },
                        h("div", { className: "search", role: "search" },
                            h(Search, null),
                            h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Find ingredient", "aria-label": "Find ingredient" }),
                            query && h("button", { type: "button", className: "search-clear", onClick: () => setQuery(""), "aria-label": "Clear search", title: "Clear search" }, h(X, null))),
                        ["open", "frozen", "expiring", "leftover", "out"].map(status => h("button", { className: `filter-button ${statusFilter === status ? "active" : ""}`, key: status, onClick: () => setStatusFilter(statusFilter === status ? "all" : status), title: status === "expiring" ? "Near expiry" : status, "aria-label": status === "expiring" ? "Near expiry" : status },
                            status === "open" ? h(PackageOpen, null) : status === "frozen" ? h(Snowflake, null) : status === "expiring" ? h(CalendarClock, null) : status === "leftover" ? h(Utensils, null) : h(X, null),
                            h("span", null, status === "expiring" ? "Near expiry" : status))))),
                h("div", { className: "category-row" },
                    h("button", { className: `category-filter ${categoryFilter === "all" ? "active" : ""}`, onClick: () => setCategoryFilter("all") },
                        h("span", { className: "category-glyph all-glyph" }, h(Boxes, { size: 16 })),
                        h("span", null, "All")),
                    state.categories.map(category => h("button", { key: category.id, className: `category-filter ${categoryFilter === category.id ? "active" : ""}`, style: { "--category": category.color }, onClick: () => setCategoryFilter(category.id) },
                        h(CategoryGlyph, { category }),
                        h("span", null, category.name))),
                    h("button", { className: `category-filter ${categoryFilter === "unsorted" ? "active" : ""}`, onClick: () => setCategoryFilter("unsorted") },
                        h("span", { className: "category-glyph neutral-glyph" }, h(ArchiveRestore, { size: 16 })),
                        h("span", null, "Unsorted")),
                    h("button", { className: "manage-categories", onClick: () => setShowSettings(true) },
                        h(FolderCog, { size: 16 }),
                        h("span", null, "Manage"))),
                visibleStock.length ? h("div", { className: "stock-grid" }, visibleStock.map(item => h(StockCard, { key: item.id, item: item, state: state, onAdjust: adjustStock, onStatus: toggleStatus, onShop: () => { addToShopping(item.name, "restock"); notify("Added to shopping"); }, onEdit: () => editStock(item) }))) : h(Empty, { icon: h(Search, null), title: "Nothing here", text: "Try another filter or add an ingredient." })),
            tab === "shopping" && h("section", { className: "page panel-page" },
                h("div", { className: "page-title" },
                    h("div", null,
                        h("span", { className: "eyebrow" },
                            h(ShoppingBasket, null),
                            " RESTOCK"),
                        h("h1", null, "Shopping"),
                        h("p", null, state.shopping.length ? `${state.shopping.length} things waiting · ${state.shopping.filter(i => i.checked).length} checked off` : "A list that learns from your local habits.")),
                    h("div", { className: "title-actions" },
                        h("button", { className: "soft-button", onClick: () => setShowImport(!showImport) },
                            h(ClipboardPaste, null),
                            "Paste AI list"),
                        state.shopping.some(i => i.checked) && h("button", { className: "primary-button", onClick: stockChecked },
                            h(PackageCheck, null),
                            "Stock bought"))),
                showImport && h("div", { className: "import-panel" },
                    h("div", null,
                        h("b", null, "Paste the [SHOPPING] block"),
                        h("p", null, "Names before the first | are imported. Duplicates increase quantity.")),
                    h("textarea", { value: shoppingImport, onChange: e => setShoppingImport(e.target.value), placeholder: '[SHOPPING]\n- Onions | 3 | versatile base\n- Garlic | 1 bulb | more flavour\n[END SHOPPING]' }),
                    h("button", { className: "primary-button", disabled: !shoppingImport.trim(), onClick: importShopping },
                        h(ListPlus, null),
                        "Add all")),
                h("form", { className: "quick-add", "aria-label": "Quick add to shopping", onSubmit: event => { event.preventDefault(); if (shoppingText.trim()) {
                        addToShopping(shoppingText);
                        setShoppingText("");
                        notify("Added to shopping");
                    } } },
                    h("input", { value: shoppingText, onChange: e => setShoppingText(e.target.value), placeholder: "Add something to buy" }),
                    h("button", { "aria-label": "Add to shopping" },
                        h(Plus, null))),
                recent.length > 0 && h("div", { className: "recent-strip" },
                    h("span", null,
                        h(History, null),
                        "Recent"),
                    recent.map(item => h("button", { key: item.id, onClick: () => addToShopping(item.name, item.source) },
                        h(RotateCcw, null),
                        item.name,
                        h("small", null, timeLabel(item.addedAt))))),
                h("div", { className: "shopping-layout" },
                    h("div", { className: "shopping-list" }, state.shopping.length ? state.shopping.map(item => h(ShoppingRow, { key: item.id, item: item, onCheck: () => setState(current => ({ ...current, shopping: current.shopping.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i) })), onAdjust: amount => adjustShopping(item.id, amount), onStock: () => { stockShoppingItem(item); notify(`${item.name} stocked`); }, onDelete: () => setState(current => ({ ...current, shopping: current.shopping.filter(i => i.id !== item.id) })) })) : h(Empty, { icon: h(ShoppingBasket, null), title: "Basket's empty", text: "Your smart picks will get better as you use the app." })),
                    h("aside", { className: "smart-panel" },
                        h("span", { className: "eyebrow" },
                            h(Lightbulb, null),
                            " LOCAL SIGNALS"),
                        h("h2", null, "Smart picks"),
                        h("p", null, "Ranked from stock, recipe use, shopping frequency and timing. Nothing leaves this device."),
                        h("div", null, smart.map((item, index) => h("button", { key: item.name, onClick: () => { addToShopping(item.name, item.source); notify("Smart pick added"); } },
                            h("span", { className: "rank" }, String(index + 1).padStart(2, "0")),
                            h("span", null,
                                h("b", null, item.name),
                                h("small", null, item.reasons.join(" · "))),
                            h(Plus, null))))))),
            tab === "recipes" && h("section", { className: "page recipe-library-page" },
                h("div", { className: "recipe-library-head" },
                    h("div", null,
                        h("span", { className: "eyebrow" }, h(BookOpen, null), " YOUR KEEPERS"),
                        h("h1", null, "Recipe library"),
                        h("p", null, state.recipes.length ? `${state.recipes.length} saved recipe${state.recipes.length === 1 ? "" : "s"} · availability updates with your stock` : "Save recipes as structured cards you can actually cook from.")),
                    h("button", { className: "primary-button", onClick: () => setShowRecipeImport(true) }, h(ClipboardPaste, null), "Import recipe")),
                h("div", { className: "recipe-toolbar" },
                    h("label", { className: "recipe-search" }, h(Search, null), h("input", { value: recipeQuery, onChange: e => setRecipeQuery(e.target.value), placeholder: "Find recipe or tag", "aria-label": "Find recipe" }), recipeQuery && h("button", { type: "button", onClick: () => setRecipeQuery(""), "aria-label": "Clear recipe search" }, h(X, null))),
                    h("select", { value: recipeAvailabilityFilter, onChange: e => setRecipeAvailabilityFilter(e.target.value), "aria-label": "Filter recipes by availability" },
                        h("option", { value: "all" }, "All availability"),
                        h("option", { value: "ready" }, "Ready now"),
                        h("option", { value: "missing" }, "Needs shopping"),
                        h("option", { value: "prep" }, "Prep ahead")),
                    h("select", { value: recipeTagFilter, onChange: e => setRecipeTagFilter(e.target.value), "aria-label": "Filter recipes by tag" },
                        h("option", { value: "all" }, "All tags"),
                        recipeTags.map(tag => h("option", { key: tag, value: tag }, tag))),
                    h("select", { value: recipeSort, onChange: e => setRecipeSort(e.target.value), "aria-label": "Sort recipes" },
                        h("option", { value: "newest" }, "Newest first"),
                        h("option", { value: "quickest" }, "Quickest first"),
                        h("option", { value: "match" }, "Best stock match"),
                        h("option", { value: "cooked" }, "Most cooked"),
                        h("option", { value: "az" }, "A–Z"))),
                h("div", { className: "recipe-list recipe-grid" }, visibleRecipes.length ? visibleRecipes.map(recipe => h(RecipeCard, { key: recipe.id, recipe, state, onOpen: () => setSelectedRecipeId(recipe.id) })) : h(Empty, { icon: h(BookOpen, null), title: state.recipes.length ? "No recipes match" : "No saved recipes", text: state.recipes.length ? "Try another filter." : "Import a generated recipe and Mise will turn it into a useful recipe card." }))),
            tab === "cook" && h("section", { className: "page cook-page" },
                h("div", { className: "cook-intro" },
                    h("span", { className: "eyebrow" },
                        h(ChefHat, null),
                        " COOK WITH WHAT YOU HAVE"),
                    h("h1", null,
                        "Your dinner",
                        h("br", null),
                        "brief."),
                    h("p", null, "The prompt blends live stock with your local recipe habits, including a prep-ahead idea for tomorrow or later when your stock suits one."),
                    h("div", { className: "tone-switch" }, ["healthy", "balanced", "comfort"].map(choice => h("button", { className: tone === choice ? "active" : "", key: choice, onClick: () => setTone(choice) },
                        choice === "healthy" ? h(Leaf, null) : choice === "comfort" ? h(Flame, null) : h(CircleGauge, null),
                        h("span", null, choice)))),
                    h("div", { className: "prompt-signals" },
                        h("span", null,
                            h(Box, null),
                            state.stock.filter(i => i.quantity > 0).length,
                            " stocked"),
                        h("span", null,
                            h(BookOpen, null),
                            state.recipes.length,
                            " recipes learned"),
                        h("span", null,
                            h(BarChart3, null),
                            Object.values(state.analytics).reduce((sum, a) => sum + a.shoppingAdds, 0),
                            " shopping signals"),
                        h("span", null,
                            h(CalendarClock, null),
                            "prep-ahead enabled")),
                    h("button", { className: "primary-button copy-prompt", onClick: copyPrompt },
                        h(Clipboard, null),
                        "Copy prompt")),
                h("div", { className: "prompt-paper" },
                    h("header", null,
                        h("span", null,
                            h(Bot, null),
                            "Cooking prompt"),
                        h("small", null, "Generated locally")),
                    h("pre", null, prompt)))),
        h("nav", { className: "mobile-nav", "aria-label": "Main navigation" },
            h(NavButton, { active: tab === "stock", onClick: () => setTab("stock"), icon: h(Box, null), label: "Stock" }),
            h(NavButton, { active: tab === "shopping", onClick: () => setTab("shopping"), icon: h(ShoppingBasket, null), label: "Shop", count: state.shopping.length }),
            h(NavButton, { active: tab === "recipes", onClick: () => setTab("recipes"), icon: h(BookOpen, null), label: "Recipes" }),
            h(NavButton, { active: tab === "cook", onClick: () => setTab("cook"), icon: h(Sparkles, null), label: "Cook" })),
        showAdd && h(Modal, { title: "Add to stock", onClose: () => setShowAdd(false) },
            h("form", { className: "form-grid", onSubmit: addStock },
                h("label", { className: "full" },
                    "Ingredient",
                    h("input", { autoFocus: true, value: newItem.name, onChange: e => setNewItem({ ...newItem, name: e.target.value }), placeholder: "e.g. Chickpeas" })),
                h("label", null,
                    "Quantity",
                    h("input", { type: "number", min: "0", step: "0.5", value: newItem.quantity, onChange: e => setNewItem({ ...newItem, quantity: Number(e.target.value) }) })),
                h("label", null,
                    "Unit",
                    h("input", { value: newItem.unit, onChange: e => { const unit = e.target.value; setNewItem({ ...newItem, unit, increment: defaultIncrementForUnit(unit) }); }, placeholder: "pack, L, can…" })),
                h("label", null,
                    "+/− amount",
                    h("input", { type: "number", min: "0.001", step: "any", value: newItem.increment, onChange: e => setNewItem({ ...newItem, increment: Number(e.target.value) }), placeholder: "1" })),
                h("p", { className: "form-hint quantity-hint" }, "How much the card +/− buttons change each tap."),
                h("label", { className: "full" },
                    "Category",
                    h("select", { value: newItem.categoryId, onChange: e => setNewItem({ ...newItem, categoryId: e.target.value }) },
                        h("option", { value: "" }, "Unsorted"),
                        state.categories.map(c => h("option", { value: c.id, key: c.id }, c.name)))),
                h("div", { className: "status-picker full" }, statusButtons.map(({ status, label, icon: Icon }) => h("button", { type: "button", key: status, className: hasStatus(newItem, status) ? `active ${status}` : "", onClick: () => setNewItem({ ...newItem, statuses: toggleItemStatus(newItem, status) }), "aria-pressed": hasStatus(newItem, status) },
                    h(Icon, null),
                    label))),
                h("p", { className: "form-hint full" }, "Choose any that apply. No selection means ready/unopened."),
                h("button", { className: "primary-button full", type: "submit" },
                    h(PackagePlus, null),
                    "Add ingredient"))),
        editingItem && h(Modal, { title: "Edit ingredient", onClose: () => setEditingItem(null) },
            h("form", { className: "form-grid", onSubmit: saveStockEdit },
                h("label", { className: "full" },
                    "Ingredient",
                    h("input", { autoFocus: true, value: editingItem.name, onChange: e => setEditingItem({ ...editingItem, name: e.target.value }), placeholder: "e.g. Chickpeas" })),
                h("label", null,
                    "Quantity",
                    h("input", { type: "number", min: "0", step: "0.5", value: editingItem.quantity, onChange: e => setEditingItem({ ...editingItem, quantity: Number(e.target.value) }) })),
                h("label", null,
                    "Unit",
                    h("input", { value: editingItem.unit, onChange: e => setEditingItem({ ...editingItem, unit: e.target.value }), placeholder: "pack, L, can…" })),
                h("label", null,
                    "+/− amount",
                    h("input", { type: "number", min: "0.001", step: "any", value: editingItem.increment, onChange: e => setEditingItem({ ...editingItem, increment: Number(e.target.value) }) })),
                h("p", { className: "form-hint quantity-hint" }, "Used by the stock card +/− buttons. Metric units are converted automatically when a recipe uses g/kg or ml/L."),
                h("label", { className: "full" },
                    "Category",
                    h("select", { value: editingItem.categoryId || "", onChange: e => setEditingItem({ ...editingItem, categoryId: e.target.value }) },
                        h("option", { value: "" }, "Unsorted"),
                        state.categories.map(c => h("option", { value: c.id, key: c.id }, c.name)))),
                h("div", { className: "status-picker full" }, statusButtons.map(({ status, label, icon: Icon }) => h("button", { type: "button", key: status, className: hasStatus(editingItem, status) ? `active ${status}` : "", onClick: () => setEditingItem({ ...editingItem, quantity: editingItem.quantity || 1, statuses: toggleItemStatus(editingItem, status) }), "aria-pressed": hasStatus(editingItem, status) },
                    h(Icon, null),
                    label))),
                h("p", { className: "form-hint full" }, "Choose any that apply; statuses can stack. Set quantity to 0 to mark this ingredient out of stock."),
                h("button", { className: "primary-button full", type: "submit" },
                    h(Pencil, null),
                    "Save changes"),
                h("div", { className: "edit-danger full" },
                    h("button", { type: "button", className: "danger-link", onClick: deleteStockItem }, h(Trash2, null), "Delete ingredient"),
                    h("small", null, "Deletion is kept here to avoid accidental taps on stock cards.")))),
        showRecipeImport && h(Modal, { title: "Import recipe", onClose: () => setShowRecipeImport(false), wide: true },
            h("div", { className: "recipe-import-modal" },
                h("p", null, "Paste one recipe, or paste several === RECIPE === blocks at once. Mise extracts tags, timing, ingredients and steps into separate recipe cards."),
                h("textarea", { autoFocus: true, value: recipeDraft, onChange: e => setRecipeDraft(e.target.value), placeholder: '=== RECIPE ===\nTITLE: Tomato pesto pasta\nMODE: Fast\nCUISINE: Italian\nTAGS: quick, pasta, vegetarian\nSERVINGS: 1\nACTIVE MINUTES: 10\nTOTAL MINUTES: 20\nLEAD TIME: none\nINGREDIENTS:\n- [STOCK] Pasta | 100 | g\n- [STOCK] Pesto sauce | 2 | tbsp\nSTEPS:\n1. Cook the pasta until al dente.\n2. Toss with pesto and serve.\n=== END RECIPE ===' }),
                h("div", { className: "modal-actions" },
                    h("button", { className: "soft-button", onClick: () => setShowRecipeImport(false) }, "Cancel"),
                    h("button", { className: "primary-button", onClick: saveRecipe, disabled: !recipeDraft.trim() }, h(BookOpen, null), "Import")))),
        selectedRecipe && h(RecipeDetail, { recipe: selectedRecipe, state, onClose: () => setSelectedRecipeId(null), onShop: name => addToShopping(name, "recipe"), onCook: () => cookRecipe(selectedRecipe), onDelete: () => deleteRecipe(selectedRecipe) }),
        showSettings && h(SettingsModal, { state: state, setState: setState, onClose: () => setShowSettings(false), exportData: exportData, importRef: importRef, restoreData: restoreData, notify: notify, onTransfer: () => { setShowSettings(false); setShowTransfer(true); } }),
        showTransfer && h(TransferModal, { state, onClose: () => setShowTransfer(false), notify }),
        incomingTransfer && h(TransferImportModal, { payload: incomingTransfer, onMerge: () => mergeIncomingTransfer(incomingTransfer), onClose: dismissIncomingTransfer }),
        toast && h("div", { className: "toast", role: "status", "aria-live": "polite" },
            h(Check, null),
            toast));
}
function NavButton({ active, onClick, icon, label, count }) { return h("button", { className: active ? "active" : "", onClick: onClick, "aria-current": active ? "page" : undefined },
    icon,
    h("span", null, label),
    count ? h("b", null, count) : null); }
function Insight({ icon, label, value, meta }) { return h("article", { className: "insight-card" },
    h("span", null, icon),
    h("div", null,
        h("small", null, label),
        h("b", null, value),
        h("p", null, meta))); }
function Empty({ icon, title, text }) { return h("div", { className: "empty" },
    icon,
    h("h3", null, title),
    h("p", null, text)); }
function StockCard({ item, state, onAdjust, onStatus, onShop, onEdit }) {
    const category = state.categories.find(c => c.id === item.categoryId);
    const recipes = usageCount(item.name, state.recipes);
    const shoppingAdds = analyticsFor(state, item.name).shoppingAdds;
    return h("article", { className: `stock-card ${item.quantity === 0 ? "out" : ""}`, style: { "--category": category?.color || "#92958d" } },
        h("div", { className: "stock-card-top" },
            h("span", { className: "category-mark", style: { "--category": category?.color || "#92958d" } },
                category ? h(CategoryGlyph, { category, size: 18 }) : h(ArchiveRestore, { size: 18 })),
            h("div", { className: "status-actions" }, statusButtons.map(({ status, label, icon: Icon }) => h("button", { key: status, className: hasStatus(item, status) ? `active ${status}` : "", onClick: () => onStatus(item.id, status), "aria-pressed": hasStatus(item, status), "aria-label": `${label} ${item.name}`, title: label },
                h(Icon, null))))),
        h("div", { className: "stock-name" },
            h("h3", null, item.name),
            h("p", null,
                category?.name || "Unsorted",
                item.quantity === 0 ? " · Out of stock" : statusText(item).length ? ` · ${statusText(item).map(label => label.replace(/^./, char => char.toUpperCase())).join(" · ")}` : "")),
        (recipes > 0 || shoppingAdds > 0) && h("div", { className: "micro-signals" },
            recipes > 0 && h("span", null, h(BookOpen, null), recipes, " recipe", recipes === 1 ? "" : "s"),
            shoppingAdds > 0 && h("span", null, h(History, null), "bought ", shoppingAdds, "×")),
        h("div", { className: "stock-card-bottom" },
            h(Stepper, { value: item.quantity, label: `${item.name}; changes by ${formatQuantity(itemIncrement(item))} ${item.unit || "units"}`, onMinus: () => onAdjust(item.id, -1), onPlus: () => onAdjust(item.id, 1) }),
            h("small", null, item.unit),
            h("div", { className: "card-actions" },
                h("button", { onClick: onShop, title: "Add to shopping", "aria-label": `Add ${item.name} to shopping` }, h(ShoppingBasket, null)),
                h("button", { className: "edit-stock-button", onClick: onEdit, title: "Edit ingredient", "aria-label": `Edit ${item.name}` }, h(Pencil, null)))));
}
function ShoppingRow({ item, onCheck, onAdjust, onStock, onDelete }) { return h("article", { className: `shopping-row ${item.checked ? "checked" : ""}` },
    h("button", { className: "check-button", onClick: onCheck, "aria-label": item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`, "aria-pressed": item.checked }, item.checked && h(Check, null)),
    h("div", { className: "shopping-name" },
        h("b", null, item.name),
        h("small", null,
            item.source,
            " \u00B7 ",
            timeLabel(item.addedAt))),
    h(Stepper, { value: item.quantity, label: item.name, onMinus: () => onAdjust(-1), onPlus: () => onAdjust(1) }),
    h("button", { className: "stock-button", onClick: onStock },
        h(PackageCheck, null),
        "Stock"),
    h("button", { className: "icon-button delete", onClick: onDelete, "aria-label": `Delete ${item.name}` },
        h(Trash2, null))); }
function RecipeCard({ recipe, state, onOpen }) {
    const availability = recipeAvailability(recipe, state.stock);
    const tags = (recipe.tags || []).slice(0, 4);
    const time = Number(recipe.totalMinutes) || Number(recipe.activeMinutes) || null;
    const availabilityText = availability.ready ? "Ready now" : availability.missing.length ? `${availability.missing.length} missing` : availability.short.length ? `${availability.short.length} short` : "Check stock";
    return h("button", { className: "recipe-card recipe-card-button", onClick: onOpen, "aria-label": `Open ${recipe.title}` },
        h("div", { className: "recipe-card-top" },
            h("span", { className: `availability ${availability.ready ? "ready" : "missing"}` }, availability.ready ? h(Check, null) : h(ShoppingBasket, null), availabilityText),
            recipe.timesCooked ? h("span", { className: "cooked-count" }, h(Utensils, null), recipe.timesCooked, "×") : null),
        h("h2", null, recipe.title),
        h("div", { className: "recipe-meta" },
            time ? h("span", null, h(Clock3, null), time, " min") : null,
            recipe.servings ? h("span", null, h(Users, null), recipe.servings, recipe.servings === 1 ? " serving" : " servings") : null,
            recipe.cuisine ? h("span", null, h(Globe2, null), recipe.cuisine) : null),
        tags.length ? h("div", { className: "recipe-tags" }, tags.map(tag => h("span", { key: tag }, tag))) : null,
        h("div", { className: "coverage", "aria-label": `${availability.pct}% of ingredients available` }, h("span", { style: { width: `${availability.pct}%` } })),
        h("div", { className: "recipe-card-foot" },
            h("small", null, availability.ready ? "Everything is in stock" : `${availability.matched.length}/${availability.total} ingredients ready`),
            h(ChevronRight, null)));
}

function RecipeDetail({ recipe, state, onClose, onShop, onCook, onDelete }) {
    const availability = recipeAvailability(recipe, state.stock);
    const tags = recipe.tags || [];
    const missingNames = [...availability.missing, ...availability.short];
    return h(Modal, { title: recipe.title, onClose, wide: true },
        h("article", { className: "recipe-detail" },
            h("div", { className: "recipe-detail-summary" },
                h("div", { className: "recipe-detail-meta" },
                    h("span", { className: `availability ${availability.ready ? "ready" : "missing"}` }, availability.ready ? h(Check, null) : h(ShoppingBasket, null), availability.ready ? "Ready now" : `${missingNames.length} ingredient${missingNames.length === 1 ? "" : "s"} need attention`),
                    recipe.totalMinutes || recipe.activeMinutes ? h("span", null, h(Clock3, null), recipe.activeMinutes ? `${recipe.activeMinutes} active` : null, recipe.activeMinutes && recipe.totalMinutes ? " · " : null, recipe.totalMinutes ? `${recipe.totalMinutes} min total` : null) : null,
                    recipe.servings ? h("span", null, h(Users, null), recipe.servings, recipe.servings === 1 ? " serving" : " servings") : null,
                    recipe.leadTime && normalise(recipe.leadTime) !== "none" ? h("span", null, h(CalendarClock, null), recipe.leadTime, " lead time") : null,
                    recipe.cuisine ? h("span", null, h(Globe2, null), recipe.cuisine) : null),
                tags.length ? h("div", { className: "recipe-tags" }, tags.map(tag => h("span", { key: tag }, tag))) : null),
            h("div", { className: "recipe-detail-grid" },
                h("section", { className: "recipe-ingredients" },
                    h("div", { className: "recipe-section-title" }, h(ListChecks, null), h("h3", null, "Ingredients")),
                    h("div", { className: "ingredient-list" }, availability.entries.map((entry, index) => {
                        const ingredient = entry.ingredient;
                        const stateIcon = entry.state === "available" ? h(Check, null) : entry.state === "short" ? h(TriangleAlert, null) : h(ShoppingBasket, null);
                        const stockNote = entry.item ? `${formatQuantity(entry.item.quantity)}${entry.item.unit ? ` ${entry.item.unit}` : ""} in stock` : "Not in stock";
                        return h("div", { className: `ingredient-row ${entry.state}`, key: `${ingredient.name}-${index}` },
                            h("span", { className: "ingredient-state" }, stateIcon),
                            h("div", null, h("b", null, ingredient.name), h("small", null, stockNote)),
                            h("strong", null, amountLabel(ingredient) || "as needed"),
                            entry.state !== "available" ? h("button", { className: "ingredient-shop", onClick: () => onShop(ingredient.name), title: "Add to shopping", "aria-label": `Add ${ingredient.name} to shopping` }, h(Plus, null)) : null);
                    }))),
                h("section", { className: "recipe-method" },
                    h("div", { className: "recipe-section-title" }, h(ListOrdered, null), h("h3", null, "Method")),
                    recipe.steps?.length ? h("div", { className: "recipe-steps" }, recipe.steps.map((step, index) => h("div", { className: "recipe-step", key: index }, h("span", null, index + 1), h("p", null, step)))) : h("div", { className: "recipe-legacy-text" }, h("p", null, "This older recipe did not include structured steps."), recipe.text ? h("pre", null, recipe.text) : null))),
            h("div", { className: "recipe-detail-actions" },
                missingNames.length ? h("button", { className: "soft-button", onClick: () => missingNames.forEach(onShop) }, h(ShoppingBasket, null), "Add missing to shopping") : null,
                h("button", { className: "primary-button cooked-button", onClick: onCook }, h(Check, null), "I did this")),
            h("div", { className: "recipe-history" }, recipe.lastCookedAt ? `Cooked ${recipe.timesCooked || 1}× · last ${timeLabel(recipe.lastCookedAt)}` : "Not cooked yet in Mise"),
            h("div", { className: "recipe-danger" }, h("button", { className: "danger-link", onClick: onDelete }, h(Trash2, null), "Delete recipe"))));
}
function TransferModal({ state, onClose, notify }) {
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [qrError, setQrError] = useState("");
    const qrRef = useRef(null);
    useEffect(() => {
        let cancelled = false;
        makeTransferLink(state).then(value => { if (!cancelled) setLink(value); }).catch(() => { if (!cancelled) setError("Could not create a transfer link on this browser."); });
        return () => { cancelled = true; };
    }, [state]);
    useEffect(() => {
        if (!link || !qrRef.current) return;
        qrRef.current.replaceChildren();
        setQrError("");
        try {
            if (typeof QRCode !== "function") throw new Error("QR library unavailable");
            new QRCode(qrRef.current, { text: link, width: 232, height: 232, colorDark: "#1d211c", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.L });
        }
        catch { setQrError("This transfer is too large for one QR code. Copy or share the link instead."); }
    }, [link]);
    const copyLink = async () => {
        if (!link) return;
        try { await navigator.clipboard.writeText(link); notify("Transfer link copied"); }
        catch { window.prompt("Copy this transfer link:", link); }
    };
    const shareLink = async () => {
        if (!link) return;
        if (navigator.share) { try { await navigator.share({ title: "Mise kitchen transfer", text: "Merge this Mise kitchen data into another device.", url: link }); return; } catch { } }
        copyLink();
    };
    return h(Modal, { title: "Transfer your Mise data", onClose, wide: true },
        h("div", { className: "transfer-layout" },
            h("section", { className: "transfer-explainer" },
                h("span", { className: "eyebrow" }, h(Smartphone, null), " DEVICE TO DEVICE"),
                h("h3", null, "Scan on the other device"),
                h("p", null, "The receiving device merges this snapshot into what it already has. Same ingredient, recipe, shopping item or category names are updated; new ones are added; receiver-only data is never deleted."),
                h("div", { className: "transfer-counts" },
                    h("span", null, h(Box, null), h("b", null, state.stock.length), " ingredients"),
                    h("span", null, h(BookOpen, null), h("b", null, state.recipes.length), " recipes"),
                    h("span", null, h(Tags, null), h("b", null, state.categories.length), " categories"),
                    h("span", null, h(ShoppingBasket, null), h("b", null, state.shopping.length), " shopping")),
                h("div", { className: "transfer-privacy" }, h(ShieldCheck, null), h("p", null, "The data is encoded after the # in the link, so it is not sent to GitHub Pages. Anyone you give the link to can read the snapshot, so share it only with devices you trust."))),
            h("section", { className: "transfer-code-panel" },
                !link && !error ? h("div", { className: "transfer-loading" }, h(QrCode, null), "Building transfer…") : null,
                error ? h("div", { className: "transfer-error" }, h(TriangleAlert, null), error) : null,
                link ? h(Fragment, null,
                    h("div", { className: `qr-shell ${qrError ? "qr-unavailable" : ""}` }, h("div", { ref: qrRef, className: "qr-code", "aria-label": "Mise transfer QR code" }), qrError ? h("p", null, qrError) : null),
                    h("label", { className: "transfer-link-field" }, h("span", null, "Transfer link"), h("textarea", { value: link, readOnly: true, rows: 3, onFocus: event => event.target.select() })),
                    h("div", { className: "transfer-actions" },
                        h("button", { className: "primary-button", onClick: copyLink }, h(Copy, null), "Copy link"),
                        h("button", { className: "soft-button", onClick: shareLink }, h(Share2, null), "Share"))) : null)));
}
function TransferImportModal({ payload, onMerge, onClose }) {
    const incoming = payload.state;
    const created = payload.createdAt ? new Date(payload.createdAt).toLocaleString() : "another device";
    return h(Modal, { title: "Merge Mise data?", onClose, wide: true },
        h("div", { className: "transfer-import" },
            h("div", { className: "transfer-import-icon" }, h(GitMerge, null)),
            h("div", null,
                h("span", { className: "eyebrow" }, "INCOMING SNAPSHOT"),
                h("h3", null, "Add and update — never delete"),
                h("p", null, `Created ${created}. Matching names from this transfer will update the copy on this device. Anything that exists only on this device stays exactly where it is.`)),
            h("div", { className: "transfer-counts incoming" },
                h("span", null, h(Box, null), h("b", null, incoming.stock?.length || 0), " ingredients"),
                h("span", null, h(BookOpen, null), h("b", null, incoming.recipes?.length || 0), " recipes"),
                h("span", null, h(Tags, null), h("b", null, incoming.categories?.length || 0), " categories"),
                h("span", null, h(ShoppingBasket, null), h("b", null, incoming.shopping?.length || 0), " shopping")),
            h("div", { className: "transfer-merge-note" }, h(ShieldCheck, null), h("p", null, "Stock quantities, units, statuses, increments, recipe details and matching category settings from the sending device take precedence for matching names.")),
            h("div", { className: "modal-actions" },
                h("button", { className: "soft-button", onClick: onClose }, "Cancel"),
                h("button", { className: "primary-button", onClick: onMerge }, h(GitMerge, null), "Merge into this device"))));
}
function SettingsModal({ state, setState, onClose, exportData, importRef, restoreData, notify, onTransfer }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState(palette[0]);
    const [icon, setIcon] = useState("");
    const addCategory = (event) => { event.preventDefault(); if (!name.trim())
        return; const category = { id: uuid(), name: name.trim(), color, icon: icon || null, createdAt: Date.now() }; setState(current => ({ ...current, categories: [...current.categories, category], activity: [{ id: uuid(), type: "category", label: `${category.name} category added`, at: Date.now() }, ...current.activity].slice(0, 100) })); setName(""); setIcon(""); notify("Category added"); };
    const removeCategory = (id) => setState(current => ({ ...current, categories: current.categories.filter(c => c.id !== id), stock: current.stock.map(item => item.categoryId === id ? { ...item, categoryId: null, updatedAt: Date.now() } : item), activity: [{ id: uuid(), type: "category", label: "Category removed; its items are now unsorted", at: Date.now() }, ...current.activity].slice(0, 100) }));
    return h(Modal, { title: "Local settings", onClose: onClose, wide: true },
        h("div", { className: "settings-grid" },
            h("section", null,
                h("span", { className: "eyebrow" },
                    h(Tags, null),
                    " CATEGORIES"),
                h("h3", null, "Organise your stock"),
                h("p", null, "Removing a category keeps every ingredient and moves it to Unsorted."),
                h("div", { className: "category-manager" }, state.categories.map(category => h("div", { key: category.id, style: { "--category": category.color } },
                    h(CategoryGlyph, { category, size: 16 }),
                    h("b", null, category.name),
                    h("small", null,
                        state.stock.filter(i => i.categoryId === category.id).length,
                        " items"),
                    h("button", { onClick: () => removeCategory(category.id), "aria-label": `Delete ${category.name} category`, title: "Delete category" },
                        h(Trash2, null))))),
                h("form", { className: "category-form", onSubmit: addCategory },
                    h("input", { value: name, onChange: e => setName(e.target.value), placeholder: "New category" }),
                    h("div", { className: "category-option-label" }, "Icon"),
                    h("div", { className: "category-icon-picker", role: "group", "aria-label": "Category icon" }, categoryIconChoices.map(choice => h("button", { type: "button", key: choice.id || "auto", onClick: () => setIcon(choice.id), className: icon === choice.id ? "active" : "", title: choice.label, "aria-label": `${choice.label} icon`, "aria-pressed": icon === choice.id },
                        h(choice.Icon, null),
                        h("span", null, choice.label)))),
                    h("div", { className: "category-option-label" }, "Colour"),
                    h("div", { className: "color-picker" }, palette.map(choice => h("button", { type: "button", key: choice, onClick: () => setColor(choice), className: color === choice ? "active" : "", style: { background: choice }, "aria-label": `Use ${choice}` }))),
                    h("button", { className: "primary-button", type: "submit" },
                        h(Plus, null),
                        "Add category"))),
            h("section", null,
                h("span", { className: "eyebrow" },
                    h(ShieldCheck, null),
                    " YOUR DATA"),
                h("h3", null, "Private by design"),
                h("p", null, "Everything lives in this browser. Export a backup before clearing browser data or changing devices."),
                h("div", { className: "data-actions" },
                    h("button", { className: "soft-button transfer-button", onClick: onTransfer },
                        h(QrCode, null),
                        "Generate QR / transfer link"),
                    h("button", { className: "soft-button", onClick: exportData },
                        h(HardDriveDownload, null),
                        "Download backup"),
                    h("button", { className: "soft-button", onClick: () => importRef.current?.click() },
                        h(Upload, null),
                        "Restore backup"),
                    h("input", { ref: importRef, hidden: true, type: "file", accept: "application/json", onChange: e => e.target.files?.[0] && restoreData(e.target.files[0]) }),
                    h("button", { className: "danger-button", onClick: () => { if (window.confirm("Reset all Mise data on this device?")) {
                            setState(freshState());
                            onClose();
                            notify("Mise reset");
                        } } },
                        h(Trash2, null),
                        "Reset local data")),
                h("div", { className: "privacy-note" },
                    h(CloudOff, null),
                    h("div", null,
                        h("b", null, "Your kitchen data stays local."),
                        h("p", null, "Mise does not send stock, recipes or shopping history to an application backend. Hosted/PWA mode can fetch static app assets such as Lucide icons, while your kitchen data remains in browser storage."))))));
}

createRoot(document.getElementById("root")).render(h(App,null));
