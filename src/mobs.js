function mobAssetRecord(assetId){
  return (typeof window!=="undefined"&&window.LR_ASSETS&&window.LR_ASSETS[assetId])||null;
}
function mobSpritePathFromConfig(cfg={}){
  const asset=mobAssetRecord(String(cfg.spriteAsset||""));
  return String(asset?.path||"").trim();
}
function createMobTemplate(configKey,cfg={}){
  const baseline=standardMobBaselineStatsForLevel(cfg.baseLevel||1);
  return {
    name:String(cfg.name||configKey),kind:String(configKey),configKey,
    boss:!!cfg.boss,
    spriteAsset:String(cfg.spriteAsset||""),sprite:mobSpritePathFromConfig(cfg),
    spriteLayout:mobAssetRecord(String(cfg.spriteAsset||""))?.spriteLayout||{columns:4,rows:4,directionRows:{down:0,right:1,left:2,up:3},attackColumn:3,walkCycle:[0,1,2,1]},
    sizeClass:String(cfg.sizeClass||nearestMobSizeClass(cfg.displayHeight)).toLowerCase(),
    displayHeight:Math.max(8,numberOr(cfg.displayHeight,mobSizeClassHeight(cfg.sizeClass))),
    battleScale:Math.max(.05,numberOr(cfg.battleScale,.55)),
    lootTable:typeof cfg.lootTable==="string"?cfg.lootTable.trim():"",
    baseLevel:Math.max(1,Math.floor(numberOr(cfg.baseLevel,1))),
    levelMin:Math.max(1,Math.floor(numberOr(cfg.levelMin,cfg.baseLevel||1))),
    levelMax:Math.max(1,Math.floor(numberOr(cfg.levelMax,cfg.baseLevel||1))),
    hp:Math.max(1,numberOr(cfg.hp,baseline.hp)),atk:Math.max(0,numberOr(cfg.attack,baseline.attack)),def:Math.max(0,numberOr(cfg.defense,baseline.defense)),
    xpMultiplier:Math.max(0,numberOr(cfg.xpMultiplier,1)),xp:Math.max(1,numberOr(cfg.xp,baseline.xp)),
    gold:[Math.max(0,numberOr(cfg.goldMin,0)),Math.max(0,numberOr(cfg.goldMax,0))],
    goldDropChance:percentOr(cfg.goldDropChancePercent,0),potionDropChance:percentOr(cfg.potionDropChancePercent,0),potionDropAmount:Math.max(0,Math.floor(numberOr(cfg.potionDropAmount,1))),
    eliteChance:percentOr(cfg.eliteChancePercent,0),attackInterval:Math.max(.1,numberOr(cfg.attackIntervalSeconds,1.5)),
    respawnMin:Math.max(0,numberOr(cfg.respawnMinSeconds,18)),respawnMax:Math.max(0,numberOr(cfg.respawnMaxSeconds,28)),
    aggressive:!!cfg.aggressive,aggroTriggerRange:Math.max(0,numberOr(cfg.aggroTriggerRange,58)),alertRange:Math.max(0,numberOr(cfg.alertRange,82)),
    chaseSpeed:Math.max(0,numberOr(cfg.chaseSpeed,50)),wanderSpeed:Math.max(0,numberOr(cfg.wanderSpeed,20)),leashDistance:Math.max(0,numberOr(cfg.leashDistance,120)),
    combatLeashDistance:Math.max(0,numberOr(cfg.combatLeashDistance,numberOr(BALANCE.combat?.mobLeashDistance,260))),leashSpeed:Math.max(0,numberOr(cfg.leashSpeed,34)),
    wanderDelayMin:Math.max(0,numberOr(cfg.wanderDelayMinSeconds,1.2)),wanderDelayMax:Math.max(0,numberOr(cfg.wanderDelayMaxSeconds,4)),
    audio:{aggro:String(cfg.audio?.aggro||""),attack:String(cfg.audio?.attack||""),hit:String(cfg.audio?.hit||""),death:String(cfg.audio?.death||"")},audioRadius:Math.max(100,numberOr(cfg.audioRadius,430))
  };
}

