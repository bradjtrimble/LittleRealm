/* Integrated from Little Realm World Pack v56 */
window.LR_QUESTS = [
  {
    "id": "lilly_slime_samples",
    "title": "Lilly's Slime Samples",
    "description": "Bring Lilly three samples of Slime Gel from the nearby slime fields.",
    "giverNpc": "lilly",
    "turnInNpc": "lilly",
    "openingDialogue": "I'm trying to learn more about the slimes outside town. Could you bring me twenty samples of Slime Gel?",
    "completionDialogue": "Perfect! These samples are exactly what I needed. Thank you!",
    "objectives": [
      {
        "type": "collect",
        "target": "slimeGel",
        "amount": 20,
        "consumeOnTurnIn": true
      }
    ],
    "rewards": {
      "xp": 25,
      "gold": 8,
      "items": []
    },
    "prerequisite": "welcome_traveler",
    "nextQuest": null,
    "repeatable": false
  },
  {
    "id": "jorge_slime_problem",
    "title": "Jorge's Slime Problem",
    "description": "Thin out the slimes near Oakrest so the road stays safe.",
    "giverNpc": "jorge",
    "turnInNpc": "jorge",
    "openingDialogue": "Lilly says you've been helping around town. The slimes are getting too comfortable near the road. Defeat five of them for me.",
    "completionDialogue": "Nicely done. That should keep the road clear for a while.",
    "objectives": [
      {
        "type": "kill",
        "target": "slime",
        "amount": 5
      }
    ],
    "rewards": {
      "xp": 40,
      "gold": 12,
      "items": []
    },
    "prerequisite": "welcome_traveler",
    "nextQuest": null,
    "repeatable": false
  },
  {
    "id": "farmer_wolf_hunt",
    "title": "Wolf Hunt",
    "description": "These darn wolves keep attacking my animal. Think you could go out and give them a taste of their own medicine?",
    "giverNpc": "farmer",
    "turnInNpc": "farmer",
    "openingDialogue": "Could you help me and my animals?",
    "completionDialogue": "Thank you! Hopefully now these mangy muts will leave my animals alone!",
    "objectives": [
      {
        "type": "kill",
        "target": "wolf",
        "amount": 15
      }
    ],
    "rewards": {
      "xp": 30,
      "gold": 10,
      "items": []
    },
    "prerequisite": null,
    "nextQuest": null,
    "repeatable": false
  },
  {
    "id": "welcome_traveler",
    "title": "Welcome Traveler",
    "description": "Introduce yourself to the people of Little Realm",
    "giverNpc": "mayor_buck",
    "turnInNpc": "mayor_buck",
    "openingDialogue": "Welcome to Little Realm! We are pleased to have you. Please get to know the other folks around town, I'm sure they will be delighted to meet you!",
    "completionDialogue": "I'm glad you made some new friends! Enjoy your stay!",
    "objectives": [
      {
        "type": "talk",
        "target": "lilly",
        "amount": 1
      },
      {
        "type": "talk",
        "target": "jorge",
        "amount": 1
      },
      {
        "type": "talk",
        "target": "farmer",
        "amount": 1
      },
      {
        "type": "talk",
        "target": "rhea",
        "amount": 1
      },
      {
        "type": "talk",
        "target": "torren",
        "amount": 1
      }
    ],
    "rewards": {
      "xp": 25,
      "gold": 0,
      "items": []
    },
    "prerequisite": null,
    "nextQuest": null,
    "repeatable": false
  }
];
