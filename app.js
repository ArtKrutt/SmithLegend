(function () {
  "use strict";

  const source = window.SMITH_LEGEND_DATA || { pets: [], skills: [] };
  const pets = Array.isArray(source.pets) ? source.pets : [];
  const skills = Array.isArray(source.skills) ? source.skills : [];

  const rarityNames = ["Common", "Rare", "Epic", "Legendary", "Mystic"];
  const rarityClass = ["common", "rare", "epic", "legendary", "mystic"];
  const rarityMultiplier = [1, 2, 5, 10, 15];
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
    skillSort: { key: "knownAttack", dir: "desc" },
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
    skillCalcSelect: document.getElementById("skillCalcSelect"),
    skillCalcLevel: document.getElementById("skillCalcLevel"),
    skillCalcLevelOut: document.getElementById("skillCalcLevelOut"),
    skillCalcLevelNumber: document.getElementById("skillCalcLevelNumber"),
    skillCalcMetrics: document.getElementById("skillCalcMetrics"),
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

  function knownSkillAttack(skill, level) {
    return Number(skill.baseAttack || 0) + skillBonusDamage(skill, level);
  }

  function simpleSkillChain(skill, level) {
    const multi = Math.max(1, Number(skill.baseMultipleCount || 0));
    const bounce = Math.max(1, Number(skill.baseBounceCount || 0));
    return knownSkillAttack(skill, level) * multi * bounce;
  }

  function nextExpLabel(item, level, requiredExpFn) {
    const maxLevel = Number(item.maxLevel || 100);
    if (level >= maxLevel) return "max";
    return formatNumber(requiredExpFn(level));
  }

  function statChipsForPet(pet, level) {
    return (pet.stats || [])
      .map((stat) => {
        const name = statLabel(stat.statType, true);
        const current = petStatValue(stat.baseValue, stat.statType, level);
        return `<span class="stat-chip"><span>${escapeHtml(name)}</span><strong>${formatNumber(current)}</strong></span>`;
      })
      .join("");
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
    setOptions(
      els.skillCalcSelect,
      skills.map((skill) => ({ value: String(skill.skillNum), label: `${skill.skillNum}. ${skillName(skill)} (${rarityLabel(skill.rarity)})` })),
      skills[0] ? String(skills[0].skillNum) : ""
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
      .sort((a, b) => petStatAtLevel(b, 0, petLevel) - petStatAtLevel(a, 0, petLevel))[0];
    const bestCooldownPet = pets
      .slice()
      .sort((a, b) => petStatAtLevel(b, 7, petLevel) - petStatAtLevel(a, 7, petLevel))[0];
    const bestSkill = skills
      .slice()
      .sort((a, b) => knownSkillAttack(b, skillLevel) - knownSkillAttack(a, skillLevel))[0];
    const fastestSkill = skills
      .slice()
      .sort((a, b) => Number(a.startedCooldown || 0) - Number(b.startedCooldown || 0))[0];

    els.overviewSummary.innerHTML = [
      renderMetric("Pets", String(pets.length), `Next EXP at L${petLevel}: ${petLevel >= 100 ? "max" : formatNumber(petRequiredExp(petLevel))}`),
      renderMetric("Skills", String(skills.length), `Next EXP at L${skillLevel}: ${skillLevel >= 100 ? "max" : formatNumber(skillRequiredExp(skillLevel))}`),
      bestAttackPet
        ? renderMetric("Best pet attack", formatNumber(petStatAtLevel(bestAttackPet, 0, petLevel)), petName(bestAttackPet))
        : "",
      bestCooldownPet && petStatAtLevel(bestCooldownPet, 7, petLevel) > 0
        ? renderMetric("Best pet cooldown", formatNumber(petStatAtLevel(bestCooldownPet, 7, petLevel)), petName(bestCooldownPet))
        : renderMetric("Best pet cooldown", "0", "No cooldown pet selected by stat"),
      bestSkill ? renderMetric("Highest skill base + bonus", formatNumber(knownSkillAttack(bestSkill, skillLevel)), skillName(bestSkill)) : "",
      fastestSkill ? renderMetric("Fastest skill cooldown", `${formatNumber(Number(fastestSkill.startedCooldown || 0))}s`, skillName(fastestSkill)) : ""
    ].join("");

    const topPetRows = statTypes
      .map((stat) => {
        const best = pets
          .slice()
          .sort((a, b) => petStatAtLevel(b, stat.id, petLevel) - petStatAtLevel(a, stat.id, petLevel))[0];
        const value = best ? petStatAtLevel(best, stat.id, petLevel) : 0;
        return { stat, best, value };
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
      .sort((a, b) => knownSkillAttack(b, skillLevel) - knownSkillAttack(a, skillLevel))
      .slice(0, 10);
    els.overviewTopSkills.innerHTML = `
      <table class="mini-table">
        <thead><tr><th>Skill</th><th>Rarity</th><th class="num">Base + bonus</th><th class="num">Cooldown</th></tr></thead>
        <tbody>
          ${topSkills
            .map(
              (skill) =>
                `<tr><td>${escapeHtml(skillName(skill))}</td><td>${rarityBadge(skill.rarity)}</td><td class="num">${formatNumber(
                  knownSkillAttack(skill, skillLevel)
                )}</td><td class="num">${formatNumber(Number(skill.startedCooldown || 0))}s</td></tr>`
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
      { key: "rarity", label: "Rarity", value: (pet) => Number(pet.rarity), render: (pet) => rarityBadge(pet.rarity) },
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
      { key: "rarity", label: "Rarity", value: (skill) => Number(skill.rarity), render: (skill) => rarityBadge(skill.rarity) },
      { key: "baseAttack", label: "Base", value: (skill) => Number(skill.baseAttack || 0), render: (skill) => formatNumber(Number(skill.baseAttack || 0)), className: "num" },
      { key: "bonus", label: "Bonus", value: (skill) => skillBonusDamage(skill, level), render: (skill) => formatNumber(skillBonusDamage(skill, level)), className: "num" },
      { key: "knownAttack", label: "Base + bonus", value: (skill) => knownSkillAttack(skill, level), render: (skill) => formatNumber(knownSkillAttack(skill, level)), className: "num" },
      { key: "chain", label: "Simple chain", value: (skill) => simpleSkillChain(skill, level), render: (skill) => formatNumber(simpleSkillChain(skill, level)), className: "num" },
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
      { key: "targetNedir", label: "Target", value: (skill) => Number(skill.targetNedir || 0), render: (skill) => `Target ${skill.targetNedir}`, className: "num" }
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
      const haystack = [skillName(skill), skill.gameObjectName, rarityLabel(skill.rarity), `target ${skill.targetNedir}`]
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

  function renderSkillCalculator() {
    const skill = skills.find((item) => String(item.skillNum) === String(els.skillCalcSelect.value)) || skills[0];
    const level = clamp(els.skillCalcLevel.value, 0, Number(skill ? skill.maxLevel || 100 : 100));
    els.skillCalcLevel.value = String(level);
    els.skillCalcLevelNumber.value = String(level);
    els.skillCalcLevelOut.value = String(level);
    if (!skill) {
      els.skillCalcMetrics.innerHTML = "";
      return;
    }

    const bonus = skillBonusDamage(skill, level);
    const attack = knownSkillAttack(skill, level);
    const chain = simpleSkillChain(skill, level);
    const totalExp = totalExpToLevel(level, skillRequiredExp);
    els.skillCalcMetrics.innerHTML = [
      renderMetric("Skill", skillName(skill), rarityLabel(skill.rarity)),
      renderMetric("Base attack", formatNumber(Number(skill.baseAttack || 0)), `SkillNum ${skill.skillNum}`),
      renderMetric("Bonus damage", formatNumber(bonus), `${rarityLabel(skill.rarity)} x ${rarityMultiplier[skill.rarity] || 0}`),
      renderMetric("Base + bonus", formatNumber(attack), "Recovered scalar only"),
      renderMetric("Simple chain", formatNumber(chain), "Base + bonus x multi x bounce"),
      renderMetric("Cooldown", `${formatNumber(Number(skill.startedCooldown || 0))}s`, `Target ${skill.targetNedir}`),
      renderMetric("Multiple count", formatNumber(Number(skill.baseMultipleCount || 0)), "Extracted field"),
      renderMetric("Bounce count", formatNumber(Number(skill.baseBounceCount || 0)), "Extracted field"),
      renderMetric("Next EXP", nextExpLabel(skill, level, skillRequiredExp), level >= Number(skill.maxLevel || 100) ? "Max level" : `For level ${level}`),
      renderMetric("Total EXP", formatNumber(totalExp), `Level 0 to ${level}`)
    ].join("");
  }

  function initializePetBuild() {
    pets.forEach((pet) => state.petBuildLevels.set(pet.petNum, Number(pet.maxLevel || 100)));
    pets
      .slice()
      .sort((a, b) => petStatAtLevel(b, 0, 100) - petStatAtLevel(a, 0, 100))
      .slice(0, 3)
      .forEach((pet) => state.selectedPets.add(pet.petNum));
  }

  function aggregatePetStats() {
    const totals = new Map(statTypes.map((stat) => [stat.id, 0]));
    pets.forEach((pet) => {
      if (!state.selectedPets.has(pet.petNum)) return;
      const level = state.petBuildLevels.get(pet.petNum) || 0;
      (pet.stats || []).forEach((stat) => {
        totals.set(stat.statType, (totals.get(stat.statType) || 0) + petStatValue(stat.baseValue, stat.statType, level));
      });
    });
    return totals;
  }

  function renderPetBuildTotals() {
    const totals = aggregatePetStats();
    const selectedCount = state.selectedPets.size;
    els.petBuildMeta.textContent = `${selectedCount} selected`;
    els.petBuildTotals.innerHTML = statTypes
      .map((stat) => {
        const value = totals.get(stat.id) || 0;
        return `<div class="stat-total"><div class="label">${escapeHtml(stat.name)}</div><div class="value">${formatNumber(value)}</div><div class="sub">${
          selectedCount ? "Selected pets" : "No pets selected"
        }</div></div>`;
      })
      .join("");
  }

  function renderPetBuildTable() {
    els.petBuildBody.innerHTML = pets
      .map((pet) => {
        const checked = state.selectedPets.has(pet.petNum) ? " checked" : "";
        const level = state.petBuildLevels.get(pet.petNum) || 0;
        return `<tr>
          <td class="check-cell"><input type="checkbox" data-pet-check="${pet.petNum}"${checked}></td>
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
    const selected = pets
      .slice()
      .sort((a, b) => petStatAtLevel(b, statType, level) - petStatAtLevel(a, statType, level))
      .filter((pet) => petStatAtLevel(pet, statType, level) > 0)
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

    els.skillCalcSelect.addEventListener("change", renderSkillCalculator);
    els.skillCalcLevel.addEventListener("input", renderSkillCalculator);
    els.skillCalcLevelNumber.addEventListener("input", () => {
      els.skillCalcLevel.value = String(clamp(els.skillCalcLevelNumber.value, 0, 100));
      renderSkillCalculator();
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
    els.datasetStats.textContent = `${pets.length} pets, ${skills.length} skills, recovered level scaling`;
    setupFilters();
    initializePetBuild();
    bindEvents();
    renderOverview();
    renderPetsTable();
    renderSkillsTable();
    renderSkillCalculator();
    renderPetBuildTable();
  }

  init();
})();
