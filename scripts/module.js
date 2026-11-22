import { CatalogApp } from "./catalog.js";

const MODULE = "sr6-catalog";

Hooks.once("init", () => {
    game.keybindings.register(MODULE, "open", {
        name: "SR6CAT.open",
        editable: [{ key: "KeyB", modifiers: ["Shift", "Alt"] }],
        onDown: () => {
            CatalogApp.open();
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
            return CatalogApp.open(options);
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
        onClick: () => CatalogApp.open(),
        onChange: () => CatalogApp.open(),
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