const mobTemplates=[];
function allMobTemplates(){return mobTemplates;}
function syncMobTemplateCatalog(){mobTemplates.length=0;for(const [id,cfg] of Object.entries(BALANCE.mobs||{}))mobTemplates.push(createMobTemplate(id,cfg||{}));}
function refreshMobTemplatesFromBalance(){
  syncMobTemplateCatalog();
  const byId=new Map(allMobTemplates().map(t=>[t.configKey,t]));
  for(const mob of mobs){
    const t=byId.get(mob.spawnType||mob.template?.configKey);if(!t)continue;
    mob.template=t;mob.kind=t.configKey;mob.boss=!!t.boss;
    mob.level=mob.fixedLevel?Math.max(1,Math.floor(numberOr(mob.level,t.baseLevel))):Math.max(t.levelMin,Math.min(t.levelMax,Math.floor(numberOr(mob.level,t.baseLevel))));
    if(mob.alive)restoreMobStats(mob,false);
  }
}

syncMobTemplateCatalog();

function rerollMobLevelsAndElites(typeKey=null){
  refreshMobTemplatesFromBalance();
  for(const mob of mobs){
    const key=mob.template?.configKey||mob.spawnType||mob.kind;
    if(typeKey && key!==typeKey) continue;
    if(!mob.fixedLevel)mob.level=mobSpawnLevel(mob.template);
    mob.elite=rollMobElite(mob.template);
    restoreMobStats(mob,true);
    mob.aggro=false;
    mob.returningHome=false; mob.leashStuckTime=0;
  }
  updateCombatHud?.();
}

function mobSpawnLevel(template,tx=0,ty=0){
  const min=Math.min(template.levelMin,template.levelMax);
  const max=Math.max(template.levelMin,template.levelMax);
  if(min===max) return min;
  // Stable per spawn point: the same creature location keeps its level after
  // respawns instead of rerolling whenever the player walks back through.
  const hash=Math.abs(((tx+17)*73856093)^((ty+31)*19349663)^((template.kind.length+7)*83492791));
  return min+(hash%(max-min+1));
}

function mobDangerSteps(level){
  const threshold=Math.max(0,Math.floor(numberOr(BALANCE.mobLevels?.dangerStartsAbovePlayerLevels,3)));
  return Math.max(0,Math.floor(level-state.level-threshold));
}

function mobLevelColor(level,boss=false,elite=false){
  if(boss) return "#ff6b5f";
  if(elite) return "#c58cff";
  const delta=level-state.level;
  if(delta>=4) return "#ff5d55";
  if(delta>=2) return "#ffad4a";
  if(delta<=-5) return "#8f969f";
  if(delta<=-3) return "#71c873";
  return "#f1d56a";
}

function rollMobElite(template){
  if(!template || template.boss || template.eliteChance<=0) return false;
  return Math.random()<template.eliteChance;
}

function mobRankLabel(mob){
  if(!mob) return "";
  if(mob.boss || mob.template?.boss) return "Boss";
  if(mob.elite) return "Elite";
  return "";
}

function mobDisplayName(mob){
  if(!mob) return "Mob";
  const rank=mobRankLabel(mob);
  return `${rank?rank+" ":""}${mob.template?.name||mob.name||"Mob"}`;
}

function mobAggroRanges(mob){
  if(!mob || !mob.template?.aggressive) return {trigger:0,alert:0};
  const cfg=BALANCE.mobLevels||{};
  const delta=(mob.level||1)-state.level;
  const baseTrigger=Math.max(0,numberOr(mob.template.aggroTriggerRange,58));
  const baseAlert=Math.max(baseTrigger,numberOr(mob.template.alertRange,82));
  const minTrigger=Math.max(0,numberOr(cfg.minimumAggroTriggerRange,20));
  const minAlert=Math.max(minTrigger,numberOr(cfg.minimumAlertRange,34));
  let trigger=Math.max(minTrigger,baseTrigger+delta*numberOr(cfg.aggroRangePerLevelDifference,7));
  let alert=Math.max(minAlert,baseAlert+delta*numberOr(cfg.alertRangePerLevelDifference,9));
  let rankMult=1;
  if(mob.boss || mob.template?.boss) rankMult=numberOr(cfg.bossAggroMultiplier,1.25);
  else if(mob.elite) rankMult=numberOr(cfg.eliteAggroMultiplier,1.15);
  trigger*=rankMult;
  alert*=rankMult;
  return {trigger,alert:Math.max(trigger,alert)};
}

