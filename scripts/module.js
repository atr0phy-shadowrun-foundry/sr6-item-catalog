import { CatalogApp } from "./catalog.js";

const MODULE = "sr6-catalog";

Hooks.once("init", () => {
    game.keybindings.register(MODULE, "open", {
        name: "SR6CAT.open",
        editable: [{ key: "KeyB", modifiers: ["Shift", "Alt"] }],
        onDown: () => {
            CatalogApp.open({ actor: selectedActor() });
            return true;
        },
        reservedModifiers: [],
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
});

Hooks.once("ready", () => {
    game.modules.get(MODULE).api = {
        open(options = {}) {
            const opts = { ...options };
            if (opts.actor === undefined) opts.actor = selectedActor();
            return CatalogApp.open(opts);
        },
        pick(options = {}) {
            return CatalogApp.pick(options);
        },
    };
    console.log(`${MODULE} | ready ${game.modules.get(MODULE)?.version ?? "?"}`);
});

Hooks.on("getSceneControlButtons", (controls) => {
    const tool = {
        name: "sr6Catalog",
        title: "Shadowrun Catalog",
        icon: "fas fa-books",
        button: true,
        order: 72,
        onClick: () => CatalogApp.open({ actor: selectedActor() }),
        onChange: () => CatalogApp.open({ actor: selectedActor() }),
    };
    if (Array.isArray(controls)) {
        const tokens = controls.find((entry) => entry.name === "token" || entry.name === "tokens");
        if (!tokens) return;
        if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
        else tokens.tools.sr6Catalog = tool;
        return;
    }
    const tokens = controls.tokens ?? controls.token;
    if (!tokens?.tools) return;
    if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
    else tokens.tools.sr6Catalog = tool;
});

/** Controlled canvas token's actor, preferring an owned Player when several are selected. */
function selectedActor() {
    const tokens = canvas?.tokens?.controlled ?? [];
    const actors = [];
    for (const token of tokens) {
        const actor = token.actor;
        if (!actor) continue;
        if (!actor.isOwner && !game.user.isGM) continue;
        actors.push(actor);
    }
    if (!actors.length) return null;
    return actors.find((entry) => entry.type === "Player") || actors[0];
}
