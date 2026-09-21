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
function categoryIconFor(category) {
    const key = normalise(`${category?.id || ""} ${category?.name || ""}`);
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
    h("strong", null, value),
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
    const [showImport, setShowImport] = useState(false);
    const [shoppingText, setShoppingText] = useState("");
    const [shoppingImport, setShoppingImport] = useState("");
    const [recipeDraft, setRecipeDraft] = useState("");
    const [tone, setTone] = useState("balanced");
    const [toast, setToast] = useState("");
    const [online, setOnline] = useState(navigator.onLine);
    const [newItem, setNewItem] = useState({ name: "", quantity: 1, unit: "", categoryId: state.categories[0]?.id || "", status: "ready" });
    const importRef = useRef(null);
    useEffect(() => saveState(state), [state]);
    useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
    const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 1800); };
    const activity = (type, label) => ({ id: uuid(), type, label, at: Date.now() });
    const addToShopping = (name, source = "manual") => setState(current => { const existing = current.shopping.find(item => matchesName(item.name, name)); const shopping = existing ? current.shopping.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + 1, addedAt: Date.now(), checked: false } : item) : [newShoppingItem(name, source), ...current.shopping]; return { ...current, shopping, analytics: bumpAnalytics(current, name, "shop"), activity: [activity("shop", `${name} added to shopping`), ...current.activity].slice(0, 100) }; });
    const adjustStock = (id, amount) => setState(current => ({ ...current, stock: current.stock.map(item => { if (item.id !== id)
            return item; const quantity = Math.max(0, Math.round((item.quantity + amount) * 10) / 10); return { ...item, quantity, status: quantity === 0 ? "out" : item.status === "out" ? "ready" : item.status, updatedAt: Date.now() }; }) }));
    const toggleStatus = (id, status) => setState(current => ({ ...current, stock: current.stock.map(item => item.id === id ? { ...item, quantity: item.quantity || 1, status: item.status === status ? "ready" : status, updatedAt: Date.now() } : item), activity: [activity("status", `${current.stock.find(i => i.id === id)?.name || "Item"} marked ${status}`), ...current.activity].slice(0, 100) }));
    const adjustShopping = (id, amount) => setState(current => ({ ...current, shopping: current.shopping.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item) }));
    const stockShoppingItem = (shoppingItem) => setState(current => { const existing = current.stock.find(item => matchesName(item.name, shoppingItem.name)); const stock = existing ? current.stock.map(item => item.id === existing.id ? { ...item, quantity: Math.round((item.quantity + shoppingItem.quantity) * 10) / 10, status: item.status === "out" || item.status === "low" ? "ready" : item.status, updatedAt: Date.now() } : item) : [{ id: uuid(), name: shoppingItem.name, quantity: shoppingItem.quantity, unit: shoppingItem.unit, categoryId: inferCategory(shoppingItem.name, current.categories, current.stock), status: "ready", createdAt: Date.now(), updatedAt: Date.now() }, ...current.stock]; return { ...current, stock, shopping: current.shopping.filter(item => item.id !== shoppingItem.id), analytics: bumpAnalytics(current, shoppingItem.name, "stock"), activity: [activity("stock", `${shoppingItem.quantity} ${shoppingItem.name} moved into stock`), ...current.activity].slice(0, 100) }; });
    const stockChecked = () => { const checked = state.shopping.filter(i => i.checked); checked.forEach(stockShoppingItem); notify(`${checked.length} item${checked.length === 1 ? "" : "s"} stocked`); };
    const saveRecipe = () => { if (!recipeDraft.trim())
        return; const recipe = { id: uuid(), title: recipeTitle(recipeDraft), text: recipeDraft.trim(), ingredients: parseRecipeIngredients(recipeDraft), createdAt: Date.now() }; setState(current => ({ ...current, recipes: [recipe, ...current.recipes], activity: [activity("recipe", `${recipe.title} saved`), ...current.activity].slice(0, 100) })); setRecipeDraft(""); notify("Recipe scanned"); };
    const importShopping = () => { const names = parseShoppingText(shoppingImport); names.forEach(name => addToShopping(name, "import")); setShoppingImport(""); setShowImport(false); notify(`${names.length} item${names.length === 1 ? "" : "s"} imported`); };
    const smart = useMemo(() => smartRecommendations(state), [state]);
    const recent = useMemo(() => recentShopping(state), [state]);
    const recipeStars = useMemo(() => topRecipeItems(state), [state]);
    const frequent = useMemo(() => frequentBuys(state), [state]);
    const useFirst = useMemo(() => state.stock.filter(item => item.quantity > 0 && (item.status === "open" || item.status === "low")).sort((a, b) => (a.status === "low" ? 0 : 1) - (b.status === "low" ? 0 : 1) || a.updatedAt - b.updatedAt), [state.stock]);
    const visibleStock = useMemo(() => state.stock.filter(item => (categoryFilter === "all" || categoryFilter === "unsorted" ? categoryFilter !== "unsorted" || !item.categoryId : item.categoryId === categoryFilter) && (statusFilter === "all" || item.status === statusFilter) && normalise(item.name).includes(normalise(query))).sort((a, b) => (a.status === "out" ? 1 : 0) - (b.status === "out" ? 1 : 0) || a.name.localeCompare(b.name)), [state.stock, categoryFilter, statusFilter, query]);
    const prompt = useMemo(() => makePrompt(state, tone), [state, tone]);
    const addStock = (event) => { event.preventDefault(); if (!newItem.name.trim())
        return; setState(current => ({ ...current, stock: [{ id: uuid(), name: newItem.name.trim(), quantity: newItem.quantity, unit: newItem.unit.trim(), categoryId: newItem.categoryId || null, status: newItem.quantity === 0 ? "out" : newItem.status, createdAt: Date.now(), updatedAt: Date.now() }, ...current.stock], activity: [activity("stock", `${newItem.name.trim()} added to stock`), ...current.activity].slice(0, 100) })); setNewItem({ name: "", quantity: 1, unit: "", categoryId: state.categories[0]?.id || "", status: "ready" }); setShowAdd(false); notify("Added to stock"); };
    const editStock = (item) => setEditingItem({ ...item, categoryId: item.categoryId || "" });
    const saveStockEdit = (event) => {
        event.preventDefault();
        if (!editingItem?.name.trim()) return;
        const nextName = editingItem.name.trim();
        const nextQuantity = Math.max(0, Number(editingItem.quantity) || 0);
        const nextStatus = nextQuantity === 0 ? "out" : editingItem.status === "out" ? "ready" : editingItem.status;
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
                    categoryId: editingItem.categoryId || null,
                    status: nextStatus,
                    updatedAt: Date.now()
                } : item),
                activity: [activity("stock", `${nextName} updated`), ...current.activity].slice(0, 100)
            };
        });
        setEditingItem(null);
        notify("Ingredient updated");
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
        setState(parsed);
        setShowSettings(false);
        notify("Backup restored");
    }
    catch {
        notify("That backup is not valid");
    } };
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
                        h("p", null, useFirst[0] ? `${useFirst[0].status === "low" ? "Running low" : "Already open"} · ${usageCount(useFirst[0].name, state.recipes)} saved recipe matches` : "Nothing urgent. Explore your stock or build a cooking brief.")),
                    h("button", { className: "cook-now", onClick: () => setTab("cook") },
                        h("span", null,
                            h(Sparkles, null)),
                        h("b", null, "Make me a plan"),
                        h(ChevronRight, null)),
                    h("div", { className: "signal-orbit" })),
                h("div", { className: "insight-grid" },
                    h(Insight, { icon: h(PackageOpen, null), label: "Use first", value: useFirst[0]?.name || "All clear", meta: useFirst.length ? `${useFirst.length} open or low` : "No urgent items" }),
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
                        h("label", { className: "search" },
                            h(Search, null),
                            h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Find ingredient" })),
                        ["open", "frozen", "low", "out"].map(status => h("button", { className: `filter-button ${statusFilter === status ? "active" : ""}`, key: status, onClick: () => setStatusFilter(statusFilter === status ? "all" : status) },
                            status === "open" ? h(PackageOpen, null) : status === "frozen" ? h(Snowflake, null) : status === "low" ? h(Gauge, null) : h(X, null),
                            h("span", null, status))))),
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
                visibleStock.length ? h("div", { className: "stock-grid" }, visibleStock.map(item => h(StockCard, { key: item.id, item: item, state: state, onAdjust: adjustStock, onStatus: toggleStatus, onShop: () => { addToShopping(item.name, "restock"); notify("Added to shopping"); }, onEdit: () => editStock(item), onDelete: () => setState(current => ({ ...current, stock: current.stock.filter(i => i.id !== item.id) })) }))) : h(Empty, { icon: h(Search, null), title: "Nothing here", text: "Try another filter or add an ingredient." })),
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
            tab === "recipes" && h("section", { className: "page recipes-page" },
                h("div", { className: "recipe-import" },
                    h("span", { className: "eyebrow" },
                        h(BookOpen, null),
                        " YOUR KEEPERS"),
                    h("h1", null,
                        "Recipe",
                        h("br", null),
                        "library"),
                    h("p", null, "Paste a generated recipe or any recipe with an Ingredients heading. Mise checks it against live stock and quietly learns which ingredients matter most."),
                    h("textarea", { value: recipeDraft, onChange: e => setRecipeDraft(e.target.value), placeholder: '=== RECIPE ===\nTITLE: Tomato pesto pasta\nINGREDIENTS:\n- [STOCK] Pasta | 100 g\n- [STOCK] Pesto sauce | 2 tbsp\n- [BUY] Garlic | 1 clove\nSTEPS:\n1. Cook...' }),
                    h("button", { className: "primary-button", onClick: saveRecipe, disabled: !recipeDraft.trim() },
                        h(BookOpen, null),
                        "Save & scan")),
                h("div", { className: "recipe-list" }, state.recipes.length ? state.recipes.map(recipe => h(RecipeCard, { key: recipe.id, recipe: recipe, state: state, onShop: name => addToShopping(name, "recipe"), onDelete: () => setState(current => ({ ...current, recipes: current.recipes.filter(r => r.id !== recipe.id) })) })) : h(Empty, { icon: h(BookOpen, null), title: "No saved recipes", text: "Paste one recipe here. Ingredient matching works locally." }))),
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
                    h("input", { value: newItem.unit, onChange: e => setNewItem({ ...newItem, unit: e.target.value }), placeholder: "pack, L, can\u2026" })),
                h("label", { className: "full" },
                    "Category",
                    h("select", { value: newItem.categoryId, onChange: e => setNewItem({ ...newItem, categoryId: e.target.value }) },
                        h("option", { value: "" }, "Unsorted"),
                        state.categories.map(c => h("option", { value: c.id, key: c.id }, c.name)))),
                h("div", { className: "status-picker full" }, ["ready", "open", "frozen", "low"].map(status => h("button", { type: "button", key: status, className: newItem.status === status ? "active" : "", onClick: () => setNewItem({ ...newItem, status }) },
                    status === "ready" ? h(Check, null) : status === "open" ? h(PackageOpen, null) : status === "frozen" ? h(Snowflake, null) : h(Gauge, null),
                    status))),
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
                h("label", { className: "full" },
                    "Category",
                    h("select", { value: editingItem.categoryId || "", onChange: e => setEditingItem({ ...editingItem, categoryId: e.target.value }) },
                        h("option", { value: "" }, "Unsorted"),
                        state.categories.map(c => h("option", { value: c.id, key: c.id }, c.name)))),
                h("div", { className: "status-picker full" }, ["ready", "open", "frozen", "low"].map(status => h("button", { type: "button", key: status, className: editingItem.status === status ? "active" : "", onClick: () => setEditingItem({ ...editingItem, quantity: editingItem.quantity || 1, status }) },
                    status === "ready" ? h(Check, null) : status === "open" ? h(PackageOpen, null) : status === "frozen" ? h(Snowflake, null) : h(Gauge, null),
                    status))),
                h("p", { className: "form-hint full" }, "Set quantity to 0 to mark this ingredient out of stock."),
                h("button", { className: "primary-button full", type: "submit" },
                    h(Pencil, null),
                    "Save changes"))),
        showSettings && h(SettingsModal, { state: state, setState: setState, onClose: () => setShowSettings(false), exportData: exportData, importRef: importRef, restoreData: restoreData, notify: notify }),
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
function StockCard({ item, state, onAdjust, onStatus, onShop, onEdit, onDelete }) {
    const category = state.categories.find(c => c.id === item.categoryId);
    const recipes = usageCount(item.name, state.recipes);
    const shoppingAdds = analyticsFor(state, item.name).shoppingAdds;
    return h("article", { className: `stock-card ${item.status === "out" ? "out" : ""}`, style: { "--category": category?.color || "#92958d" } },
        h("div", { className: "stock-card-top" },
            h("span", { className: "category-mark", style: { "--category": category?.color || "#92958d" } },
                category ? h(CategoryGlyph, { category, size: 18 }) : h(ArchiveRestore, { size: 18 })),
            h("div", { className: "status-actions" }, statusButtons.map(({ status, label, icon: Icon }) => h("button", { key: status, className: item.status === status ? `active ${status}` : "", onClick: () => onStatus(item.id, status), "aria-pressed": item.status === status, "aria-label": `${label} ${item.name}`, title: label },
                h(Icon, null))))),
        h("div", { className: "stock-name" },
            h("h3", null, item.name),
            h("p", null,
                category?.name || "Unsorted",
                item.status === "out" ? " · Out of stock" : "")),
        (recipes > 0 || shoppingAdds > 0) && h("div", { className: "micro-signals" },
            recipes > 0 && h("span", null,
                h(BookOpen, null),
                recipes,
                " recipe",
                recipes === 1 ? "" : "s"),
            shoppingAdds > 0 && h("span", null,
                h(History, null),
                "bought ",
                shoppingAdds,
                "\u00D7")),
        h("div", { className: "stock-card-bottom" },
            h(Stepper, { value: item.quantity, label: item.name, onMinus: () => onAdjust(item.id, -1), onPlus: () => onAdjust(item.id, 1) }),
            h("small", null, item.unit),
            h("div", { className: "card-actions" },
                h("button", { onClick: onShop, title: "Add to shopping", "aria-label": `Add ${item.name} to shopping` },
                    h(ShoppingBasket, null)),
                h("button", { className: "edit-stock-button", onClick: onEdit, title: "Edit ingredient", "aria-label": `Edit ${item.name}` },
                    h(Pencil, null)),
                h("button", { onClick: onDelete, title: "Delete", "aria-label": `Delete ${item.name}` },
                    h(Trash2, null)))));
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
function RecipeCard({ recipe, state, onShop, onDelete }) { const availability = recipeAvailability(recipe, state.stock); const total = recipe.ingredients.length, pct = total ? Math.round(availability.matched.length / total * 100) : 0; return h("article", { className: "recipe-card" },
    h("div", { className: "recipe-card-top" },
        h("div", null,
            h("span", { className: `availability ${availability.ready ? "ready" : availability.missing.length ? "missing" : "unknown"}` }, availability.ready ? h(Fragment, null,
                h(Check, null),
                "Available now") : availability.missing.length ? h(Fragment, null,
                h(ShoppingBasket, null),
                availability.missing.length,
                " missing") : h(Fragment, null,
                h(Search, null),
                "Needs ingredients")),
            h("h2", null, recipe.title)),
        h("button", { className: "icon-button", onClick: onDelete, "aria-label": `Delete ${recipe.title}` },
            h(Trash2, null))),
    total > 0 && h(Fragment, null,
        h("div", { className: "coverage" },
            h("span", { style: { width: `${pct}%` } })),
        h("div", { className: "ingredient-match" },
            availability.matched.map(name => h("span", { key: name },
                h(Check, null),
                name,
                h("small", null,
                    usageCount(name, state.recipes),
                    "\u00D7"))),
            availability.missing.map(name => h("button", { key: name, onClick: () => onShop(name) },
                h(Plus, null),
                name)))),
    h("details", null,
        h("summary", null,
            h(Eye, null),
            "View recipe"),
        h("pre", null, recipe.text)),
    availability.missing.length > 0 && h("button", { className: "soft-button missing-all", onClick: () => availability.missing.forEach(onShop) },
        h(ShoppingBasket, null),
        "Add missing to shopping")); }
function SettingsModal({ state, setState, onClose, exportData, importRef, restoreData, notify }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState(palette[0]);
    const addCategory = (event) => { event.preventDefault(); if (!name.trim())
        return; const category = { id: uuid(), name: name.trim(), color, createdAt: Date.now() }; setState(current => ({ ...current, categories: [...current.categories, category], activity: [{ id: uuid(), type: "category", label: `${category.name} category added`, at: Date.now() }, ...current.activity].slice(0, 100) })); setName(""); notify("Category added"); };
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