function mobScaledStats(template,level,elite=false){
  const cfg=BALANCE.mobLevels||{};
  const mobLevel=Math.max(1,Math.floor(numberOr(level,template.baseLevel||1)));
  const levelDelta=mobLevel-(template.baseLevel||1);
  const hpGrowth=percentOr(cfg.hpGrowthPerLevelPercent,14);
  const atkGrowth=percentOr(cfg.attackGrowthPerLevelPercent,10);
  const armorPerLevel=numberOr(cfg.armorPerLevel,.55);

  let maxHp=Math.max(1,Math.round(template.hp*Math.max(.25,1+levelDelta*hpGrowth)));
  let atk=Math.max(1,Math.round(template.atk*Math.max(.25,1+levelDelta*atkGrowth)));
  let def=Math.max(0,Math.round(template.def+levelDelta*armorPerLevel));
  let xp;
  if(booleanOr(cfg.useLevelBasedXp,true)){
    // Standard hostile mobs follow the same-level XP column from the 1-100
    // leveling curve. Species can scale this with xpMultiplier; elites/bosses
    // then apply their existing rank multipliers below.
    xp=Math.max(1,Math.round(standardMobXpForLevel(mobLevel)*Math.max(0,numberOr(template.xpMultiplier,1))));
  }else{
    const xpGrowth=percentOr(cfg.xpGrowthPerLevelPercent,18);
    xp=Math.max(1,Math.round(template.xp*Math.max(.25,1+levelDelta*xpGrowth)));
  }

  if(elite && !template.boss){
    maxHp=Math.max(1,Math.round(maxHp*numberOr(cfg.eliteHpMultiplier,1.65)));
    atk=Math.max(1,Math.round(atk*numberOr(cfg.eliteAttackMultiplier,1.20)));
    def=Math.max(0,Math.round(def+numberOr(cfg.eliteArmorBonus,2)));
    xp=Math.max(1,Math.round(xp*numberOr(cfg.eliteXpMultiplier,1.60)));
  }

  if(template.boss){
    maxHp=Math.max(1,Math.round(maxHp*numberOr(cfg.bossHpMultiplier,1.5)));
    atk=Math.max(1,Math.round(atk*numberOr(cfg.bossAttackMultiplier,1.25)));
    def=Math.max(0,Math.round(def*numberOr(cfg.bossArmorMultiplier,1.25)));
    xp=Math.max(1,Math.round(xp*numberOr(cfg.bossXpMultiplier,1.75)));
  }

  const danger=mobDangerSteps(mobLevel);
  if(danger>0){
    maxHp=Math.round(maxHp*(1+danger*percentOr(cfg.dangerHpPerExtraLevelPercent,12)));
    atk=Math.round(atk*(1+danger*percentOr(cfg.dangerAttackPerExtraLevelPercent,9)));
    def=Math.max(0,Math.round(def+danger*numberOr(cfg.dangerArmorPerExtraLevel,.6)));
    xp=Math.round(xp*(1+danger*percentOr(cfg.dangerXpPerExtraLevelPercent,10)));
  }

  return {maxHp,atk,def,xp,danger};
}

function mobXpReward(mob){
  if(!mob) return 0;
  const cfg=BALANCE.mobLevels||{};
  const base=Math.max(1,Math.floor(numberOr(mob.xp,mob.template?.xp||1)));
  const diff=mob.level-state.level;
  const trivialGap=Math.max(1,Math.floor(numberOr(cfg.trivialXpStartsAboveMobLevels,5)));
  if(state.level-mob.level>=trivialGap){
    // Intentional infinite-grind rule: trivial enemies always remain worth
    // exactly their level in XP, even for extremely high-level players.
    return Math.max(1,Math.floor(mob.level));
  }
  if(diff<0){
    const penalty=Math.abs(diff)*percentOr(cfg.lowLevelXpPenaltyPerLevelPercent,20);
    return Math.max(1,Math.round(base*Math.max(0,1-penalty)));
  }
  if(diff>0){
    return Math.max(1,Math.round(base*(1+diff*percentOr(cfg.higherLevelXpBonusPerLevelPercent,8))));
  }
  return base;
}

