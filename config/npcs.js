/*
  Little Realm — NPC catalog / placement
  --------------------------------------
  NPCs are world content. The World Builder can edit these records and export
  a replacement npcs.js or a single World Pack containing NPCs + quests + props.
*/
window.LR_NPCS = [
  {
    id: "lilly",
    name: "Lilly",
    role: "Villager",
    sprite: "./assets/npcs/lilly.png",
    x: 338,
    y: 332,
    facing: "down",
    solid: true,
    displayHeight: 58,
    greeting: "Hello! I could use a little help with something from the slime fields."
  },
  {
    id: "jorge",
    name: "Jorge",
    role: "Villager",
    sprite: "./assets/npcs/jorge.png",
    x: 532,
    y: 344,
    facing: "down",
    solid: true,
    displayHeight: 58,
    greeting: "Good to see you. The roads are safer when everyone lends a hand."
  },
  {
    id: "mara",
    name: "Mara",
    role: "Shopkeeper",
    sprite: "",
    x: 274,
    y: 460,
    facing: "down",
    solid: true,
    displayHeight: 44,
    shirt: "#b85c4a",
    greeting: "The shop is still being stocked, but you're welcome in town."
  },
  {
    id: "eldon",
    name: "Eldon",
    role: "Villager",
    sprite: "",
    x: 660,
    y: 472,
    facing: "left",
    solid: true,
    displayHeight: 44,
    shirt: "#4e79a7",
    greeting: "Oakrest is quiet today. I hope it stays that way."
  },
  {
    id: "rhea",
    name: "Rhea",
    role: "Villager",
    sprite: "",
    x: 324,
    y: 530,
    facing: "right",
    solid: true,
    displayHeight: 44,
    shirt: "#6e9c5e",
    greeting: "There's always something happening beyond the town road."
  },
  {
    id: "torren",
    name: "Torren",
    role: "Blacksmith",
    sprite: "",
    x: 656,
    y: 522,
    facing: "left",
    solid: true,
    displayHeight: 44,
    shirt: "#8a6651",
    greeting: "Come back when the forge is open and I'll show you what I can make."
  },
  {
    id: "farmer",
    name: "Farmer",
    role: "Farmer",
    sprite: "",
    x: 278,
    y: 1308,
    facing: "down",
    solid: true,
    displayHeight: 44,
    shirt: "#b28b43",
    greeting: "Mind the animals and watch your step around the trough."
  }
];
