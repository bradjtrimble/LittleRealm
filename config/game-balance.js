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
    startingGold: 8,
    startingPotions: 2,
    moveSpeed: 180,
    potionHeal: 14,
    potionCooldownSeconds: 0.85,
    deathGoldLossPercent: 25
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
    targetClickRadius: 34
  },

  progression: {
    startingXpToLevel: 25,
    xpRequirementGrowthPercent: 35,
    hpPerLevel: 8,
    attackPerLevel: 2,
    defensePerLevel: 1,
    mobHpPerPlayerLevel: 2,
    mobAttackPerPlayerLevel: 0.55
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

    stoneKing: {
      hp: 50,
      attack: 10,
      defense: 3,
      xp: 45,
      goldMin: 20,
      goldMax: 30,
      goldDropChancePercent: 100,
      potionDropChancePercent: 0,
      potionDropAmount: 1,
      attackIntervalSeconds: 1.63,
      respawnMinSeconds: 999999,
      respawnMaxSeconds: 999999,
      aggressive: false,
      aggroTriggerRange: 58,
      alertRange: 82,
      chaseSpeed: 48,
      wanderSpeed: 0,
      leashDistance: 120,
      leashSpeed: 34,
      wanderDelayMinSeconds: 1.2,
      wanderDelayMaxSeconds: 4.0
    }
  }
};