function restoreMobStats(mob,fullHeal=true){
  const oldMax=Math.max(1,numberOr(mob.maxHp,1));
  const oldHp=Math.max(0,numberOr(mob.hp,oldMax));
  const ratio=Math.max(0,Math.min(1,oldHp/oldMax));
  const stats=mobScaledStats(mob.template,mob.level,!!mob.elite);
  mob.maxHp=stats.maxHp;
  mob.hp=fullHeal?stats.maxHp:Math.max(1,Math.round(stats.maxHp*ratio));
  mob.atk=stats.atk;
  mob.def=stats.def;
  mob.xp=stats.xp;
  mob.dangerSteps=stats.danger;
  mob.attackAnim=0;
}

function refreshAliveMobStatsForPlayer(){
  for(const mob of mobs){
    if(mob.alive) restoreMobStats(mob,false);
  }
}

function spawnMobs(){
  mobs=[];
  nextMobId=1;
  bossMob=null;
  refreshMobTemplatesFromBalance();

  const spawnDefs=Array.isArray(window.LR_MOB_SPAWNS)?window.LR_MOB_SPAWNS:[];

  for(let i=0;i<spawnDefs.length;i++){
    const def=spawnDefs[i]||{};
    const type=String(def.mobType||def.kind||"").trim();
    if(!type) continue;
    const template=allMobTemplates().find(e=>e.configKey===type);
    if(!template) continue;
    const x=Number.isFinite(Number(def.x))?Number(def.x):numberOr(def.tx,0)*TILE+TILE/2;
    const y=Number.isFinite(Number(def.y))?Number(def.y):numberOr(def.ty,0)*TILE+TILE/2;
    const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
    if(ty<0||ty>=world.length||tx<0||tx>=(world[ty]?.length||0)||!tile[world[ty][tx]]?.walk) continue;
    const fixedLevel=Number.isFinite(Number(def.level));
    const level=fixedLevel?Math.max(1,Math.floor(Number(def.level))):mobSpawnLevel(template,tx,ty);
    const mob={
      id:nextMobId++,
      spawnId:String(def.id||`${type}-${i+1}`),
      spawnType:type,
      kind:template.kind,
      template,
      level,
      fixedLevel,
      x,y,homeX:x,homeY:y,
      vx:0,vy:0,
      drawVx:0,drawVy:0,
      facing:String(def.facing||"down"),
      facingCandidate:String(def.facing||"down"),
      facingCandidateTime:0,
      animTime:Math.random()*10,
      moveTimer:template.boss?999999:Math.random()*2,
      alive:true,
      respawnTimer:0,
      aggro:false,
      returningHome:false,
      leashStuckTime:0,
      boss:!!template.boss
    };
    restoreMobStats(mob);
    mobs.push(mob);
    if(mob.boss&&!bossMob) bossMob=mob;
  }
}

function stableMobFacing(mob,vx,vy,dt){
  const ax=Math.abs(vx), ay=Math.abs(vy);
  if(ax<1 && ay<1) return mob.facing||"down";

  // Axis hysteresis: when movement is close to diagonal, prefer the current
  // visual axis instead of flipping left/right/up/down every frame.
  let candidate;
  const current=mob.facing||"down";
  if((current==="left"||current==="right") && ax>=ay*0.72){
    candidate=vx>=0?"right":"left";
  }else if((current==="up"||current==="down") && ay>=ax*0.72){
    candidate=vy>=0?"down":"up";
  }else{
    candidate=vectorFacing(vx,vy,current);
  }

  if(candidate===current){
    mob.facingCandidate=candidate;
    mob.facingCandidateTime=0;
    return current;
  }
  if(mob.facingCandidate!==candidate){
    mob.facingCandidate=candidate;
    mob.facingCandidateTime=0;
  }
  mob.facingCandidateTime=(mob.facingCandidateTime||0)+dt;
  if(mob.facingCandidateTime>=0.14){
    mob.facing=candidate;
    mob.facingCandidateTime=0;
  }
  return mob.facing||current;
}

