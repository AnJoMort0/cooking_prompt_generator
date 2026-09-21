/* Lucide adapter for Mise.
   Icons are rendered through Lucide's browser API instead of rebuilding the
   SVG paths ourselves. A fixed .ui-icon wrapper gives every icon the same
   layout box, which keeps labels and controls aligned consistently. */

function makeIcon(lucideName) {
    return function Icon(props = {}) {
        const className = ["ui-icon", props.className].filter(Boolean).join(" ");
        const style = { ...(props.style || {}) };
        if (props.size) style["--icon-size"] = `${Number(props.size)}px`;
        return h("span", {
            className,
            style,
            "data-icon-name": lucideName,
            "aria-hidden": props["aria-label"] ? undefined : "true",
            "aria-label": props["aria-label"],
            role: props["aria-label"] ? "img" : undefined
        }, h("i", {
            "data-lucide": lucideName,
            "data-lucide-stroke-width": String(props.strokeWidth || 2)
        }));
    };
}

function refreshLucideIcons() {
    try {
        if (!globalThis.lucide?.createIcons || !globalThis.lucide?.icons) return;
        /* Avoid rescanning/replacing every icon after state-only renders. */
        if (!document.querySelector("i[data-lucide]")) return;
        globalThis.lucide.createIcons({
            icons: globalThis.lucide.icons,
            attrs: {
                width: "24",
                height: "24",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round"
            }
        });
    }
    catch (error) {
        console.warn("Lucide icons could not be refreshed", error);
    }
}

const Apple = makeIcon("apple");
const ArchiveRestore = makeIcon("archive-restore");
const BarChart3 = makeIcon("chart-no-axes-column");
const Beef = makeIcon("beef");
const BookOpen = makeIcon("book-open");
const Bot = makeIcon("bot");
const Box = makeIcon("box");
const Boxes = makeIcon("boxes");
const CalendarClock = makeIcon("calendar-clock");
const CakeSlice = makeIcon("cake-slice");
const Candy = makeIcon("candy");
const ChefHat = makeIcon("chef-hat");
const Check = makeIcon("check");
const ChevronRight = makeIcon("chevron-right");
const Circle = makeIcon("circle");
const CircleGauge = makeIcon("gauge");
const Clipboard = makeIcon("clipboard");
const ClipboardPaste = makeIcon("clipboard-paste");
const Clock3 = makeIcon("clock-3");
const Globe2 = makeIcon("globe-2");
const ListChecks = makeIcon("list-checks");
const ListOrdered = makeIcon("list-ordered");
const TriangleAlert = makeIcon("triangle-alert");
const Users = makeIcon("users");
const CloudOff = makeIcon("cloud-off");
const CookingPot = makeIcon("cooking-pot");
const Copy = makeIcon("copy");
const GitMerge = makeIcon("git-merge");
const QrCode = makeIcon("qr-code");
const Share2 = makeIcon("share-2");
const Smartphone = makeIcon("smartphone");
const Coffee = makeIcon("coffee");
const Cookie = makeIcon("cookie");
const CupSoda = makeIcon("cup-soda");
const Carrot = makeIcon("carrot");
const Download = makeIcon("download");
const Eye = makeIcon("eye");
const Flame = makeIcon("flame");
const FolderCog = makeIcon("folder-cog");
const Gauge = makeIcon("gauge");
const HardDriveDownload = makeIcon("hard-drive-download");
const History = makeIcon("history");
const Leaf = makeIcon("leaf");
const Lightbulb = makeIcon("lightbulb");
const ListPlus = makeIcon("list-plus");
const Milk = makeIcon("milk");
const Minus = makeIcon("minus");
const Package = makeIcon("package");
const PackageCheck = makeIcon("package-check");
const PackageOpen = makeIcon("package-open");
const PackagePlus = makeIcon("package-plus");
const Pencil = makeIcon("pencil");
const Plus = makeIcon("plus");
const RotateCcw = makeIcon("rotate-ccw");
const Search = makeIcon("search");
const Settings = makeIcon("settings");
const ShieldCheck = makeIcon("shield-check");
const ShoppingBasket = makeIcon("shopping-basket");
const Sandwich = makeIcon("sandwich");
const Snowflake = makeIcon("snowflake");
const Soup = makeIcon("soup");
const Sparkles = makeIcon("sparkles");
const Sprout = makeIcon("sprout");
const Tags = makeIcon("tags");
const Trash2 = makeIcon("trash-2");
const Upload = makeIcon("upload");
const Utensils = makeIcon("utensils");
const Wheat = makeIcon("wheat");
const Wifi = makeIcon("wifi");
const WifiOff = makeIcon("wifi-off");
const X = makeIcon("x");
