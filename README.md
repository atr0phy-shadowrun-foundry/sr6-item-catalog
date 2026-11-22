# Shadowrun Catalog

Foundry module `sr6-catalog` version 0.1.1.

Shared item catalog picker over `shadowrun-data`. Filter by pack, name, price, availability, and actor context (owned, ammo for owned weapons, Essence fit, melee/firearms). Submit either posts a chat card or returns the pick to a calling wizard.

Requires:

- System `shadowrun6-eden` 4.0.11
- Module `shadowrun-data`

## Install

Manifest URL (when published):

`https://raw.githubusercontent.com/atr0phy-shadowrun-foundry/sr6-item-catalog/main/module.json`

Open from the token toolbar (books icon), hotkey Shift+Alt+B, or:

```js
game.modules.get("sr6-catalog").api.open({ actor });
const hit = await game.modules.get("sr6-catalog").api.pick({
  actor,
  packs: ["weapons"],
  preset: "weapons-unowned",
  title: "Pick a weapon",
});
// hit => { pack, documentId, name, uuid, price, index } | null
```