function drawSheetSprite(c, sheet, ready, x, y, scale=1, facing="down", animT=0, moving=true, layout=null, attacking=false, shadowWorldScale=null){
  c.save();
  c.imageSmoothingEnabled = false;

  const spec=layout&&typeof layout==="object"?layout:{};const cols=Math.max(1,Math.floor(numberOr(spec.columns,4))),rows=Math.max(1,Math.floor(numberOr(spec.rows,4)));
  const resolvedMap = spec.directionRows || { down:0, right:1, left:2, up:3 };
  const row = clamp(Math.floor(numberOr(resolvedMap[facing],0)),0,rows-1);
  const walkCycle=Array.isArray(spec.walkCycle)&&spec.walkCycle.length?spec.walkCycle:[0,1,2,1];
  const attackColumn=clamp(Math.floor(numberOr(spec.attackColumn,cols-1)),0,cols-1);
  const col = attacking ? attackColumn : (moving ? clamp(Math.floor(numberOr(walkCycle[Math.floor(animT * 7) % walkCycle.length],0)),0,cols-1) : 0);
  const bob = moving && !attacking ? Math.abs(Math.sin(animT * 7)) * 1.0 : 0;

  const shadowScale=Number.isFinite(Number(shadowWorldScale))?Math.max(.25,Number(shadowWorldScale)):Math.max(.25,scale/.23);
  c.fillStyle = "rgba(0,0,0,.18)";
  c.beginPath();
  c.ellipse(x, y + 10, 9 * shadowScale, 3.2 * shadowScale, 0, 0, Math.PI * 2);
  c.fill();

  if(ready && sheet.naturalWidth && sheet.naturalHeight){
    const sx0 = Math.round(col * sheet.naturalWidth / cols);
    const sx1 = Math.round((col + 1) * sheet.naturalWidth / cols);
    const sy0 = Math.round(row * sheet.naturalHeight / rows);
    const sy1 = Math.round((row + 1) * sheet.naturalHeight / rows);
    const frameW = sx1 - sx0;
    const frameH = sy1 - sy0;
    const meta=spriteFrameMeta(sheet,row,col);
    if(meta){
      // Draw only the visible pixels from the frame. This makes the actual feet,
      // not transparent padding at the bottom of the cell, define ground contact.
      const dw=meta.sw*scale;
      const dh=meta.sh*scale;
      const dx=Math.round(x-dw/2);
      const groundY=Math.round(y+8-bob);
      const dy=Math.round(groundY-dh);
      c.drawImage(sheet,meta.sx,meta.sy,meta.sw,meta.sh,dx,dy,dw,dh);
    }else{
      const dw = frameW * scale;
      const dh = frameH * scale;
      const dx = Math.round(x - dw / 2);
      const dy = Math.round(y - dh + 8 - bob);
      c.drawImage(sheet, sx0, sy0, frameW, frameH, dx, dy, dw, dh);
    }
  } else {
    c.fillStyle="#c8b5d4";c.fillRect(x-8,y-16,16,16);c.fillStyle="#241b2a";c.font="bold 11px sans-serif";c.textAlign="center";c.fillText("?",x,y-4);
  }

  c.restore();
}

const dynamicMobSheets=new Map();
function dynamicMobSheet(path){
  if(!path)return null;
  if(dynamicMobSheets.has(path))return dynamicMobSheets.get(path);
  const image=new Image();const record={image,ready:false};
  image.onload=()=>{record.ready=true;buildSpriteFrameMeta(image);};
  image.src=/^(?:data:|blob:|https?:|\.\/|\/)/.test(path)?path:`./${path}`;dynamicMobSheets.set(path,record);return record;
}
function mobWorldDisplayHeight(mob){return Math.max(8,numberOr(mob?.template?.displayHeight??mob?.displayHeight,MOB_SIZE_CLASS_HEIGHTS.medium));}
// World-relative scale for rings, labels, click radii, Builder overlays, and other
// gameplay/UI geometry. This intentionally depends only on normalized displayHeight,
// never on source sprite resolution. Keep this helper separate from image draw scale.
function mobVisualScale(mob){return mobWorldDisplayHeight(mob)/MOB_SIZE_CLASS_HEIGHTS.medium;}
function mobVisibleHeightScale(mob,sheet,ready,layout){
  if(!ready||!sheet?.naturalHeight)return .23;
  const spec=layout&&typeof layout==="object"?layout:{};
  const rows=Math.max(1,Math.floor(numberOr(spec.rows,4)));
  const rowMap=spec.directionRows||{down:0,right:1,left:2,up:3};
  const referenceRow=clamp(Math.floor(numberOr(rowMap.down,0)),0,rows-1);
  const meta=spriteFrameMeta(sheet,referenceRow,0);
  const referenceHeight=Math.max(1,numberOr(meta?.sh,sheet.naturalHeight/rows));
  return mobWorldDisplayHeight(mob)/referenceHeight;
}
function drawMob(c,mob,sx,sy){
  const path=String(mob?.template?.sprite||"");if(!path)return;
  const record=dynamicMobSheet(path);if(!record)return;
  const moving=Math.hypot(mob.drawVx||0,mob.drawVy||0)>4,attacking=(mob.attackAnim||0)>0;
  const layout=mob.template?.spriteLayout;
  drawSheetSprite(c,record.image,record.ready,sx,sy,mobVisibleHeightScale(mob,record.image,record.ready,layout),mob.facing||"down",mob.animTime||0,moving,layout,attacking,mobWorldDisplayHeight(mob)/MOB_SIZE_CLASS_HEIGHTS.medium);
}
function drawBattleSprites(){
  heroCtx.clearRect(0,0,heroCanvas.width,heroCanvas.height);enemyCtx.clearRect(0,0,enemyCanvas.width,enemyCanvas.height);drawHero(heroCtx,24,36,0.15,false,0,"down");
  if(!enemy)return;const path=String(enemy.sprite||enemy.template?.sprite||"");if(!path)return;
  const record=dynamicMobSheet(path);if(!record)return;
  const scale=Math.max(.05,numberOr(enemy.battleScale??enemy.template?.battleScale,.55));
  drawSheetSprite(enemyCtx,record.image,record.ready,36,44,scale,"down",performance.now()/1000,false,enemy.template?.spriteLayout,enemyAttackAnim>0);
}

