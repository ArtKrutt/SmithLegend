(function () {
  "use strict";

  const source = window.SMITH_LEGEND_DATA || { pets: [], skills: [] };
  const pets = Array.isArray(source.pets) ? source.pets : [];
  const skills = Array.isArray(source.skills) ? source.skills : [];
  const wings = Array.isArray(source.wings) ? source.wings : [];
  const mounts = Array.isArray(source.mounts) ? source.mounts : [];
  const events = source.events || {};
  const baseData = source.base || {};
  const pvpRewards = source.pvpRewards || {};
  const iconRecords = source.icons && Array.isArray(source.icons.records) ? source.icons.records : [];
  const iconByKey = new Map(iconRecords.map((record) => [`${record.category}:${record.id}`, record]));
  let iconZoomEl = null;

  const rarityNames = ["Common", "Rare", "Epic", "Legendary", "Mystic"];
  const rarityClass = ["common", "rare", "epic", "legendary", "mystic"];
  const rarityMultiplier = [1, 2, 5, 10, 15];
  const defaultLevel = 10;
  const statTypes = [
    { id: 0, name: "Attack Damage", short: "Atk" },
    { id: 1, name: "Attack Speed", short: "Atk Spd" },
    { id: 2, name: "Crit Chance", short: "Crit %" },
    { id: 3, name: "Crit Damage", short: "Crit Dmg" },
    { id: 4, name: "Double Attack Chance", short: "Double" },
    { id: 5, name: "Multi Atk Chance", short: "Multi" },
    { id: 6, name: "Coin Bonus", short: "Coin" },
    { id: 7, name: "Skill Cooldown Decrease", short: "CDR" },
    { id: 8, name: "Block Chance", short: "Block" },
    { id: 9, name: "Luck", short: "Luck" },
    { id: 10, name: "Armor", short: "Armor" }
  ];
  const statById = new Map(statTypes.map((stat) => [stat.id, stat]));

  const state = {
    activeView: "overview",
    petSort: { key: "petNum", dir: "asc" },
    skillSort: { key: "dps", dir: "desc" },
    wingSort: { key: "wingNum", dir: "asc" },
    mountSort: { key: "mountNum", dir: "asc" },
    eventSort: { key: "category", dir: "asc" },
    baseSort: { key: "id", dir: "asc" },
    pvpSort: { key: "tier", dir: "asc" },
    skillBuildLevels: new Map(),
    selectedSkills: new Set(),
    petBuildLevels: new Map(),
    selectedPets: new Set()
  };

  const els = {
    datasetStats: document.getElementById("datasetStats"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    views: Array.from(document.querySelectorAll("[data-view-panel]")),
    overviewPetLevel: document.getElementById("overviewPetLevel"),
    overviewPetLevelOut: document.getElementById("overviewPetLevelOut"),
    overviewSkillLevel: document.getElementById("overviewSkillLevel"),
    overviewSkillLevelOut: document.getElementById("overviewSkillLevelOut"),
    overviewSummary: document.getElementById("overviewSummary"),
    overviewTopPets: document.getElementById("overviewTopPets"),
    overviewTopSkills: document.getElementById("overviewTopSkills"),
    petSearch: document.getElementById("petSearch"),
    petRarityFilter: document.getElementById("petRarityFilter"),
    petStatFilter: document.getElementById("petStatFilter"),
    petLevel: document.getElementById("petLevel"),
    petLevelOut: document.getElementById("petLevelOut"),
    petTableMeta: document.getElementById("petTableMeta"),
    petTableHead: document.getElementById("petTableHead"),
    petTableBody: document.getElementById("petTableBody"),
    skillSearch: document.getElementById("skillSearch"),
    skillRarityFilter: document.getElementById("skillRarityFilter"),
    skillLevel: document.getElementById("skillLevel"),
    skillLevelOut: document.getElementById("skillLevelOut"),
    skillTableMeta: document.getElementById("skillTableMeta"),
    skillTableHead: document.getElementById("skillTableHead"),
    skillTableBody: document.getElementById("skillTableBody"),
    wingSearch: document.getElementById("wingSearch"),
    wingTableMeta: document.getElementById("wingTableMeta"),
    wingTableHead: document.getElementById("wingTableHead"),
    wingTableBody: document.getElementById("wingTableBody"),
    mountSearch: document.getElementById("mountSearch"),
    mountTableMeta: document.getElementById("mountTableMeta"),
    mountTableHead: document.getElementById("mountTableHead"),
    mountTableBody: document.getElementById("mountTableBody"),
    eventTableMeta: document.getElementById("eventTableMeta"),
    eventTableHead: document.getElementById("eventTableHead"),
    eventTableBody: document.getElementById("eventTableBody"),
    baseTableMeta: document.getElementById("baseTableMeta"),
    baseTableHead: document.getElementById("baseTableHead"),
    baseTableBody: document.getElementById("baseTableBody"),
    pvpTableMeta: document.getElementById("pvpTableMeta"),
    pvpTableHead: document.getElementById("pvpTableHead"),
    pvpTableBody: document.getElementById("pvpTableBody"),
    skillBuildLevel: document.getElementById("skillBuildLevel"),
    skillBuildLevelOut: document.getElementById("skillBuildLevelOut"),
    selectAllSkills: document.getElementById("selectAllSkills"),
    clearSkills: document.getElementById("clearSkills"),
    topDpsSkills: document.getElementById("topDpsSkills"),
    topAttackSkills: document.getElementById("topAttackSkills"),
    skillBuildTotals: document.getElementById("skillBuildTotals"),
    skillBuildBody: document.getElementById("skillBuildBody"),
    skillBuildMeta: document.getElementById("skillBuildMeta"),
    petBuildLevel: document.getElementById("petBuildLevel"),
    petBuildLevelOut: document.getElementById("petBuildLevelOut"),
    selectAllPets: document.getElementById("selectAllPets"),
    clearPets: document.getElementById("clearPets"),
    topAttackPets: document.getElementById("topAttackPets"),
    topCooldownPets: document.getElementById("topCooldownPets"),
    petBuildTotals: document.getElementById("petBuildTotals"),
    petBuildBody: document.getElementById("petBuildBody"),
    petBuildMeta: document.getElementById("petBuildMeta")
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clamp(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, Math.round(numeric)));
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "";
    const rounded = Math.round(value * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace(/0+$/g, "").replace(/\.$/g, "");
  }

  function compareValues(a, b) {
    const aNumber = Number(a);
    const bNumber = Number(b);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }
    return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function petName(pet) {
    return pet.petName && pet.petName !== "0" ? pet.petName : `Pet ${pet.petNum}`;
  }

  function skillName(skill) {
    return skill.skillName || skill.skillKey || String(skill.gameObjectName || "").replace(/^Skill_/, "") || `Skill ${skill.skillNum}`;
  }

  function wingName(wing) {
    return wing.wingName || `Wing ${wing.wingNum}`;
  }

  function mountName(mount) {
    return mount.mountName || `Mount ${mount.mountNum}`;
  }

  function iconRecord(category, id) {
    return iconByKey.get(`${category}:${id}`) || null;
  }

  function iconName(record) {
    return record && record.sprite ? record.sprite.name : "";
  }

  function textureWebPath(texture) {
    if (!texture) return "";
    if (texture.webPath) return texture.webPath;
    if (texture.pngPath && texture.pngPath.startsWith("web/")) return texture.pngPath.slice(4);
    return texture.pngPath || "";
  }

  function cssPixel(value) {
    return `${Math.round(Number(value || 0) * 100) / 100}px`;
  }

  function cssUrl(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .replace(/"/g, "%22")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\s/g, "%20");
  }

  function renderSpriteIcon(record, size = 42, extraClass = "") {
    const sprite = record && record.sprite;
    const texture = sprite && sprite.texture;
    const rect = sprite && sprite.rect;
    const webPath = textureWebPath(texture);
    if (!texture || !rect || !webPath) return "";

    const scale = Number(size || 42) / Math.max(Number(rect.width) || 1, Number(rect.height) || 1);
    const topY = Number(texture.height || 0) - Number(rect.y || 0) - Number(rect.height || 0);
    const style = [
      `width:${cssPixel(rect.width * scale)}`,
      `height:${cssPixel(rect.height * scale)}`,
      `background-image:url("${cssUrl(webPath)}")`,
      `background-size:${cssPixel(texture.width * scale)} ${cssPixel(texture.height * scale)}`,
      `background-position:${cssPixel(-rect.x * scale)} ${cssPixel(-topY * scale)}`
    ].join(";");
    const label = `${record.category} icon: ${record.name}`;
    const className = `sprite-icon${extraClass ? ` ${extraClass}` : ""}`;
    return `<span class="${escapeHtml(className)}" role="img" aria-label="${escapeHtml(label)}" style="${escapeHtml(style)}"></span>`;
  }

  function renderIconCell(record) {
    if (!record || !record.sprite) return "";
    return `<div class="icon-only" data-icon-category="${escapeHtml(record.category)}" data-icon-id="${escapeHtml(record.id)}">${renderSpriteIcon(record)}</div>`;
  }

  function ensureIconZoom() {
    if (iconZoomEl) return iconZoomEl;
    iconZoomEl = document.createElement("div");
    iconZoomEl.className = "icon-zoom-popover";
    iconZoomEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(iconZoomEl);
    return iconZoomEl;
  }

  function hideIconZoom() {
    if (iconZoomEl) iconZoomEl.classList.remove("is-visible");
  }

  function showIconZoom(cell) {
    const record = iconRecord(cell.dataset.iconCategory, cell.dataset.iconId);
    if (!record || !record.sprite) return;
    const popover = ensureIconZoom();
    popover.innerHTML = renderSpriteIcon(record, 126);
    popover.classList.add("is-visible");

    const rect = cell.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const gap = 10;
    let left = rect.left + rect.width / 2 - width / 2;
    let top = rect.top - height - gap;
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    if (top < 8) top = Math.min(window.innerHeight - height - 8, rect.bottom + gap);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  }

  function rarityLabel(rarity) {
    return rarityNames[rarity] || `Rarity ${rarity}`;
  }

  function rarityBadge(rarity) {
    const label = rarityLabel(rarity);
    const className = rarityClass[rarity] || "common";
    return `<span class="rarity ${className}">${escapeHtml(label)}</span>`;
  }

  function statLabel(statType, useShort) {
    const stat = statById.get(Number(statType));
    if (!stat) return `Stat ${statType}`;
    return useShort ? stat.short : stat.name;
  }

  function getPetStat(pet, statType) {
    return (pet.stats || []).find((stat) => Number(stat.statType) === Number(statType));
  }

  function petStatValue(baseValue, statType, level) {
    const denominator = Number(statType) === 0 ? 10 : 25;
    return Number(baseValue || 0) + (Number(baseValue || 0) / denominator) * level;
  }

  function petStatAtLevel(pet, statType, level) {
    const stat = getPetStat(pet, statType);
    if (!stat) return 0;
    return petStatValue(stat.baseValue, stat.statType, level);
  }

  function petRequiredExp(level) {
    const value = clamp(level, 0, 999);
    let multiplier = 2;
    if (value >= 90) multiplier = 8;
    else if (value >= 80) multiplier = 7;
    else if (value >= 70) multiplier = 6;
    else if (value >= 60) multiplier = 5;
    else if (value >= 50) multiplier = 4;
    else if (value >= 40) multiplier = 3;
    return multiplier * (value + 1);
  }

  function skillRequiredExp(level) {
    const value = clamp(level, 0, 999);
    let multiplier = 2;
    if (value >= 70) multiplier = 5;
    else if (value >= 60) multiplier = 4;
    else if (value >= 50) multiplier = 3;
    return multiplier * (value + 1);
  }

  function totalExpToLevel(level, requiredExpFn) {
    const target = clamp(level, 0, 999);
    let total = 0;
    for (let current = 0; current < target; current += 1) {
      total += requiredExpFn(current);
    }
    return total;
  }

  function skillBonusDamage(skill, level) {
    return level * (rarityMultiplier[Number(skill.rarity)] || 0);
  }

  function petBonusDamage(pet, level) {
    return level * (rarityMultiplier[Number(pet.rarity)] || 0);
  }

  function knownSkillAttack(skill, level) {
    return Number(skill.baseAttack || 0) + skillBonusDamage(skill, level);
  }

  function petAttackPlusBonus(pet, level) {
    return petStatAtLevel(pet, 0, level) + petBonusDamage(pet, level);
  }

  function simpleSkillChain(skill, level) {
    const multi = Math.max(1, Number(skill.baseMultipleCount || 0));
    const bounce = Math.max(1, Number(skill.baseBounceCount || 0));
    return knownSkillAttack(skill, level) * multi * bounce;
  }

  function skillDps(skill, level) {
    const cooldown = Number(skill.startedCooldown || 0);
    if (cooldown <= 0) return 0;
    return simpleSkillChain(skill, level) / cooldown;
  }

  function targetInfo(value) {
    const target = Number(value || 0);
    const labels = {
      0: {
        label: "Target",
        detail: "Generic in-game target label. Native SkillUiGenel.TargetString does not distinguish this from target 1."
      },
      1: {
        label: "Target",
        detail: "Second generic in-game target value. Native SkillUiGenel.TargetString shows the same label as target 0."
      },
      2: {
        label: "Highest HP",
        detail: "Native SkillUiGenel.TargetString maps value 2 to the highest-HP target label."
      },
      3: {
        label: "Random enemy",
        detail: "Native SkillUiGenel.TargetString maps value 3 to the random-enemy target label."
      }
    };
    return labels[target] || { label: `Target ${target}`, detail: "Unknown target value in recovered data." };
  }

  function renderTargetCell(skill) {
    const target = targetInfo(skill.targetNedir);
    return `<span class="target-cell" title="${escapeHtml(target.detail)}">${escapeHtml(target.label)} <span class="name-sub">${escapeHtml(
      `(${skill.targetNedir})`
    )}</span></span>`;
  }

  function nextExpLabel(item, level, requiredExpFn) {
    const maxLevel = Number(item.maxLevel || 100);
    if (level >= maxLevel) return "max";
    return formatNumber(requiredExpFn(level));
  }

  function statChipsForPet(pet, level) {
    const baseChips = (pet.stats || [])
      .map((stat) => {
        const name = statLabel(stat.statType, true);
        const current = petStatValue(stat.baseValue, stat.statType, level);
        return `<span class="stat-chip"><span>${escapeHtml(name)}</span><strong>${formatNumber(current)}</strong></span>`;
      })
      .join("");
    const bonus = petBonusDamage(pet, level);
    const attackPlusBonus = petAttackPlusBonus(pet, level);
    return `${baseChips}<span class="stat-chip bonus-chip"><span>Passive</span><strong>${formatNumber(
      bonus
    )}</strong></span><span class="stat-chip bonus-chip"><span>Atk+Bonus</span><strong>${formatNumber(attackPlusBonus)}</strong></span>`;
  }

  function statChipsForSkill(skill, level) {
    const target = targetInfo(skill.targetNedir);
    const bonus = skillBonusDamage(skill, level);
    const attack = knownSkillAttack(skill, level);
    const chain = simpleSkillChain(skill, level);
    const dps = skillDps(skill, level);
    const cooldown = Number(skill.startedCooldown || 0);
    return [
      `<span class="stat-chip"><span>Base</span><strong>${formatNumber(Number(skill.baseAttack || 0))}</strong></span>`,
      `<span class="stat-chip bonus-chip"><span>Bonus</span><strong>${formatNumber(bonus)}</strong></span>`,
      `<span class="stat-chip bonus-chip"><span>Base+Bonus</span><strong>${formatNumber(attack)}</strong></span>`,
      `<span class="stat-chip"><span>Chain</span><strong>${formatNumber(chain)}</strong></span>`,
      `<span class="stat-chip"><span>DPS</span><strong>${formatNumber(dps)}</strong></span>`,
      `<span class="stat-chip"><span>CD</span><strong>${formatNumber(cooldown)}s</strong></span>`,
      `<span class="stat-chip"><span>Target</span><strong>${escapeHtml(target.label)} ${escapeHtml(`(${skill.targetNedir})`)}</strong></span>`,
      `<span class="stat-chip"><span>Next EXP</span><strong>${nextExpLabel(skill, level, skillRequiredExp)}</strong></span>`
    ].join("");
  }

  function renderNameCell(main, sub) {
    return `<div class="name-cell"><span class="name-main">${escapeHtml(main)}</span><span class="name-sub">${escapeHtml(sub)}</span></div>`;
  }

  function setOptions(select, options, selectedValue) {
    select.innerHTML = options
      .map((option) => {
        const selected = String(option.value) === String(selectedValue) ? " selected" : "";
        return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
      })
      .join("");
  }

  function setupFilters() {
    const rarityOptions = [{ value: "all", label: "All rarities" }].concat(
      rarityNames.map((name, index) => ({ value: String(index), label: name }))
    );
    setOptions(els.petRarityFilter, rarityOptions, "all");
    setOptions(els.skillRarityFilter, rarityOptions, "all");
    setOptions(
      els.petStatFilter,
      [{ value: "all", label: "All stats" }].concat(statTypes.map((stat) => ({ value: String(stat.id), label: stat.name }))),
      "all"
    );
  }

  function renderMetric(label, value, sub) {
    return `<div class="metric"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ""}</div>`;
  }

  function renderOverview() {
    const petLevel = clamp(els.overviewPetLevel.value, 0, 100);
    const skillLevel = clamp(els.overviewSkillLevel.value, 0, 100);
    els.overviewPetLevelOut.value = String(petLevel);
    els.overviewSkillLevelOut.value = String(skillLevel);

    const bestAttackPet = pets
      .slice()
      .sort((a, b) => petAttackPlusBonus(b, petLevel) - petAttackPlusBonus(a, petLevel))[0];
    const bestCooldownPet = pets
      .slice()
      .sort((a, b) => petStatAtLevel(b, 7, petLevel) - petStatAtLevel(a, 7, petLevel))[0];
    const bestSkill = skills
      .slice()
      .sort((a, b) => knownSkillAttack(b, skillLevel) - knownSkillAttack(a, skillLevel))[0];
    const bestDpsSkill = skills
      .slice()
      .sort((a, b) => skillDps(b, skillLevel) - skillDps(a, skillLevel))[0];
    const fastestSkill = skills
      .slice()
      .sort((a, b) => Number(a.startedCooldown || 0) - Number(b.startedCooldown || 0))[0];

    els.overviewSummary.innerHTML = [
      renderMetric("Pets", String(pets.length), `Next EXP at L${petLevel}: ${petLevel >= 100 ? "max" : formatNumber(petRequiredExp(petLevel))}`),
      renderMetric("Skills", String(skills.length), `Next EXP at L${skillLevel}: ${skillLevel >= 100 ? "max" : formatNumber(skillRequiredExp(skillLevel))}`),
      renderMetric("Wings", String(wings.length), "Templates with icon refs"),
      renderMetric("Mounts", String(mounts.length), "1.0.41 templates with icon refs"),
      renderMetric("Icon records", String(iconRecords.length), "Pets, skills, wings, mounts"),
      bestAttackPet
        ? renderMetric("Best pet attack + bonus", formatNumber(petAttackPlusBonus(bestAttackPet, petLevel)), petName(bestAttackPet))
        : "",
      bestCooldownPet && petStatAtLevel(bestCooldownPet, 7, petLevel) > 0
        ? renderMetric("Best pet cooldown", formatNumber(petStatAtLevel(bestCooldownPet, 7, petLevel)), petName(bestCooldownPet))
        : renderMetric("Best pet cooldown", "0", "No cooldown pet selected by stat"),
      bestSkill ? renderMetric("Highest skill base + bonus", formatNumber(knownSkillAttack(bestSkill, skillLevel)), skillName(bestSkill)) : "",
      bestDpsSkill ? renderMetric("Highest skill DPS", formatNumber(skillDps(bestDpsSkill, skillLevel)), skillName(bestDpsSkill)) : "",
      fastestSkill ? renderMetric("Fastest skill cooldown", `${formatNumber(Number(fastestSkill.startedCooldown || 0))}s`, skillName(fastestSkill)) : ""
    ].join("");

    const topPetRows = statTypes
      .map((stat) => {
        const valueForStat = (pet) => (stat.id === 0 ? petAttackPlusBonus(pet, petLevel) : petStatAtLevel(pet, stat.id, petLevel));
        const best = pets
          .slice()
          .sort((a, b) => valueForStat(b) - valueForStat(a))[0];
        const value = best ? valueForStat(best) : 0;
        return { stat: stat.id === 0 ? { ...stat, name: "Attack Damage + passive" } : stat, best, value };
      })
      .filter((row) => row.value > 0);

    els.overviewTopPets.innerHTML = `
      <table class="mini-table">
        <thead><tr><th>Stat</th><th>Pet</th><th class="num">Value</th></tr></thead>
        <tbody>
          ${topPetRows
            .map(
              (row) => `<tr><td>${escapeHtml(row.stat.name)}</td><td>${escapeHtml(petName(row.best))}</td><td class="num">${formatNumber(row.value)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    const topSkills = skills
      .slice()
      .sort((a, b) => skillDps(b, skillLevel) - skillDps(a, skillLevel))
      .slice(0, 10);
    els.overviewTopSkills.innerHTML = `
      <table class="mini-table">
        <thead><tr><th>Skill</th><th>Rarity</th><th class="num">Base + bonus</th><th class="num">DPS</th><th class="num">Cooldown</th></tr></thead>
        <tbody>
          ${topSkills
            .map(
              (skill) =>
                `<tr><td>${escapeHtml(skillName(skill))}</td><td>${rarityBadge(skill.rarity)}</td><td class="num">${formatNumber(
                  knownSkillAttack(skill, skillLevel)
                )}</td><td class="num">${formatNumber(skillDps(skill, skillLevel))}</td><td class="num">${formatNumber(Number(skill.startedCooldown || 0))}s</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function petColumns(level) {
    const baseColumns = [
      { key: "petNum", label: "#", value: (pet) => Number(pet.petNum), render: (pet) => String(pet.petNum), className: "num" },
      {
        key: "name",
        label: "Pet",
        value: (pet) => petName(pet),
        render: (pet) => renderNameCell(petName(pet), pet.gameObjectName || "")
      },
      {
        key: "icon",
        label: "Icon",
        value: (pet) => iconName(iconRecord("pet", pet.petNum)),
        render: (pet) => renderIconCell(iconRecord("pet", pet.petNum))
      },
      { key: "rarity", label: "Rarity", value: (pet) => Number(pet.rarity), render: (pet) => rarityBadge(pet.rarity) },
      {
        key: "passiveBonus",
        label: "Passive bonus",
        value: (pet) => petBonusDamage(pet, level),
        render: (pet) => formatNumber(petBonusDamage(pet, level)),
        className: "num"
      },
      {
        key: "attackPlusBonus",
        label: "Atk + bonus",
        value: (pet) => petAttackPlusBonus(pet, level),
        render: (pet) => formatNumber(petAttackPlusBonus(pet, level)),
        className: "num"
      },
      {
        key: "stats",
        label: "Stats at level",
        value: (pet) => (pet.stats || []).length,
        render: (pet) => `<div class="chip-row">${statChipsForPet(pet, level)}</div>`
      }
    ];
    const statColumns = statTypes.map((stat) => ({
      key: `stat-${stat.id}`,
      label: stat.short,
      value: (pet) => petStatAtLevel(pet, stat.id, level),
      render: (pet) => {
        const value = petStatAtLevel(pet, stat.id, level);
        return value ? formatNumber(value) : "";
      },
      className: "num"
    }));
    return baseColumns.concat(statColumns);
  }

  function skillColumns(level) {
    return [
      { key: "skillNum", label: "#", value: (skill) => Number(skill.skillNum), render: (skill) => String(skill.skillNum), className: "num" },
      {
        key: "name",
        label: "Skill",
        value: (skill) => skillName(skill),
        render: (skill) => renderNameCell(skillName(skill), skill.gameObjectName || "")
      },
      {
        key: "icon",
        label: "Icon",
        value: (skill) => iconName(iconRecord("skill", skill.skillNum)),
        render: (skill) => renderIconCell(iconRecord("skill", skill.skillNum))
      },
      { key: "rarity", label: "Rarity", value: (skill) => Number(skill.rarity), render: (skill) => rarityBadge(skill.rarity) },
      { key: "baseAttack", label: "Base", value: (skill) => Number(skill.baseAttack || 0), render: (skill) => formatNumber(Number(skill.baseAttack || 0)), className: "num" },
      { key: "bonus", label: "Bonus", value: (skill) => skillBonusDamage(skill, level), render: (skill) => formatNumber(skillBonusDamage(skill, level)), className: "num" },
      { key: "knownAttack", label: "Base + bonus", value: (skill) => knownSkillAttack(skill, level), render: (skill) => formatNumber(knownSkillAttack(skill, level)), className: "num" },
      { key: "chain", label: "Simple chain", value: (skill) => simpleSkillChain(skill, level), render: (skill) => formatNumber(simpleSkillChain(skill, level)), className: "num" },
      { key: "dps", label: "DPS", value: (skill) => skillDps(skill, level), render: (skill) => formatNumber(skillDps(skill, level)), className: "num" },
      {
        key: "baseMultipleCount",
        label: "Multi",
        value: (skill) => Number(skill.baseMultipleCount || 0),
        render: (skill) => formatNumber(Number(skill.baseMultipleCount || 0)),
        className: "num"
      },
      {
        key: "baseBounceCount",
        label: "Bounce",
        value: (skill) => Number(skill.baseBounceCount || 0),
        render: (skill) => formatNumber(Number(skill.baseBounceCount || 0)),
        className: "num"
      },
      {
        key: "startedCooldown",
        label: "Cooldown",
        value: (skill) => Number(skill.startedCooldown || 0),
        render: (skill) => `${formatNumber(Number(skill.startedCooldown || 0))}s`,
        className: "num"
      },
      {
        key: "nextExp",
        label: "Next EXP",
        value: (skill) => (level >= Number(skill.maxLevel || 100) ? Number.POSITIVE_INFINITY : skillRequiredExp(level)),
        render: (skill) => nextExpLabel(skill, level, skillRequiredExp),
        className: "num"
      },
      { key: "targetNedir", label: "Target", value: (skill) => Number(skill.targetNedir || 0), render: renderTargetCell }
    ];
  }

  function wingColumns() {
    return [
      { key: "wingNum", label: "#", value: (wing) => Number(wing.wingNum), render: (wing) => String(wing.wingNum), className: "num" },
      {
        key: "name",
        label: "Wing",
        value: (wing) => wingName(wing),
        render: (wing) => renderNameCell(wingName(wing), wing.gameObjectName || "")
      },
      {
        key: "icon",
        label: "Icon",
        value: (wing) => iconName(iconRecord("wing", wing.wingNum)),
        render: (wing) => renderIconCell(iconRecord("wing", wing.wingNum))
      },
      {
        key: "rarityTier",
        label: "Rarity/tier",
        value: () => "Generated",
        render: () => renderNameCell("Generated", "Owned WingInstance field, not template data")
      },
      {
        key: "sourcePathId",
        label: "Source",
        value: (wing) => Number(wing.sourcePathId || 0),
        render: (wing) => String(wing.sourcePathId || ""),
        className: "num"
      }
    ];
  }

  function mountColumns() {
    return [
      { key: "mountNum", label: "#", value: (mount) => Number(mount.mountNum), render: (mount) => String(mount.mountNum), className: "num" },
      {
        key: "name",
        label: "Mount",
        value: (mount) => mountName(mount),
        render: (mount) => renderNameCell(mountName(mount), mount.gameObjectName || "")
      },
      {
        key: "icon",
        label: "Icon",
        value: (mount) => iconName(iconRecord("mount", mount.mountNum)),
        render: (mount) => renderIconCell(iconRecord("mount", mount.mountNum))
      },
      {
        key: "rarityTier",
        label: "Rarity/tier",
        value: () => "Generated",
        render: () => renderNameCell("Generated", "Owned MountInstance field, not template data")
      },
      {
        key: "objectPathId",
        label: "Object",
        value: (mount) => Number((mount.mountObject && mount.mountObject.pathId) || 0),
        render: (mount) => String((mount.mountObject && mount.mountObject.pathId) || ""),
        className: "num"
      },
      {
        key: "sourcePathId",
        label: "Source",
        value: (mount) => Number(mount.sourcePathId || 0),
        render: (mount) => String(mount.sourcePathId || ""),
        className: "num"
      }
    ];
  }

  function renderSortableHeader(columns, sortState) {
    return `<tr>${columns
      .map((column) => {
        const active = column.key === sortState.key;
        const mark = active ? (sortState.dir === "asc" ? "^" : "v") : "";
        return `<th${column.className === "num" ? ' class="num"' : ""}><button class="sort-button" type="button" data-sort="${escapeHtml(
          column.key
        )}"><span>${escapeHtml(column.label)}</span><span class="sort-mark">${escapeHtml(mark)}</span></button></th>`;
      })
      .join("")}</tr>`;
  }

  function sortRows(rows, columns, sortState) {
    const column = columns.find((candidate) => candidate.key === sortState.key) || columns[0];
    const dir = sortState.dir === "desc" ? -1 : 1;
    return rows.slice().sort((a, b) => compareValues(column.value(a), column.value(b)) * dir);
  }

  function filterPets() {
    const query = els.petSearch.value.trim().toLowerCase();
    const rarity = els.petRarityFilter.value;
    const statFilter = els.petStatFilter.value;
    return pets.filter((pet) => {
      if (rarity !== "all" && String(pet.rarity) !== rarity) return false;
      if (statFilter !== "all" && !getPetStat(pet, Number(statFilter))) return false;
      if (!query) return true;
      const haystack = [
        petName(pet),
        pet.gameObjectName,
        rarityLabel(pet.rarity),
        iconName(iconRecord("pet", pet.petNum)),
        ...(pet.stats || []).map((stat) => statLabel(stat.statType, false))
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  function filterSkills() {
    const query = els.skillSearch.value.trim().toLowerCase();
    const rarity = els.skillRarityFilter.value;
    return skills.filter((skill) => {
      if (rarity !== "all" && String(skill.rarity) !== rarity) return false;
      if (!query) return true;
      const haystack = [
        skillName(skill),
        skill.gameObjectName,
        rarityLabel(skill.rarity),
        iconName(iconRecord("skill", skill.skillNum)),
        `target ${skill.targetNedir}`,
        targetInfo(skill.targetNedir).label
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  function filterWings() {
    const query = els.wingSearch.value.trim().toLowerCase();
    return wings.filter((wing) => {
      if (!query) return true;
      const record = iconRecord("wing", wing.wingNum);
      const haystack = [
        wingName(wing),
        wing.gameObjectName,
        iconName(record),
        record && record.sprite && record.sprite.texture ? record.sprite.texture.name : ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  function filterMounts() {
    const query = els.mountSearch.value.trim().toLowerCase();
    return mounts.filter((mount) => {
      if (!query) return true;
      const record = iconRecord("mount", mount.mountNum);
      const haystack = [
        mountName(mount),
        mount.gameObjectName,
        iconName(record),
        record && record.sprite && record.sprite.texture ? record.sprite.texture.name : ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderPetsTable() {
    const level = clamp(els.petLevel.value, 0, 100);
    els.petLevelOut.value = String(level);
    const columns = petColumns(level);
    const filtered = filterPets();
    const rows = sortRows(filtered, columns, state.petSort);
    els.petTableMeta.textContent = `${filtered.length} of ${pets.length} pets at level ${level}`;
    els.petTableHead.innerHTML = renderSortableHeader(columns, state.petSort);
    els.petTableBody.innerHTML = rows
      .map(
        (pet) =>
          `<tr>${columns
            .map((column) => `<td${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.render(pet)}</td>`)
            .join("")}</tr>`
      )
      .join("");
  }

  function renderSkillsTable() {
    const level = clamp(els.skillLevel.value, 0, 100);
    els.skillLevelOut.value = String(level);
    const columns = skillColumns(level);
    const filtered = filterSkills();
    const rows = sortRows(filtered, columns, state.skillSort);
    els.skillTableMeta.textContent = `${filtered.length} of ${skills.length} skills at level ${level}`;
    els.skillTableHead.innerHTML = renderSortableHeader(columns, state.skillSort);
    els.skillTableBody.innerHTML = rows
      .map(
        (skill) =>
          `<tr>${columns
            .map((column) => `<td${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.render(skill)}</td>`)
            .join("")}</tr>`
      )
      .join("");
  }

  function renderWingsTable() {
    const columns = wingColumns();
    const filtered = filterWings();
    const rows = sortRows(filtered, columns, state.wingSort);
    els.wingTableMeta.textContent = `${filtered.length} of ${wings.length} wings`;
    els.wingTableHead.innerHTML = renderSortableHeader(columns, state.wingSort);
    els.wingTableBody.innerHTML = rows
      .map(
        (wing) =>
          `<tr>${columns
            .map((column) => `<td${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.render(wing)}</td>`)
            .join("")}</tr>`
      )
      .join("");
  }

  function renderMountsTable() {
    const columns = mountColumns();
    const filtered = filterMounts();
    const rows = sortRows(filtered, columns, state.mountSort);
    els.mountTableMeta.textContent = `${filtered.length} of ${mounts.length} mounts`;
    els.mountTableHead.innerHTML = renderSortableHeader(columns, state.mountSort);
    els.mountTableBody.innerHTML = rows
      .map(
        (mount) =>
          `<tr>${columns
            .map((column) => `<td${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.render(mount)}</td>`)
            .join("")}</tr>`
      )
      .join("");
  }

  function compactValue(value) {
    if (value == null || value === "") return "";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
      return Object.entries(value)
        .map(([key, amount]) => `${key}: ${formatNumber(Number(amount))}`)
        .join(", ");
    }
    return String(value);
  }

  function eventRows() {
    const rows = [];
    (events.managers || []).forEach((manager) => {
      rows.push({
        category: "Manager",
        id: manager.gameObjectName || "CrocodileManager",
        detail: "Info endpoint",
        value: manager.eventInfoEndpoint || "",
        sourcePathId: manager.sourcePathId || ""
      });
      rows.push({
        category: "Manager",
        id: manager.gameObjectName || "CrocodileManager",
        detail: "Summon endpoint",
        value: manager.eventSummonEndpoint || "",
        sourcePathId: manager.sourcePathId || ""
      });
      rows.push({
        category: "Manager",
        id: manager.gameObjectName || "CrocodileManager",
        detail: "Action endpoint",
        value: manager.eventActionEndpoint || "",
        sourcePathId: manager.sourcePathId || ""
      });
      if (Array.isArray(manager.rewardKeys) && manager.rewardKeys.length) {
        rows.push({
          category: "Manager",
          id: manager.gameObjectName || "CrocodileManager",
          detail: "Reward keys",
          value: manager.rewardKeys.join(", "),
          sourcePathId: manager.sourcePathId || ""
        });
      }
    });
    (events.missions || []).forEach((mission) => {
      rows.push({
        category: "Mission",
        id: mission.missionId || "",
        detail: mission.gameObjectName || "",
        value: `dynamicTarget ${mission.dynamicTarget || 0}`,
        sourcePathId: mission.sourcePathId || ""
      });
    });
    (events.exchanges || []).forEach((exchange) => {
      rows.push({
        category: "Exchange",
        id: exchange.exchangeId || "",
        detail: exchange.gameObjectName || "",
        value: "",
        sourcePathId: exchange.sourcePathId || ""
      });
    });
    (events.crafts || []).forEach((craft) => {
      rows.push({
        category: "Craft",
        id: craft.craftId || "",
        detail: craft.gameObjectName || "",
        value: `limit ${craft.dailyLimit || 0}, cost ${craft.craftCost || 0}`,
        sourcePathId: craft.sourcePathId || ""
      });
    });
    (events.milestones || []).forEach((milestone) => {
      rows.push({
        category: "Milestone",
        id: `Summon ${milestone.targetSummon || 0}`,
        detail: milestone.gameObjectName || "",
        value: "",
        sourcePathId: milestone.sourcePathId || ""
      });
    });
    return rows;
  }

  function baseRows() {
    return baseData.buildings || [];
  }

  function pvpRows() {
    const rows = [];
    (pvpRewards.tiers || []).forEach((tier) => {
      (tier.rewards || []).forEach((reward) => {
        rows.push({
          tier: tier.tier,
          leagueName: tier.leagueName || `Tier ${tier.tier}`,
          rankThreshold: reward.rankThreshold,
          rewards: reward.rewards || {}
        });
      });
    });
    return rows;
  }

  function renderStaticTable(metaEl, headEl, bodyEl, rows, columns, sortState, label, note) {
    if (!metaEl || !headEl || !bodyEl) return;
    const sorted = sortRows(rows, columns, sortState);
    metaEl.textContent = `${rows.length} ${label}${note ? ` - ${note}` : ""}`;
    headEl.innerHTML = renderSortableHeader(columns, sortState);
    bodyEl.innerHTML = sorted
      .map(
        (row) =>
          `<tr>${columns
            .map((column) => `<td${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.render(row)}</td>`)
            .join("")}</tr>`
      )
      .join("");
  }

  function renderEventTable() {
    const columns = [
      { key: "category", label: "Category", value: (row) => row.category, render: (row) => escapeHtml(row.category) },
      { key: "id", label: "ID", value: (row) => row.id, render: (row) => escapeHtml(row.id) },
      { key: "detail", label: "Detail", value: (row) => row.detail, render: (row) => escapeHtml(row.detail) },
      { key: "value", label: "Value", value: (row) => row.value, render: (row) => escapeHtml(row.value) },
      { key: "sourcePathId", label: "Source", value: (row) => Number(row.sourcePathId || 0), render: (row) => escapeHtml(row.sourcePathId), className: "num" }
    ];
    renderStaticTable(els.eventTableMeta, els.eventTableHead, els.eventTableBody, eventRows(), columns, state.eventSort, "event records", events.note || "");
  }

  function renderBaseTable() {
    const columns = [
      { key: "id", label: "ID", value: (row) => Number(row.id || 0), render: (row) => String(row.id || ""), className: "num" },
      { key: "name", label: "Building", value: (row) => row.name, render: (row) => renderNameCell(row.name || `Building ${row.id}`, row.description || "") },
      { key: "bonusPrefix", label: "Bonus", value: (row) => row.bonusPrefix, render: (row) => escapeHtml(row.bonusPrefix || "") },
      {
        key: "bonusPerLevel",
        label: "Per level",
        value: (row) => Number(row.bonusPerLevel || 0),
        render: (row) => formatNumber(Number(row.bonusPerLevel || 0)),
        className: "num"
      },
      { key: "costs", label: "Costs", value: (row) => compactValue(row.costs), render: (row) => escapeHtml(compactValue(row.costs)) },
      { key: "times", label: "Times", value: (row) => compactValue(row.times), render: (row) => escapeHtml(compactValue(row.times)) },
      {
        key: "labelSource",
        label: "Label source",
        value: (row) => row.labelSource || "",
        render: (row) => renderNameCell(row.labelSource || "", row.nameSlot || "")
      }
    ];
    renderStaticTable(els.baseTableMeta, els.baseTableHead, els.baseTableBody, baseRows(), columns, state.baseSort, "base records", baseData.note || "");
  }

  function renderPvpTable() {
    const columns = [
      { key: "tier", label: "Tier", value: (row) => Number(row.tier || 0), render: (row) => String(row.tier || ""), className: "num" },
      { key: "leagueName", label: "League", value: (row) => row.leagueName, render: (row) => escapeHtml(row.leagueName || "") },
      {
        key: "rankThreshold",
        label: "Rank <=",
        value: (row) => Number(row.rankThreshold || 0),
        render: (row) => formatNumber(Number(row.rankThreshold || 0)),
        className: "num"
      },
      { key: "rewards", label: "Rewards", value: (row) => compactValue(row.rewards), render: (row) => escapeHtml(compactValue(row.rewards)) }
    ];
    renderStaticTable(els.pvpTableMeta, els.pvpTableHead, els.pvpTableBody, pvpRows(), columns, state.pvpSort, "PvP reward rows", pvpRewards.note || "");
  }

  function initializeSkillBuild() {
    skills.forEach((skill) => state.skillBuildLevels.set(skill.skillNum, defaultLevel));
    skills
      .slice()
      .sort((a, b) => skillDps(b, defaultLevel) - skillDps(a, defaultLevel))
      .slice(0, 5)
      .forEach((skill) => state.selectedSkills.add(skill.skillNum));
  }

  function aggregateSkillStats() {
    let baseAttack = 0;
    let bonusDamage = 0;
    let attack = 0;
    let chain = 0;
    let dps = 0;
    let cooldown = 0;
    let cooldownCount = 0;
    let totalExp = 0;
    skills.forEach((skill) => {
      if (!state.selectedSkills.has(skill.skillNum)) return;
      const level = state.skillBuildLevels.get(skill.skillNum) || 0;
      baseAttack += Number(skill.baseAttack || 0);
      bonusDamage += skillBonusDamage(skill, level);
      attack += knownSkillAttack(skill, level);
      chain += simpleSkillChain(skill, level);
      dps += skillDps(skill, level);
      totalExp += totalExpToLevel(level, skillRequiredExp);
      if (Number(skill.startedCooldown || 0) > 0) {
        cooldown += Number(skill.startedCooldown || 0);
        cooldownCount += 1;
      }
    });
    return {
      baseAttack,
      bonusDamage,
      attack,
      chain,
      dps,
      totalExp,
      averageCooldown: cooldownCount ? cooldown / cooldownCount : 0
    };
  }

  function renderSkillBuildTotals() {
    const aggregate = aggregateSkillStats();
    const selectedCount = state.selectedSkills.size;
    els.skillBuildMeta.textContent = `${selectedCount} selected`;
    els.skillBuildTotals.innerHTML = [
      `<div class="stat-total"><div class="label">Base attack</div><div class="value">${formatNumber(
        aggregate.baseAttack
      )}</div><div class="sub">${selectedCount ? "Selected skills" : "No skills selected"}</div></div>`,
      `<div class="stat-total"><div class="label">Bonus damage</div><div class="value">${formatNumber(
        aggregate.bonusDamage
      )}</div><div class="sub">${selectedCount ? "Selected skills" : "No skills selected"}</div></div>`,
      `<div class="stat-total"><div class="label">Base + bonus</div><div class="value">${formatNumber(
        aggregate.attack
      )}</div><div class="sub">${selectedCount ? "Selected skills" : "No skills selected"}</div></div>`,
      `<div class="stat-total"><div class="label">Simple chain</div><div class="value">${formatNumber(
        aggregate.chain
      )}</div><div class="sub">Base + bonus x multi x bounce</div></div>`,
      `<div class="stat-total"><div class="label">Total DPS</div><div class="value">${formatNumber(
        aggregate.dps
      )}</div><div class="sub">Sum of selected skill DPS</div></div>`,
      `<div class="stat-total"><div class="label">Avg cooldown</div><div class="value">${formatNumber(
        aggregate.averageCooldown
      )}s</div><div class="sub">${selectedCount ? "Selected skills" : "No skills selected"}</div></div>`,
      `<div class="stat-total"><div class="label">Total EXP</div><div class="value">${formatNumber(
        aggregate.totalExp
      )}</div><div class="sub">Level 0 to selected levels</div></div>`
    ].join("");
  }

  function renderSkillBuildTable() {
    els.skillBuildBody.innerHTML = skills
      .map((skill) => {
        const checked = state.selectedSkills.has(skill.skillNum) ? " checked" : "";
        const level = state.skillBuildLevels.get(skill.skillNum) ?? 0;
        return `<tr>
          <td class="check-cell"><input type="checkbox" data-skill-check="${skill.skillNum}"${checked}></td>
          <td>${renderIconCell(iconRecord("skill", skill.skillNum))}</td>
          <td>${renderNameCell(skillName(skill), skill.gameObjectName || "")}</td>
          <td>${rarityBadge(skill.rarity)}</td>
          <td>
            <label class="pet-level-control">
              <input type="range" min="0" max="${Number(skill.maxLevel || 100)}" value="${level}" data-skill-level="${skill.skillNum}">
              <output>${level}</output>
            </label>
          </td>
          <td data-skill-stats-cell="${skill.skillNum}"><div class="chip-row">${statChipsForSkill(skill, level)}</div></td>
        </tr>`;
      })
      .join("");
    renderSkillBuildTotals();
  }

  function setSelectedSkills(skillNums) {
    state.selectedSkills = new Set(skillNums);
    renderSkillBuildTable();
  }

  function selectTopSkillsByMetric(metric, count) {
    const level = clamp(els.skillBuildLevel.value, 0, 100);
    const valueAtLevel = (skill) => (metric === "attack" ? knownSkillAttack(skill, level) : skillDps(skill, level));
    const selected = skills
      .slice()
      .sort((a, b) => valueAtLevel(b) - valueAtLevel(a))
      .filter((skill) => valueAtLevel(skill) > 0)
      .slice(0, count)
      .map((skill) => skill.skillNum);
    setSelectedSkills(selected);
  }

  function initializePetBuild() {
    pets.forEach((pet) => state.petBuildLevels.set(pet.petNum, defaultLevel));
    pets
      .slice()
      .sort((a, b) => petAttackPlusBonus(b, defaultLevel) - petAttackPlusBonus(a, defaultLevel))
      .slice(0, 3)
      .forEach((pet) => state.selectedPets.add(pet.petNum));
  }

  function aggregatePetStats() {
    const totals = new Map(statTypes.map((stat) => [stat.id, 0]));
    let passiveBonus = 0;
    let rawAttack = 0;
    pets.forEach((pet) => {
      if (!state.selectedPets.has(pet.petNum)) return;
      const level = state.petBuildLevels.get(pet.petNum) || 0;
      passiveBonus += petBonusDamage(pet, level);
      (pet.stats || []).forEach((stat) => {
        const value = petStatValue(stat.baseValue, stat.statType, level);
        if (Number(stat.statType) === 0) rawAttack += value;
        totals.set(stat.statType, (totals.get(stat.statType) || 0) + value);
      });
    });
    return { totals, passiveBonus, attackPlusBonus: rawAttack + passiveBonus };
  }

  function renderPetBuildTotals() {
    const aggregate = aggregatePetStats();
    const totals = aggregate.totals;
    const selectedCount = state.selectedPets.size;
    els.petBuildMeta.textContent = `${selectedCount} selected`;
    const bonusTotals = [
      `<div class="stat-total"><div class="label">Passive bonus</div><div class="value">${formatNumber(
        aggregate.passiveBonus
      )}</div><div class="sub">${selectedCount ? "Selected pets" : "No pets selected"}</div></div>`,
      `<div class="stat-total"><div class="label">Attack + bonus</div><div class="value">${formatNumber(
        aggregate.attackPlusBonus
      )}</div><div class="sub">${selectedCount ? "Selected pets" : "No pets selected"}</div></div>`
    ];
    els.petBuildTotals.innerHTML = bonusTotals.concat(statTypes
      .map((stat) => {
        const value = totals.get(stat.id) || 0;
        return `<div class="stat-total"><div class="label">${escapeHtml(stat.name)}</div><div class="value">${formatNumber(value)}</div><div class="sub">${
          selectedCount ? "Selected pets" : "No pets selected"
        }</div></div>`;
      })
    ).join("");
  }

  function renderPetBuildTable() {
    els.petBuildBody.innerHTML = pets
      .map((pet) => {
        const checked = state.selectedPets.has(pet.petNum) ? " checked" : "";
        const level = state.petBuildLevels.get(pet.petNum) ?? 0;
        return `<tr>
          <td class="check-cell"><input type="checkbox" data-pet-check="${pet.petNum}"${checked}></td>
          <td>${renderIconCell(iconRecord("pet", pet.petNum))}</td>
          <td>${renderNameCell(petName(pet), pet.gameObjectName || "")}</td>
          <td>${rarityBadge(pet.rarity)}</td>
          <td>
            <label class="pet-level-control">
              <input type="range" min="0" max="${Number(pet.maxLevel || 100)}" value="${level}" data-pet-level="${pet.petNum}">
              <output>${level}</output>
            </label>
          </td>
          <td data-pet-stats-cell="${pet.petNum}"><div class="chip-row">${statChipsForPet(pet, level)}</div></td>
        </tr>`;
      })
      .join("");
    renderPetBuildTotals();
  }

  function setSelectedPets(petNums) {
    state.selectedPets = new Set(petNums);
    renderPetBuildTable();
  }

  function selectTopPetsByStat(statType, count) {
    const level = clamp(els.petBuildLevel.value, 0, 100);
    const valueAtLevel = (pet) => (Number(statType) === 0 ? petAttackPlusBonus(pet, level) : petStatAtLevel(pet, statType, level));
    const selected = pets
      .slice()
      .sort((a, b) => valueAtLevel(b) - valueAtLevel(a))
      .filter((pet) => valueAtLevel(pet) > 0)
      .slice(0, count)
      .map((pet) => pet.petNum);
    setSelectedPets(selected);
  }

  function setActiveView(view) {
    state.activeView = view;
    els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
    els.views.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setActiveView(tab.dataset.view));
    });

    document.addEventListener("pointerover", (event) => {
      const cell = event.target.closest(".icon-only[data-icon-category]");
      if (cell) showIconZoom(cell);
    });
    document.addEventListener("pointerout", (event) => {
      const cell = event.target.closest(".icon-only[data-icon-category]");
      if (cell && (!event.relatedTarget || !cell.contains(event.relatedTarget))) hideIconZoom();
    });
    window.addEventListener("scroll", hideIconZoom, true);
    window.addEventListener("resize", hideIconZoom);

    [els.overviewPetLevel, els.overviewSkillLevel].forEach((input) => input.addEventListener("input", renderOverview));

    [els.petSearch, els.petRarityFilter, els.petStatFilter, els.petLevel].forEach((input) => input.addEventListener("input", renderPetsTable));
    els.petTableHead.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      const key = button.dataset.sort;
      state.petSort = {
        key,
        dir: state.petSort.key === key && state.petSort.dir === "asc" ? "desc" : "asc"
      };
      renderPetsTable();
    });

    [els.skillSearch, els.skillRarityFilter, els.skillLevel].forEach((input) => input.addEventListener("input", renderSkillsTable));
    els.skillTableHead.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      const key = button.dataset.sort;
      state.skillSort = {
        key,
        dir: state.skillSort.key === key && state.skillSort.dir === "asc" ? "desc" : "asc"
      };
      renderSkillsTable();
    });

    els.wingSearch.addEventListener("input", renderWingsTable);
    els.wingTableHead.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      const key = button.dataset.sort;
      state.wingSort = {
        key,
        dir: state.wingSort.key === key && state.wingSort.dir === "asc" ? "desc" : "asc"
      };
      renderWingsTable();
    });

    els.mountSearch.addEventListener("input", renderMountsTable);
    els.mountTableHead.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      const key = button.dataset.sort;
      state.mountSort = {
        key,
        dir: state.mountSort.key === key && state.mountSort.dir === "asc" ? "desc" : "asc"
      };
      renderMountsTable();
    });

    [
      { head: els.eventTableHead, sortKey: "eventSort", render: renderEventTable },
      { head: els.baseTableHead, sortKey: "baseSort", render: renderBaseTable },
      { head: els.pvpTableHead, sortKey: "pvpSort", render: renderPvpTable }
    ].forEach((table) => {
      if (!table.head) return;
      table.head.addEventListener("click", (event) => {
        const button = event.target.closest("[data-sort]");
        if (!button) return;
        const key = button.dataset.sort;
        state[table.sortKey] = {
          key,
          dir: state[table.sortKey].key === key && state[table.sortKey].dir === "asc" ? "desc" : "asc"
        };
        table.render();
      });
    });

    els.skillBuildLevel.addEventListener("input", () => {
      const level = clamp(els.skillBuildLevel.value, 0, 100);
      els.skillBuildLevelOut.value = String(level);
      state.selectedSkills.forEach((skillNum) => state.skillBuildLevels.set(skillNum, level));
      renderSkillBuildTable();
    });

    els.selectAllSkills.addEventListener("click", () => setSelectedSkills(skills.map((skill) => skill.skillNum)));
    els.clearSkills.addEventListener("click", () => setSelectedSkills([]));
    els.topDpsSkills.addEventListener("click", () => selectTopSkillsByMetric("dps", 6));
    els.topAttackSkills.addEventListener("click", () => selectTopSkillsByMetric("attack", 5));

    els.skillBuildBody.addEventListener("input", (event) => {
      const levelInput = event.target.closest("[data-skill-level]");
      if (!levelInput) return;
      const skillNum = Number(levelInput.dataset.skillLevel);
      const level = clamp(levelInput.value, 0, 100);
      state.skillBuildLevels.set(skillNum, level);
      const output = levelInput.parentElement.querySelector("output");
      const skill = skills.find((item) => Number(item.skillNum) === skillNum);
      const statCell = els.skillBuildBody.querySelector(`[data-skill-stats-cell="${skillNum}"]`);
      if (output) {
        output.value = String(level);
        output.textContent = String(level);
      }
      if (statCell && skill) statCell.innerHTML = `<div class="chip-row">${statChipsForSkill(skill, level)}</div>`;
      renderSkillBuildTotals();
    });

    els.skillBuildBody.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-skill-check]");
      if (!checkbox) return;
      const skillNum = Number(checkbox.dataset.skillCheck);
      if (checkbox.checked) state.selectedSkills.add(skillNum);
      else state.selectedSkills.delete(skillNum);
      renderSkillBuildTotals();
    });

    els.petBuildLevel.addEventListener("input", () => {
      const level = clamp(els.petBuildLevel.value, 0, 100);
      els.petBuildLevelOut.value = String(level);
      state.selectedPets.forEach((petNum) => state.petBuildLevels.set(petNum, level));
      renderPetBuildTable();
    });

    els.selectAllPets.addEventListener("click", () => setSelectedPets(pets.map((pet) => pet.petNum)));
    els.clearPets.addEventListener("click", () => setSelectedPets([]));
    els.topAttackPets.addEventListener("click", () => selectTopPetsByStat(0, 5));
    els.topCooldownPets.addEventListener("click", () => selectTopPetsByStat(7, 5));

    els.petBuildBody.addEventListener("input", (event) => {
      const levelInput = event.target.closest("[data-pet-level]");
      if (!levelInput) return;
      const petNum = Number(levelInput.dataset.petLevel);
      const level = clamp(levelInput.value, 0, 100);
      state.petBuildLevels.set(petNum, level);
      const output = levelInput.parentElement.querySelector("output");
      const pet = pets.find((item) => Number(item.petNum) === petNum);
      const statCell = els.petBuildBody.querySelector(`[data-pet-stats-cell="${petNum}"]`);
      if (output) {
        output.value = String(level);
        output.textContent = String(level);
      }
      if (statCell && pet) statCell.innerHTML = `<div class="chip-row">${statChipsForPet(pet, level)}</div>`;
      renderPetBuildTotals();
    });

    els.petBuildBody.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-pet-check]");
      if (!checkbox) return;
      const petNum = Number(checkbox.dataset.petCheck);
      if (checkbox.checked) state.selectedPets.add(petNum);
      else state.selectedPets.delete(petNum);
      renderPetBuildTotals();
    });
  }

  function init() {
    els.datasetStats.textContent = `${pets.length} pets, ${skills.length} skills, ${wings.length} wings, ${mounts.length} mounts, recovered level scaling`;
    setupFilters();
    initializeSkillBuild();
    initializePetBuild();
    bindEvents();
    renderOverview();
    renderPetsTable();
    renderSkillsTable();
    renderWingsTable();
    renderMountsTable();
    renderEventTable();
    renderBaseTable();
    renderPvpTable();
    renderSkillBuildTable();
    renderPetBuildTable();
  }

  init();
})();
