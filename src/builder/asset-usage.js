function developerAssetAssignOptions(type){if(type==="mobSprite")return Object.entries(BALANCE.mobs||{}).map(([id,rec])=>[id,rec?.name||id]);if(type==="npcSprite")return sceneryNPCs.map(npc=>[npc.id,npc.name||npc.id]);if(type==="itemIcon")return Object.entries(ITEM_DEFS).map(([id,rec])=>[id,rec?.name||id]);return [];}

function assignDeveloperAsset(asset,targetId){
  if(!asset||!targetId)return;const assetId=devAssetSelectedId;
  if(asset.type==="mobSprite"&&BALANCE.mobs?.[targetId]){BALANCE.mobs[targetId].spriteAsset=assetId;refreshMobTemplatesFromBalance?.();syncDeveloperSpawnRuntime?.();devContentType="mobs";devContentSelectedId=targetId;}
  else if(asset.type==="npcSprite"){const npc=sceneryNPCs.find(n=>n.id===targetId);if(!npc||!developerApplyNpcSpriteAsset(npc,assetId))return;devSelectedNpc=npc;setDeveloperTab("npcs");}
  else if(asset.type==="itemIcon"&&ITEM_DEFS[targetId]){ITEM_DEFS[targetId].icon=asset.path;devContentType="items";devContentSelectedId=targetId;refreshInventoryViews?.();}else return;
  saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`${asset.name||asset.path} assigned to ${targetId}`);
}

function developerAssetReferences(assetId){
  const refs=[];if(devCharacterDefaults?.defaultAppearanceAsset===assetId)refs.push("default playable character");for(const [id,mob] of Object.entries(BALANCE.mobs||{}))if(mob?.spriteAsset===assetId)refs.push(`mob ${id}`);for(const npc of sceneryNPCs)if(developerNpcAssetId(npc)===assetId)refs.push(`NPC ${npc.id}`);for(const [id,t] of Object.entries(devObjectDefinitions||{}))if(t?.sourceAssetId===assetId)refs.push(`object ${id}`);for(const [id,t] of Object.entries(devTerrains||{})){if(t?.textureAsset===assetId)refs.push(`terrain ${id}`);if(t?.decoration?.treeAsset===assetId)refs.push(`terrain trees ${id}`);}for(const [role,id] of Object.entries(devArtReferences||{}))if(id===assetId)refs.push(`${DEV_ART_REFERENCE_ROLES?.[role]?.label||role} reference`);return refs;
}

function removeDeveloperAssetRecord(){const asset=devAssets[devAssetSelectedId];if(!asset)return;const refs=developerAssetReferences(devAssetSelectedId);if(refs.length){devSetStatus(`Asset is still used by ${refs.join(", ")}`);return;}if(!confirm(`Remove '${asset.name||devAssetSelectedId}' from the Asset Library? The image file will stay in the project.`))return;delete devAssets[devAssetSelectedId];devAssetSelectedId=null;saveDeveloperDraft();refreshDeveloperPanel();}

function copyDeveloperAssetPath(){const asset=devAssets[devAssetSelectedId];if(!asset)return;navigator.clipboard?.writeText(asset.path).then(()=>devSetStatus(`Copied ${asset.path}`)).catch(()=>devSetStatus(asset.path));}
