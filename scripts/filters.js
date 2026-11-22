import { availabilityOf } from "./avail.js";
import { GEAR_PACKS } from "./packs.js";

const AMMO_NAME_RULES = [
    { re: /shotgun/i, weapon: /SHOTGUN/i },
    { re: /rifle/i, weapon: /RIFLE|SNIPER|ASSAULT_RIFLE|CARBINE/i },
    { re: /smg|submachine|heavy smg/i, weapon: /SMG|MACHINE_PISTOL/i },
    { re: /machine.?gun|lmg|mmg|hmg/i, weapon: /MACHINE_GUN|LMG|MMG|HMG/i },
    { re: /taser/i, weapon: /TASER/i },
    { re: /cannon/i, weapon: /CANNON/i },
    { re: /dart/i, weapon: /DART|INJECTION/i },
    { re: /holdout|light.?machine|light pistol|heavy pistol|pistol/i, weapon: /PISTOL|HOLDOUT|REVOLVER/i },
];

const PRESETS = {
    "ammo-for-owned": {
        packs: ["ammunition"],
        hideOwned: false,
        ammoForOwned: true,
        fitsEssence: false,
        weaponKind: "",
    },
    "cyber-fits-essence": {
        packs: ["augmentations"],
        hideOwned: true,
        ammoForOwned: false,
        fitsEssence: true,
        weaponKind: "",
    },
    "weapons-unowned": {
        packs: ["weapons"],
        hideOwned: true,
        ammoForOwned: false,
        fitsEssence: false,
        weaponKind: "",
    },
    "weapons-melee": {
        packs: ["weapons"],
        hideOwned: false,
        ammoForOwned: false,
        fitsEssence: false,
        weaponKind: "melee",
    },
    "weapons-firearms": {
        packs: ["weapons"],
        hideOwned: false,
        ammoForOwned: false,
        fitsEssence: false,
        weaponKind: "firearms",
    },
    "weapon-mods": {
        packs: ["weaponMods"],
        hideOwned: false,
        ammoForOwned: false,
        fitsEssence: false,
        weaponKind: "",
    },
};

export function applyPreset(state, presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return state;
    return {
        ...state,
        packs: [...preset.packs],
        hideOwned: preset.hideOwned,
        ammoForOwned: preset.ammoForOwned,
        fitsEssence: preset.fitsEssence,
        weaponKind: preset.weaponKind,
        preset: presetId,
    };
}

export function defaultFilterState(options = {}) {
    let state = {
        packs: options.packs?.length ? [...options.packs] : [...GEAR_PACKS],
        query: options.query || "",
        priceMin: options.priceMin ?? "",
        priceMax: options.priceMax ?? "",
        readyOnly: Boolean(options.readyOnly),
        hideOwned: Boolean(options.hideOwned),
        ammoForOwned: Boolean(options.ammoForOwned),
        fitsEssence: Boolean(options.fitsEssence),
        weaponKind: options.weaponKind || "",
        preset: options.preset || "",
    };
    if (options.preset) state = applyPreset(state, options.preset);
    if (options.packs?.length) state.packs = [...options.packs];
    return state;
}

export function presetOptions() {
    return [
        { id: "", label: "No preset" },
        { id: "weapons-unowned", label: "Weapons I do not own" },
        { id: "weapons-melee", label: "Melee weapons" },
        { id: "weapons-firearms", label: "Firearms" },
        { id: "ammo-for-owned", label: "Ammo for owned weapons" },
        { id: "weapon-mods", label: "Weapon mods" },
        { id: "cyber-fits-essence", label: "Cyber that fits Essence" },
    ];
}

/**
 * @param {object[]} entries
 * @param {object} filter
 * @param {Actor|null} actor
 * @param {{ limit?: number }} [opts]
 */
