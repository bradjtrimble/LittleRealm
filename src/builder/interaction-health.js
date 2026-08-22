function developerValidateZoneInteractions(zoneName,zoneId,pack,shared,issues,projectZoneIds){
  const tags=new Set();
  for(const obj of pack.worldObjects||[]){
    if(obj?.interaction?.enabled!==true)continue;
    const cfg=worldObjectInteraction(obj),where={tab:"selection",targetId:obj.id,zoneId},label=obj.label||obj.id;
    if(cfg.tag)tags.add(cfg.tag);if(obj.id)tags.add(obj.id);
    if(cfg.requirements.itemId&&!shared.items?.[cfg.requirements.itemId])developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' requires missing item '${cfg.requirements.itemId}'`,where);
    if(cfg.actions.giveItemId&&!shared.items?.[cfg.actions.giveItemId])developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' gives missing item '${cfg.actions.giveItemId}'`,where);
    if(cfg.actions.lootTable&&!shared.lootTables?.[cfg.actions.lootTable])developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' uses missing loot table '${cfg.actions.lootTable}'`,where);
    if(cfg.actions.targetZone&&projectZoneIds&&!projectZoneIds.has(cfg.actions.targetZone))developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' targets missing zone '${cfg.actions.targetZone}'`,where);
  }
  return tags;
}
function developerValidateInteractionQuestRequirements(zoneName,zoneId,pack,questIds,issues){
  for(const obj of pack.worldObjects||[]){
    const cfg=obj?.interaction?.enabled===true?worldObjectInteraction(obj):null;
    if(cfg?.requirements.questId&&!questIds.has(cfg.requirements.questId))developerHealthIssue(issues,"error",`${zoneName}: interaction '${obj.label||obj.id}' requires missing quest '${cfg.requirements.questId}'`,{tab:"selection",targetId:obj.id,zoneId});
    for(const questId of cfg?.actions?.questIds||[])if(!questIds.has(questId))developerHealthIssue(issues,"error",`${zoneName}: interaction '${obj.label||obj.id}' offers missing quest '${questId}'`,{tab:"selection",targetId:obj.id,zoneId});
  }
}
function developerValidateInteractObjective(zoneName,questId,objective,interactionTags,issues,where){
  if(objective?.type==="interact"&&!interactionTags.has(objective.target))developerHealthIssue(issues,"error",`${zoneName}: quest '${questId}' targets missing interaction tag/object '${objective.target}'`,where);
}