function finishMobLeashReturn(mob){
  if(!mob) return;
  mob.x=mob.homeX; mob.y=mob.homeY;
  mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
  mob.aggro=false;
  mob.returningHome=false;
  mob.leashStuckTime=0;
  mob.moveTimer=Math.max(.45,numberOr(mob.template?.wanderDelayMin,.8));
  mob.facingCandidateTime=0;
  if(mob.alive && Number.isFinite(mob.maxHp)) mob.hp=mob.maxHp;
}

function startMobLeashReturn(mob){
  if(!mob||!mob.alive) return false;
  mob.aggro=false;
  mob.returningHome=true;
  mob.vx=0; mob.vy=0;
  mob.leashStuckTime=0;
  if(Number.isFinite(mob.maxHp)) mob.hp=mob.maxHp;
  if(typeof selectedTarget!=="undefined" && selectedTarget===mob) selectedTarget=null;
  if(dist(mob.x,mob.y,mob.homeX,mob.homeY)<=3) finishMobLeashReturn(mob);
  return true;
}

function mobHomeIsSafeGrass(mob){
  return !!mob && terrainIsSanctuary(tileAtWorld(mob.homeX,mob.homeY));
}

function mobCanStandWithSafeGrass(mob,x,y,radius=10){
  if(!canStand(x,y,radius)) return false;
  // Safe Grass is a sanctuary boundary for mobs that spawned outside it.
  // Mobs intentionally authored with a home point on Safe Grass are allowed
  // to move normally so the Builder never silently freezes valid content.
  return mobHomeIsSafeGrass(mob) || !terrainIsSanctuary(tileAtWorld(x,y));
}

