/*
  Little Realm — quick balance tuning
  -----------------------------------
  Edit numbers in THIS file for routine balance changes, then commit/push only
  this file to GitHub. No build step is required.

  Percent values use normal percentages: 10 = 10%, 100 = guaranteed.
  Time values are seconds. Distances/speeds are world pixels.
*/
window.LR_BALANCE = {
  player: {
    maxHp: 30,
    attack: 5,
    defense: 1,
    startingGold: 0,
    startingPotions: 2,
    moveSpeed: 180,
    potionHeal: 14,
    potionCooldownSeconds: 0.85,
    deathGoldLossPercent: 25
  },

  inventory: {
    slots: 20,
    defaultStackLimit: 99
  },

  combat: {
    meleeRange: 30,
    engageRange: 72,
    disengageRange: 260,
    autoChaseRange: 82,
    attackButtonCooldownSeconds: 0.90,
    openingAttackDelaySeconds: 0.62,
    playerAttackIntervalSeconds: 1.15,
    playerCritChancePercent: 10,
    playerDamageBonusMin: 0,
    playerDamageBonusMax: 3,
    enemyDamageBonusMin: 0,
    enemyDamageBonusMax: 2,
    targetClickRadius: 34,
    keyboardTargetRange: 220
  },

  progression: {
    startingXpToLevel: 25,
    xpRequirementGrowthPercent: 35,
    hpPerLevel: 8,
    attackPerLevel: 2,
    defensePerLevel: 1
  },

  mobLevels: {
    // Species stats below are authored at each mob's baseLevel. Individual
    // spawns can vary between levelMin and levelMax like classic MMO zones.
    hpGrowthPerLevelPercent: 14,
    attackGrowthPerLevelPercent: 10,
    armorPerLevel: 0.55,
    xpGrowthPerLevelPercent: 18,

    // A mob starts receiving an extra danger bonus when it is MORE than three
    // levels above the player. Every additional level adds another stack.
    dangerStartsAbovePlayerLevels: 3,
    dangerHpPerExtraLevelPercent: 12,
    dangerAttackPerExtraLevelPercent: 9,
    dangerArmorPerExtraLevel: 0.6,
    dangerXpPerExtraLevelPercent: 10,

    // Bosses/elite mobs get these multipliers after normal level scaling.
    bossHpMultiplier: 1.50,
    bossAttackMultiplier: 1.25,
    bossArmorMultiplier: 1.25,
    bossXpMultiplier: 1.75,

    // WoW-like reward falloff for trivial enemies. Five or more levels below
    // the player awards no XP; each lower level before that reduces XP.
    noXpWhenBelowPlayerByLevels: 5,
    lowLevelXpPenaltyPerLevelPercent: 20,
    higherLevelXpBonusPerLevelPercent: 8
  },

  quest: {
    slimesRequired: 3
  },

  shop: {
    potionPrice: 5,
    autoBuyUntilPotions: 3
  },

  mobs: {
    slime: {
      baseLevel: 2, levelMin: 1, levelMax: 3,
      hp: 14,
      attack: 4,
      defense: 0,
      xp: 8,
      goldMin: 2,
      goldMax: 5,
      goldDropChancePercent: 100,
      potionDropChancePercent: 0,
      potionDropAmount: 1,
      attackIntervalSeconds: 1.45,
      respawnMinSeconds: 18,
      respawnMaxSeconds: 28,
      aggressive: false,
      aggroTriggerRange: 58,
      alertRange: 82,
      chaseSpeed: 45,
      wanderSpeed: 20,
      leashDistance: 120,
      leashSpeed: 34,
      wanderDelayMinSeconds: 1.2,
      wanderDelayMaxSeconds: 4.0
    },

    goblin: {
      baseLevel: 4, levelMin: 3, levelMax: 5,
      hp: 20,
      attack: 6,
      defense: 1,
      xp: 13,
      goldMin: 4,
      goldMax: 8,
      goldDropChancePercent: 100,
      potionDropChancePercent: 0,
      potionDropAmount: 1,
      attackIntervalSeconds: 1.45,
      respawnMinSeconds: 18,
      respawnMaxSeconds: 28,
      aggressive: true,
      aggroTriggerRange: 58,
      alertRange: 82,
      chaseSpeed: 58,
      wanderSpeed: 20,
      leashDistance: 120,
      leashSpeed: 34,
      wanderDelayMinSeconds: 1.2,
      wanderDelayMaxSeconds: 4.0
    },

    wolf: {
      baseLevel: 5, levelMin: 4, levelMax: 6,
      hp: 18,
      attack: 7,
      defense: 1,
      xp: 14,
      goldMin: 3,
      goldMax: 7,
      goldDropChancePercent: 100,
      potionDropChancePercent: 0,
      potionDropAmount: 1,
      attackIntervalSeconds: 1.33,
      respawnMinSeconds: 18,
      respawnMaxSeconds: 28,
      aggressive: true,
      aggroTriggerRange: 58,
      alertRange: 82,
      chaseSpeed: 72,
      wanderSpeed: 30,
      leashDistance: 120,
      leashSpeed: 34,
      wanderDelayMinSeconds: 1.2,
      wanderDelayMaxSeconds: 4.0
    },


    cow: {
      baseLevel: 2, levelMin: 1, levelMax: 2,
      hp: 12, attack: 1, defense: 0, xp: 4,
      goldMin: 0, goldMax: 0, goldDropChancePercent: 0,
      potionDropChancePercent: 0, potionDropAmount: 0,
      attackIntervalSeconds: 1.8, respawnMinSeconds: 20, respawnMaxSeconds: 30,
      aggressive: false, aggroTriggerRange: 0, alertRange: 0,
      chaseSpeed: 28, wanderSpeed: 12, leashDistance: 54, leashSpeed: 26,
      wanderDelayMinSeconds: 1.8, wanderDelayMaxSeconds: 4.5
    },

    pig: {
      baseLevel: 1, levelMin: 1, levelMax: 2,
      hp: 8, attack: 1, defense: 0, xp: 3,
      goldMin: 0, goldMax: 0, goldDropChancePercent: 0,
      potionDropChancePercent: 0, potionDropAmount: 0,
      attackIntervalSeconds: 1.8, respawnMinSeconds: 20, respawnMaxSeconds: 30,
      aggressive: false, aggroTriggerRange: 0, alertRange: 0,
      chaseSpeed: 30, wanderSpeed: 14, leashDistance: 48, leashSpeed: 26,
      wanderDelayMinSeconds: 1.5, wanderDelayMaxSeconds: 4.0
    },

    chicken: {
      baseLevel: 1, levelMin: 1, levelMax: 1,
      hp: 4, attack: 1, defense: 0, xp: 2,
      goldMin: 0, goldMax: 0, goldDropChancePercent: 0,
      potionDropChancePercent: 0, potionDropAmount: 0,
      attackIntervalSeconds: 1.7, respawnMinSeconds: 16, respawnMaxSeconds: 25,
      aggressive: false, aggroTriggerRange: 0, alertRange: 0,
      chaseSpeed: 34, wanderSpeed: 18, leashDistance: 46, leashSpeed: 28,
      wanderDelayMinSeconds: 1.0, wanderDelayMaxSeconds: 3.2
    },

    snickers: {
      baseLevel: 8, levelMin: 8, levelMax: 8,
      // These are pre-boss base stats. The boss multipliers above bring
      // Snickers to roughly the intended boss power for level 8.
      hp: 70,
      attack: 10,
      defense: 3,
      xp: 55,
      goldMin: 35,
      goldMax: 55,
      goldDropChancePercent: 100,
      potionDropChancePercent: 20,
      potionDropAmount: 2,
      attackIntervalSeconds: 1.55,
      respawnMinSeconds: 999999,
      respawnMaxSeconds: 999999,
      aggressive: true,
      aggroTriggerRange: 84,
      alertRange: 116,
      chaseSpeed: 52,
      wanderSpeed: 0,
      leashDistance: 120,
      leashSpeed: 34,
      wanderDelayMinSeconds: 1.2,
      wanderDelayMaxSeconds: 4.0
    }
  }
};
