/*
  Little Realm — quest definitions
  --------------------------------
  This file is intended to be authored through World Builder > Quests.

  Supported objective types:
    kill     target = mob kind, amount = count
    collect  target = item id, amount = count
    talk     target = NPC id, amount is normally 1
    deliver  target = item id, amount = count (consumed on turn-in by default)
    visit    x/y/radius = world position trigger
*/
window.LR_QUESTS = [
  {
    id: "lilly_slime_samples",
    title: "Lilly's Slime Samples",
    description: "Bring Lilly three samples of Slime Gel from the nearby slime fields.",
    giverNpc: "lilly",
    turnInNpc: "lilly",
    openingDialogue: "I'm trying to learn more about the slimes outside town. Could you bring me three samples of Slime Gel?",
    completionDialogue: "Perfect! These samples are exactly what I needed. Thank you!",
    objectives: [
      { type: "collect", target: "slimeGel", amount: 3, consumeOnTurnIn: true }
    ],
    rewards: { xp: 25, gold: 8, items: [] },
    prerequisite: null,
    nextQuest: "jorge_slime_problem",
    repeatable: false
  },
  {
    id: "jorge_slime_problem",
    title: "Jorge's Slime Problem",
    description: "Thin out the slimes near Oakrest so the road stays safe.",
    giverNpc: "jorge",
    turnInNpc: "jorge",
    openingDialogue: "Lilly says you've been helping around town. The slimes are getting too comfortable near the road. Defeat five of them for me.",
    completionDialogue: "Nicely done. That should keep the road clear for a while.",
    objectives: [
      { type: "kill", target: "slime", amount: 5 }
    ],
    rewards: { xp: 40, gold: 12, items: [] },
    prerequisite: "lilly_slime_samples",
    nextQuest: null,
    repeatable: false
  }
];
