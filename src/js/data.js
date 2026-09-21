/* Default pantry categories and starter stock. */
const now = Date.now();
const defaultCategories = [
    { id: "produce", name: "Produce", color: "#67a64a", createdAt: now },
    { id: "protein", name: "Protein", color: "#d15336", createdAt: now },
    { id: "dairy", name: "Dairy", color: "#5f91c9", createdAt: now },
    { id: "pantry", name: "Pantry", color: "#c3903f", createdAt: now },
    { id: "sauces", name: "Sauces", color: "#a45f91", createdAt: now },
    { id: "spices", name: "Spices", color: "#e17833", createdAt: now },
    { id: "drinks", name: "Drinks", color: "#3b9a9a", createdAt: now }
];
const rows = [
    ["Pasta", 1, "pack", "pantry", "ready"], ["Rice", 1, "pack", "pantry", "ready"], ["Bolognese sauce", 1, "jar", "sauces", "ready"], ["Peppers", 3, "", "produce", "ready"], ["Tomatoes", 3, "", "produce", "ready"], ["Beer", 1.5, "L", "drinks", "open"], ["Pesto sauce", 1, "jar", "sauces", "ready"], ["Carrots", 4, "", "produce", "ready"], ["Parmigiano", 1, "block", "dairy", "open"], ["Mozzarella", 2, "", "dairy", "ready"], ["Bacon", 1, "pack", "protein", "open"], ["Pork shoulder steaks", 12, "", "protein", "frozen"], ["Olive oil", 1, "bottle", "pantry", "ready"], ["White wine vinegar", 1, "bottle", "pantry", "ready"], ["Black pepper", 1, "jar", "spices", "ready"], ["Salt", 1, "jar", "spices", "ready"], ["Rosemary", 1, "jar", "spices", "ready"], ["Parsley", 1, "jar", "spices", "ready"], ["All-purpose seasoning", 1, "jar", "spices", "ready"], ["Paprika", 1, "jar", "spices", "ready"], ["Basil", 1, "jar", "spices", "ready"], ["Bay leaves", 1, "jar", "spices", "ready"], ["Eggs", 10, "", "protein", "ready"], ["Tuna", 1, "can", "protein", "ready"], ["Instant noodles", 3, "packs", "pantry", "ready"], ["Milk", 2, "L", "dairy", "open"], ["Cream", 0.5, "L", "dairy", "open"], ["Lemon juice", 1, "bottle", "sauces", "open"], ["Butter", 1, "block", "dairy", "open"], ["Soy sauce", 1, "bottle", "sauces", "open"], ["Bread", 1, "loaf", "pantry", "open"], ["Spicy chorizo", 1, "", "protein", "open"], ["Lettuce", 1, "", "produce", "expiring"], ["Closed cup mushrooms", 1, "pack", "produce", "ready"]
];
const seedStock = rows.map(([name, quantity, unit, categoryId, status], index) => ({
    id: `seed-${index}`,
    name,
    quantity,
    unit,
    increment: /^(kg|l)$/i.test(unit) ? 0.1 : /^(g|ml)$/i.test(unit) ? 50 : 1,
    categoryId,
    statuses: ["open", "frozen", "expiring", "leftover"].includes(status) ? [status] : [],
    createdAt: now - index,
    updatedAt: now - index
}));
const stapleIdeas = ["Onions", "Garlic", "Potatoes", "Canned tomatoes", "Chicken stock", "Greek yoghurt", "Fresh coriander", "Chickpeas", "Coconut milk"];
function freshState() { return { version: 1, categories: defaultCategories.map(c => ({ ...c })), stock: seedStock.map(i => ({ ...i })), shopping: [], recipes: [], analytics: {}, activity: [] }; }