function updateMobs(dt){
  if(isLootInteractionOpen()) return;
  for(const mob of mobs){
    if(!mob.alive){
      if(mob.boss) continue;
      mob.respawnTimer-=dt;
      if(mob.respawnTimer<=0){
        mob.alive=true;
        mob.x=mob.homeX; mob.y=mob.homeY;
        mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
        mob.facing="down"; mob.facingCandidate="down"; mob.facingCandidateTime=0; mob.aggro=false;
        mob.returningHome=false; mob.leashStuckTime=0;
        mob.elite=rollMobElite(mob.template);
        restoreMobStats(mob);
      }
      continue;
    }

    mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);
    const d=dist(state.x,state.y,mob.x,mob.y);
    let isTarget=mob===combatTarget;
    let homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);

    // The spawn point is the hard combat leash anchor. Once a mob has been
    // pulled beyond its configured leash, it evades immediately: combat ends,
    // HP resets, and the mob runs home before it can be engaged again.
    if(isTarget && !mob.returningHome && homeDist>mob.template.combatLeashDistance){
      disengageCombat(false);
      isTarget=false;
    }

    // Aggression and movement are data-driven so routine mob tuning only
    // requires editing config/game-balance.js. Returning mobs are in an evade
    // state and cannot re-aggro until they have reached their spawn point.
    const aggroRanges=mobAggroRanges(mob);
    const safeGrassProtectsPlayer=terrainIsSanctuary(tileAtWorld(state.x,state.y)) && !mobHomeIsSafeGrass(mob);
    if(isTarget && safeGrassProtectsPlayer){
      disengageCombat(false);
      isTarget=false;
    }
    if(!mob.returningHome && !combatTarget && mob.template.aggressive && !safeGrassProtectsPlayer && d<aggroRanges.trigger){
      engageMob(mob,true);
      isTarget=mob===combatTarget;
    }

    mob.aggro=!safeGrassProtectsPlayer && !mob.returningHome && (isTarget || (!combatTarget && mob.template.aggressive && d<aggroRanges.alert));

    let vx=0,vy=0;
    if(mob.returningHome){
      if(homeDist<=3){
        finishMobLeashReturn(mob);
        continue;
      }
      const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
      const len=Math.max(.001,Math.hypot(dx,dy));
      const returnSpeed=Math.max(mob.template.leashSpeed,mob.template.chaseSpeed);
      vx=dx/len*returnSpeed; vy=dy/len*returnSpeed;
    }else if(isTarget){
      const desired=ATTACK_RANGE-8;
      if(d>desired){
        const dx=state.x-mob.x, dy=state.y-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        const speed=mob.template.chaseSpeed;
        vx=dx/len*speed; vy=dy/len*speed;
      }
    }else if(mob.boss){
      vx=0; vy=0;
    }else{
      mob.moveTimer-=dt;
      if(mob.moveTimer<=0){
        const minDelay=Math.min(mob.template.wanderDelayMin,mob.template.wanderDelayMax);
        const maxDelay=Math.max(mob.template.wanderDelayMin,mob.template.wanderDelayMax);
        mob.moveTimer=minDelay+Math.random()*(maxDelay-minDelay);
        const ang=Math.random()*Math.PI*2;
        mob.vx=Math.cos(ang)*mob.template.wanderSpeed; mob.vy=Math.sin(ang)*mob.template.wanderSpeed;
      }
      vx=mob.vx; vy=mob.vy;
      homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(homeDist>mob.template.leashDistance){
        const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        vx=dx/len*mob.template.leashSpeed; vy=dy/len*mob.template.leashSpeed;
      }
    }

    mob.drawVx=vx; mob.drawVy=vy;
    if(Math.hypot(vx,vy)>1){
      stableMobFacing(mob,vx,vy,dt);
      mob.animTime=(mob.animTime||0)+dt;
    }else if(isTarget){
      stableMobFacing(mob,state.x-mob.x,state.y-mob.y,dt);
    }else{
      mob.facingCandidateTime=0;
    }

    const nx=mob.x+vx*dt, ny=mob.y+vy*dt;
    let blocked=false;
    if(mobCanStandWithSafeGrass(mob,nx,mob.y,10)) mob.x=nx; else blocked=true;
    if(mobCanStandWithSafeGrass(mob,mob.x,ny,10)) mob.y=ny; else blocked=true;

    if(mob.returningHome){
      // Normal movement usually slides around terrain one axis at a time. This
      // fail-safe prevents an evading mob from remaining permanently wedged.
      mob.leashStuckTime=blocked?(mob.leashStuckTime||0)+dt:Math.max(0,(mob.leashStuckTime||0)-dt*2);
      const remaining=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(remaining<=3 || mob.leashStuckTime>=1.5){
        finishMobLeashReturn(mob);
        continue;
      }
    }else if(blocked && !isTarget && !mob.boss){
      // Do not bounce the stored wander vector back and forth against a wall.
      // Stop briefly and choose a fresh direction on the next wander decision.
      mob.vx=0; mob.vy=0; mob.moveTimer=0;
    }

  }
}

function findNearestMob(maxDistance=Infinity){
  let best=null,bestD=maxDistance;
  for(const mob of mobs){
    if(!mob.alive || mob.returningHome) continue;
    const d=dist(state.x,state.y,mob.x,mob.y);
    if(d<bestD){best=mob;bestD=d}
  }
  return best;
}
