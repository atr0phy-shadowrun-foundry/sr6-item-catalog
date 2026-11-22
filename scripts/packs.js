/** Pack names from the shadowrun-data module manifest. */
export const PACKS = {
    weapons: "shadowrun-data.weapons-core-berlin-companion",
    ammunition: "shadowrun-data.ammunition-core-berlin-companion",
    armor: "shadowrun-data.armor-core-berlin-companion",
    gear: "shadowrun-data.gear-core-berlin-companion",
    augmentations: "shadowrun-data.augmentations-core-berlin-companion",
    weaponMods: "shadowrun-data.weapon-mods-core-berlin-companion",
    armorMods: "shadowrun-data.armor-mods-core-berlin-companion",
    software: "shadowrun-data.software-core-berlin-companion",
    spells: "shadowrun-data.spells-core-berlin-companion",
    rituals: "shadowrun-data.rituals-core-berlin-companion",
    forms: "shadowrun-data.complexforms-core-berlin-companion",
    adept: "shadowrun-data.adept-powers-core-berlin-companion",
    foci: "shadowrun-data.foci-core-berlin-companion",
    qualities: "shadowrun-data.qualities-normal",
    qualitiesMeta: "shadowrun-data.qualities-metagenic",
    vehicles: "shadowrun-data.vehicles-core-berlin-companion",
    drones: "shadowrun-data.drones-core-berlin-companion",
};

export const PACK_LABELS = {
    weapons: "Weapons",
    ammunition: "Ammunition",
    armor: "Armor",
    gear: "Gear",
    augmentations: "Augmentations",
    weaponMods: "Weapon mods",
    armorMods: "Armor mods",
    software: "Software",
    spells: "Spells",
    rituals: "Rituals",
    forms: "Complex forms",
    adept: "Adept powers",
    foci: "Foci",
    qualities: "Qualities",
    qualitiesMeta: "Metagenic qualities",
    vehicles: "Vehicles",
    drones: "Drones",
};

/** Gear-facing packs for “all gear” browse. */
export const GEAR_PACKS = [
    "weapons", "ammunition", "armor", "gear", "augmentations",
    "weaponMods", "armorMods", "software", "vehicles", "drones",
];

const INDEX_FIELDS = [
    "system.type",
    "system.subtype",
    "system.skill",
    "system.price",
    "system.avail",
    "system.availDef",
    "system.availability",
    "system.essence",
    "system.category",
    "system.drain",
    "system.fading",
    "system.value",
    "system.cost",
    "system.capacity",
    "system.progSlots",
    "system.genesisID",
];

export function packLabel(packKey) {
    return PACK_LABELS[packKey] || packKey;
}

export function packOptions(keys) {
    const list = keys?.length ? keys : Object.keys(PACKS);
    return list.filter((key) => PACKS[key]).map((key) => ({
        key,
        label: packLabel(key),
    }));
}

export function collectionFor(packKey) {
    const id = PACKS[packKey];
    if (!id || typeof game === "undefined") return null;
    return game.packs?.get(id) ?? null;
}

export async function openNativePack(packKey) {
    const collection = collectionFor(packKey);
    if (!collection) {
        ui.notifications.warn("Enable the Shadowrun Compendiums module (shadowrun-data) to open that pack.");
        return null;
    }
    const open = collection.apps?.find?.((app) => app.rendered);
    if (open) return open.render({ force: true });
    const Application = collection.applicationClass
        ?? foundry.applications?.sidebar?.apps?.Compendium;
    if (!Application) {
        ui.notifications.warn("This Foundry build has no compendium window to open.");
        return null;
    }
    return new Application({ collection }).render({ force: true });
}

/**
 * @param {string[]} packKeys
 * @returns {Promise<{ missing: boolean, entries: object[], truncated: boolean }>}
 */
export async function indexPacks(packKeys) {
    const keys = (packKeys?.length ? packKeys : Object.keys(PACKS)).filter((key) => PACKS[key]);
    const entries = [];
    let missing = false;
    for (const packKey of keys) {
        const collection = collectionFor(packKey);
        if (!collection) {
            missing = true;
            continue;
        }
        const index = await collection.getIndex({ fields: INDEX_FIELDS });
        for (const entry of index) {
            const system = systemFromIndex(entry);
            const availRaw = system.avail ?? system.availDef ?? system.availability ?? "";
            entries.push({
                pack: packKey,
                id: entry._id,
                uuid: entry.uuid || `${collection.collection}.${entry._id}`,
                name: entry.name,
                type: entry.type,
                subtype: system.subtype || "",
                systemType: system.type || "",
                skill: system.skill || "",
                genesisID: system.genesisID || "",
                hint: indexHint(system, entry.type),
                price: Number(system.price) || Number(system.cost) || 0,
                avail: availRaw,
                essence: Number(system.essence) || 0,
                karma: Number(system.value) || 0,
                system,
            });
        }
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { missing, entries, truncated: false };
}

function systemFromIndex(entry) {
    if (entry.system && typeof entry.system === "object") return entry.system;
    const holder = {};
    for (const [key, value] of Object.entries(entry)) {
        if (key.startsWith("system.")) foundry.utils.setProperty(holder, key, value);
    }
    return holder.system ?? {};
}

function indexHint(system, type) {
    const bits = [];
    const price = Number(system.price) || Number(system.cost) || 0;
    if (price) bits.push(`${price.toLocaleString()}¥`);
    const avail = system.avail ?? system.availDef ?? system.availability;
    if (avail != null && avail !== "") bits.push(`Avail ${avail}`);
    if (system.essence) bits.push(`Essence ${system.essence}`);
    if (type === "quality" && system.value != null) bits.push(`Karma ${system.value}`);
    if (system.skill) bits.push(String(system.skill).replaceAll("_", " "));
    if (system.subtype) bits.push(String(system.subtype).replaceAll("_", " "));
    else if (system.type) bits.push(String(system.type).replaceAll("_", " "));
    return bits.join(" · ") || type || "Item";
}