export function filterEntries(entries, filter, actor, opts = {}) {
    const limit = opts.limit ?? 40;
    const query = (filter.query || "").trim().toLowerCase();
    const priceMin = filter.priceMin === "" || filter.priceMin == null ? null : Number(filter.priceMin);
    const priceMax = filter.priceMax === "" || filter.priceMax == null ? null : Number(filter.priceMax);
    const owned = actor ? ownedKeys(actor) : null;
    const weapons = actor ? actor.items.filter(isWeaponItem) : [];
    const essenceLeft = actor ? remainingEssence(actor) : null;

    const matched = [];
    for (const entry of entries) {
        if (filter.packs?.length && !filter.packs.includes(entry.pack)) continue;
        if (query && !entry.name.toLowerCase().includes(query)) continue;
        if (priceMin != null && Number.isFinite(priceMin) && entry.price < priceMin) continue;
        if (priceMax != null && Number.isFinite(priceMax) && entry.price > priceMax) continue;
        if (filter.readyOnly && !availabilityOf(entry.system).ready) continue;
        if (filter.hideOwned && owned && isOwned(entry, owned)) continue;
        if (filter.weaponKind && !matchesWeaponKind(entry, filter.weaponKind)) continue;
        if (filter.fitsEssence) {
            if (entry.pack !== "augmentations" && !Number(entry.essence)) continue;
            if (essenceLeft != null && entry.essence > essenceLeft) continue;
        }
        let ammoRank = 0;
        if (filter.ammoForOwned) {
            if (entry.pack !== "ammunition") continue;
            if (!weapons.length) continue;
            ammoRank = weapons.reduce((rank, weapon) => {
                const next = ammoRelevanceRank(entry, weapon);
                return Math.min(rank, next);
            }, 2);
            if (ammoRank > 1) continue; // keep exact + likely only
        }
        matched.push({ entry, ammoRank });
    }

    if (filter.ammoForOwned) {
        matched.sort((a, b) => (a.ammoRank - b.ammoRank) || a.entry.name.localeCompare(b.entry.name));
    } else {
        matched.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
    }

    const truncated = matched.length > limit;
    return {
        entries: matched.slice(0, limit).map(({ entry }) => {
            const { system, ...rest } = entry;
            return rest;
        }),
        total: matched.length,
        truncated,
    };
}

function ownedKeys(actor) {
    const names = new Set();
    const genesis = new Set();
    for (const item of actor.items) {
        names.add(`${item.type}:${item.name}`.toLowerCase());
        if (item.system?.genesisID) genesis.add(String(item.system.genesisID));
    }
    return { names, genesis };
}

function isOwned(entry, owned) {
    if (entry.genesisID && owned.genesis.has(String(entry.genesisID))) return true;
    return owned.names.has(`${entry.type}:${entry.name}`.toLowerCase());
}

function isWeaponItem(item) {
    return item?.type === "gear" && String(item.system?.type || "").includes("WEAPON");
}

function remainingEssence(actor) {
    const derived = Number(actor.system?.essence);
    if (Number.isFinite(derived)) return Math.max(0, derived);
    const pool = Number(actor.system?.attributes?.essence?.pool);
    if (!Number.isFinite(pool)) return null;
    let cost = 0;
    for (const item of actor.items) {
        if (item.type === "gear") cost += Number(item.system?.essence) || 0;
    }
    return Math.max(0, pool - cost);
}

function matchesWeaponKind(entry, kind) {
    if (entry.pack !== "weapons" && !String(entry.systemType).includes("WEAPON")) return false;
    const type = String(entry.systemType || "");
    const skill = String(entry.skill || "");
    if (kind === "melee") {
        return type.includes("WEAPON_CLOSE") || type.includes("MELEE") || skill === "close_combat"
            || /AXE|SWORD|KNIFE|CLUB|STAFF|UNARMED|POLEARM|CYBER_IMPLANT/i.test(`${type} ${entry.subtype}`);
    }
    if (kind === "firearms") {
        return type.includes("WEAPON_FIREARMS") || skill === "firearms";
    }
    return true;
}

function ammoRelevanceRank(entry, weapon) {
    const subtype = String(entry.subtype || "");
    const wsub = String(weapon.system?.subtype || "");
    const wtype = String(weapon.system?.type || "");
    const name = entry.name || "";

    if (subtype === "BOWS" && /BOW/i.test(wsub)) return 0;
    if (subtype === "CROSSBOWS" && /CROSSBOW/i.test(wsub)) return 0;
    if (subtype === "BALLISTAS" && /BALLISTA/i.test(wsub)) return 0;
    if (["ROCKETS", "MISSILES"].includes(subtype) && /LAUNCHER|ROCKET|MISSILE/i.test(`${wtype} ${wsub}`)) return 0;
    if (subtype === "GRENADES" && /GRENADE|LAUNCHER/i.test(`${wtype} ${wsub}`)) return 1;

    if (subtype === "AMMUNITION" || !subtype) {
        for (const rule of AMMO_NAME_RULES) {
            if (rule.re.test(name) && rule.weapon.test(`${wsub} ${wtype} ${weapon.name}`)) return 0;
        }
        if (/WEAPON_FIREARMS/i.test(wtype)) return 1;
    }
    return 2;
}
