import { applyPreset, defaultFilterState, filterEntries, presetOptions } from "./filters.js";
import { GEAR_PACKS, indexPacks, openNativePack, packLabel, packOptions } from "./packs.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE = "sr6-catalog";

export class CatalogApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "sr6-catalog",
        classes: ["sr6-catalog"],
        tag: "form",
        window: {
            icon: "fas fa-books",
            resizable: true,
            minimizable: true,
        },
        position: {
            width: 820,
            height: 700,
        },
        form: {
            submitOnChange: false,
            closeOnSubmit: false,
        },
        actions: {},
    };

    static PARTS = {
        catalog: {
            template: "modules/sr6-catalog/templates/catalog.hbs",
            scrollable: [".sr6cat-results"],
        },
    };

    static {
        this.DEFAULT_OPTIONS.form.handler = this.#onSubmit;
        this.DEFAULT_OPTIONS.actions = {
            apply: this.#onApply,
            pick: this.#onPick,
            submit: this.#onSubmitPick,
            cancel: this.#onCancel,
            pack: this.#onOpenPack,
            preset: this.#onPreset,
        };
    }

    static #app = null;

    /** Manual open — Submit posts to chat. */
    static open(options = {}) {
        const app = this.#ensure();
        app.#configure({ ...options, mode: "chat" });
        app.render({ force: true });
        return app;
    }

    /**
     * Wizard open — Submit resolves the Promise with the hit (or null on cancel/close).
     * @returns {Promise<object|null>}
     */
    static pick(options = {}) {
        const app = this.#ensure();
        if (app.#pendingResolve) {
            app.#pendingResolve(null);
            app.#pendingResolve = null;
        }
        return new Promise((resolve) => {
            app.#pendingResolve = resolve;
            app.#configure({ ...options, mode: "return" });
            app.render({ force: true });
        });
    }

    static #ensure() {
        if (!this.#app) this.#app = new CatalogApp();
        return this.#app;
    }

    constructor(options = {}) {
        super(options);
        this.catalog = {
            mode: "chat",
            titleOverride: "",
            actorUuid: null,
            filter: defaultFilterState(),
            selected: null,
            cache: null,
            cacheKey: "",
        };
        this.#pendingResolve = null;
    }

    #pendingResolve = null;

    get title() {
        if (this.catalog.titleOverride) return this.catalog.titleOverride;
        return this.catalog.mode === "return" ? "Catalog — pick an item" : "Shadowrun Catalog";
    }

    get actor() {
        if (!this.catalog.actorUuid) return null;
        const doc = fromUuidSync(this.catalog.actorUuid);
        return doc?.actor ?? doc ?? null;
    }

    #configure(options = {}) {
        this.catalog.mode = options.mode === "return" ? "return" : "chat";
        this.catalog.titleOverride = options.title || "";
        this.catalog.actorUuid = options.actor?.uuid ?? options.actorUuid ?? null;
        this.catalog.filter = defaultFilterState(options);
        this.catalog.selected = null;
        this.catalog.cache = null;
        this.catalog.cacheKey = "";
    }

    async _prepareContext(options) {
        const context = typeof super._prepareContext === "function"
            ? await super._prepareContext(options)
            : {};
        const filter = this.catalog.filter;
        const packKeys = filter.packs?.length ? filter.packs : GEAR_PACKS;
        const cacheKey = packKeys.slice().sort().join(",");
        if (!this.catalog.cache || this.catalog.cacheKey !== cacheKey) {
            this.catalog.cache = await indexPacks(packKeys);
            this.catalog.cacheKey = cacheKey;
        }
        const filtered = filterEntries(this.catalog.cache.entries, filter, this.actor, { limit: 40 });
        const selectedId = this.catalog.selected
            ? `${this.catalog.selected.pack}:${this.catalog.selected.id}`
            : "";

        return {
            ...context,
            mode: this.catalog.mode,
            isReturn: this.catalog.mode === "return",
            actorName: this.actor?.name || "",
            hasActor: Boolean(this.actor),
            filter,
            allPacks: packOptions().map((entry) => ({
                ...entry,
                checked: (filter.packs || []).includes(entry.key),
            })),
            presetChoices: presetOptions().map((entry) => ({
                ...entry,
                selected: entry.id === (filter.preset || ""),
            })),
            weaponKindChoices: [
                { id: "", label: "Any", selected: !filter.weaponKind },
                { id: "melee", label: "Melee", selected: filter.weaponKind === "melee" },
                { id: "firearms", label: "Firearms", selected: filter.weaponKind === "firearms" },
            ],
            results: filtered.entries.map((entry) => ({
                ...entry,
                key: `${entry.pack}:${entry.id}`,
                selected: selectedId === `${entry.pack}:${entry.id}`,
                packLabel: packLabel(entry.pack),
            })),
            total: filtered.total,
            plural: filtered.total !== 1,
            resultCount: filtered.entries.length,
            truncated: filtered.truncated,
            missing: this.catalog.cache.missing,
            selected: this.catalog.selected,
            submitLabel: this.catalog.mode === "return" ? "Use selection" : "Post to chat",
        };
    }

    async close(options = {}) {
        if (this.#pendingResolve) {
            this.#pendingResolve(null);
            this.#pendingResolve = null;
        }
        return super.close(options);
    }

    static async #onSubmit(event, form) {
        this.#readForm(form);
        return this.render();
    }

    static async #onApply(event) {
        event.preventDefault();
        this.#readForm(this.element);
        return this.render();
    }

    static async #onPreset(event, target) {
        event.preventDefault();
        const preset = target.dataset.preset ?? this.element?.querySelector?.("[name=preset]")?.value;
        this.#readForm(this.element);
        this.catalog.filter = applyPreset(this.catalog.filter, preset || "");
        this.catalog.selected = null;
        this.catalog.cache = null;
        return this.render();
    }

    static async #onPick(event, target) {
        event.preventDefault();
        const pack = target.dataset.pack;
        const id = target.dataset.documentId;
        const name = target.dataset.label || target.textContent.trim();
        const price = Number(target.dataset.price) || 0;
        const karma = Number(target.dataset.karma) || 0;
        const essence = Number(target.dataset.essence) || 0;
        const avail = target.dataset.avail || "";
        const uuid = target.dataset.uuid || "";
        this.catalog.selected = {
            pack, documentId: id, id, name, price, karma, essence, avail, uuid,
        };
        return this.render();
    }

    static async #onSubmitPick(event) {
        event.preventDefault();
        const hit = this.catalog.selected;
        if (!hit) {
            ui.notifications.warn("Select a catalog row first.");
            return;
        }
        const payload = {
            pack: hit.pack,
            documentId: hit.documentId || hit.id,
            name: hit.name,
            uuid: hit.uuid,
            price: hit.price,
            karma: hit.karma,
            essence: hit.essence,
            avail: hit.avail,
            index: { ...hit },
        };
        if (this.catalog.mode === "return") {
            const resolve = this.#pendingResolve;
            this.#pendingResolve = null;
            resolve?.(payload);
            return this.close();
        }
        await postChatPick(payload, this.actor);
        ui.notifications.info(`${payload.name} posted to chat.`);
        return this.close();
    }

    static async #onCancel(event) {
        event.preventDefault();
        if (this.#pendingResolve) {
            this.#pendingResolve(null);
            this.#pendingResolve = null;
        }
        return this.close();
    }

    static async #onOpenPack(event) {
        event.preventDefault();
        const pack = this.catalog.selected?.pack
            || this.catalog.filter.packs?.[0]
            || "weapons";
        await openNativePack(pack);
    }

    #readForm(form) {
        if (!form) return;
        const query = form.querySelector?.("[name=query]")?.value ?? "";
        const priceMin = form.querySelector?.("[name=priceMin]")?.value ?? "";
        const priceMax = form.querySelector?.("[name=priceMax]")?.value ?? "";
        const readyOnly = Boolean(form.querySelector?.("[name=readyOnly]")?.checked);
        const hideOwned = Boolean(form.querySelector?.("[name=hideOwned]")?.checked);
        const ammoForOwned = Boolean(form.querySelector?.("[name=ammoForOwned]")?.checked);
        const fitsEssence = Boolean(form.querySelector?.("[name=fitsEssence]")?.checked);
        const weaponKind = form.querySelector?.("[name=weaponKind]")?.value ?? "";
        const preset = form.querySelector?.("[name=preset]")?.value ?? "";
        const packBoxes = form.querySelectorAll?.("[name=pack]");
        let packs = packBoxes?.length
            ? [...packBoxes].filter((input) => input.checked).map((input) => input.value)
            : [...(this.catalog.filter.packs || [])];
        if (!packs.length) packs = [...GEAR_PACKS];
        this.catalog.filter = {
            ...this.catalog.filter,
            query,
            priceMin,
            priceMax,
            readyOnly,
            hideOwned,
            ammoForOwned,
            fitsEssence,
            weaponKind,
            preset,
            packs,
        };
    }
}

async function postChatPick(payload, actor) {
    const bits = [
        payload.name,
        packLabel(payload.pack),
        payload.price ? `${payload.price.toLocaleString()}¥` : "",
    ].filter(Boolean);
    const content = `
        <div class="sr6cat-chat">
            <header><strong>Catalog pick</strong></header>
            <p>${bits.map(escapeHtml).join(" · ")}</p>
            ${actor ? `<p>${escapeHtml(actor.name)}</p>` : ""}
            <p class="notes">Pack <code>${escapeHtml(payload.pack)}</code> · id <code>${escapeHtml(payload.documentId)}</code></p>
        </div>`;
    return ChatMessage.create({
        content,
        speaker: { alias: "Shadowrun Catalog", actor: actor?.id },
        flags: { [MODULE]: { kind: "pick", payload } },
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
