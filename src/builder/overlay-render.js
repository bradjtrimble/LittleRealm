function drawDeveloperVisualSizeOverlay(target,camX,camY){
  if(!devSizeEditing||!target)return;const b=developerVisualSizeBounds(target);if(!b)return;const zoom=developerCameraZoomValue(),x=b.x-camX,y=b.y-camY;
  ctx.fillStyle="rgba(99,230,255,.08)";ctx.strokeStyle="#63e6ff";ctx.lineWidth=2/zoom;ctx.fillRect(x,y,b.w,b.h);ctx.strokeRect(x,y,b.w,b.h);
  const handleSize=9/zoom,half=handleSize/2;ctx.fillStyle="#dffbff";ctx.strokeStyle="#176b7c";ctx.lineWidth=1/zoom;
  for(const [,wx,wy] of developerVisualSizeHandlePoints(target,b)){const px=wx-camX,py=wy-camY;ctx.fillRect(px-half,py-half,handleSize,handleSize);ctx.strokeRect(px-half,py-half,handleSize,handleSize);}
  ctx.font=`800 ${Math.max(8,10/zoom)}px system-ui`;ctx.fillStyle="#bff6ff";ctx.textAlign="left";const text=target.kind==="mob"?`SIZE • ${Math.round(b.h)}px • global type`:target.kind==="npc"?`SIZE • ${Math.round(numberOr(target.entity.displayHeight,b.h))}px • aspect locked`:`SIZE • ${Math.round(b.w)} × ${Math.round(b.h)}`;ctx.fillText(text,x,y-7/zoom);
}

function drawDeveloperSelectedEntityOverlay(entity,camX,camY){
  if(!entity) return;
  const b=developerEntityBounds(entity);
  const x=b.x-camX,y=b.y-camY;
  ctx.strokeStyle="#63e6ff";
  ctx.fillStyle="rgba(99,230,255,.05)";
  ctx.lineWidth=2/developerCameraZoomValue();
  ctx.fillRect(x-2,y-2,b.w+4,b.h+4);
  ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);

  drawDeveloperVisualSizeOverlay({kind:developerIsNpc(entity)?"npc":"object",entity},camX,camY);

  if(devHitboxEditing){
    const hb=ensureDeveloperHitbox(entity);
    const hx=entity.x+hb.x-camX, hy=entity.y+hb.y-camY;
    ctx.fillStyle="rgba(255,209,102,.13)";
    ctx.strokeStyle="#ffd166";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(hx,hy,hb.w,hb.h);
    ctx.strokeRect(hx,hy,hb.w,hb.h);

    const handleSize=7/developerCameraZoomValue();
    const half=handleSize/2;
    const points=[
      [hx,hy],[hx+hb.w/2,hy],[hx+hb.w,hy],
      [hx,hy+hb.h/2],[hx+hb.w,hy+hb.h/2],
      [hx,hy+hb.h],[hx+hb.w/2,hy+hb.h],[hx+hb.w,hy+hb.h]
    ];
    ctx.fillStyle="#fff3c4";
    ctx.strokeStyle="#8a6817";
    ctx.lineWidth=1/developerCameraZoomValue();
    for(const [px,py] of points){
      ctx.fillRect(px-half,py-half,handleSize,handleSize);
      ctx.strokeRect(px-half,py-half,handleSize,handleSize);
    }
  }

  if(devInteractionEditing && !developerIsNpc(entity)){
    const a=ensureDeveloperInteractionArea(entity);
    const ix=entity.x+a.x-camX,iy=entity.y+a.y-camY;
    ctx.fillStyle="rgba(106,255,163,.14)";ctx.strokeStyle="#6affa3";ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(ix,iy,a.w,a.h);ctx.strokeRect(ix,iy,a.w,a.h);
    const handleSize=7/developerCameraZoomValue(),half=handleSize/2;
    const points=[[ix,iy],[ix+a.w/2,iy],[ix+a.w,iy],[ix,iy+a.h/2],[ix+a.w,iy+a.h/2],[ix,iy+a.h],[ix+a.w/2,iy+a.h],[ix+a.w,iy+a.h]];
    ctx.fillStyle="#d9ffe8";ctx.strokeStyle="#23784a";ctx.lineWidth=1/developerCameraZoomValue();
    for(const [px,py] of points){ctx.fillRect(px-half,py-half,handleSize,handleSize);ctx.strokeRect(px-half,py-half,handleSize,handleSize);}
    ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;ctx.fillStyle="#d9ffe8";ctx.fillText("INTERACT",ix+a.w+8,iy-2/developerCameraZoomValue());
  }

  if(devDepthEditing && developerEntityDepthMode(entity)==="ysort"){
    const depth=ensureDeveloperDepth(entity);
    const lineY=entity.y+depth.y-camY;
    ctx.strokeStyle="#d58cff";
    ctx.fillStyle="#f2d7ff";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
    const r=5/developerCameraZoomValue();
    const cx=x+b.w/2;
    ctx.beginPath();
    ctx.moveTo(cx,lineY-r);ctx.lineTo(cx+r,lineY);ctx.lineTo(cx,lineY+r);ctx.lineTo(cx-r,lineY);ctx.closePath();ctx.fill();
    ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;
    ctx.fillStyle="#f2d7ff";
    ctx.fillText("DEPTH",x+b.w+10,lineY-2/developerCameraZoomValue());
  }

  if(developerIsNpc(entity)){
    ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(entity.name,entity.x-camX,y-7);ctx.textAlign="start";
  }
}

function drawDeveloperOverlay(camX,camY,viewW,viewH){
  ctx.save();
  ctx.lineWidth=1/developerCameraZoomValue();
  if(devShowGrid){
    ctx.strokeStyle="rgba(255,255,255,.10)";
    const step=devSnap;
    const startX=Math.floor(camX/step)*step;
    const startY=Math.floor(camY/step)*step;
    ctx.beginPath();
    for(let wx=startX;wx<camX+viewW;wx+=step){const x=wx-camX;ctx.moveTo(x,0);ctx.lineTo(x,viewH);}
    for(let wy=startY;wy<camY+viewH;wy+=step){const y=wy-camY;ctx.moveTo(0,y);ctx.lineTo(viewW,y);}
    ctx.stroke();
  }
  if(devShowHitboxes){
    for(const obj of sceneryProps){
      if(!obj.solid || !obj.hitbox) continue;
      const hb=obj.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=obj.x+hb.x-camX,y=obj.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
    for(const npc of sceneryNPCs){
      if(npc.solid===false || !npc.hitbox) continue;
      const hb=npc.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=npc.x+hb.x-camX,y=npc.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
  }
  if(devShowDepthLines){
    for(const obj of sceneryProps){
      if(worldObjectDepthMode(obj)!=="ysort") continue;
      const spec=worldObjectSpec(obj);
      if(!spec) continue;
      const y=obj.y+worldObjectDepthY(obj)-camY;
      const x=obj.x-camX;
      ctx.strokeStyle=obj===devSelected?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(obj===devSelected?1.7:1)/developerCameraZoomValue();
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+spec.w+3,y);ctx.stroke();
    }
    for(const npc of sceneryNPCs){
      if(npcDepthMode(npc)!=="ysort") continue;
      const b=npcVisualBounds(npc);
      const y=npc.y+npcDepthY(npc)-camY;
      const x=b.x-camX;
      ctx.strokeStyle=npc===devSelectedNpc?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(npc===devSelectedNpc?1.7:1)/developerCameraZoomValue();
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+b.w+3,y);ctx.stroke();
    }
  }
  if(devSelectedRemnant && devRemnantPreview){
    const b=developerRemnantPreviewBounds();
    const x=b.x-camX,y=b.y-camY;
    ctx.strokeStyle="#63e6ff";ctx.fillStyle="rgba(99,230,255,.05)";ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(x-2,y-2,b.w+4,b.h+4);ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);
    if(devShowDepthLines && lootRemnantDepthMode()==="ysort"){
      const lineY=devRemnantPreview.y+lootRemnantDepthY()-camY;
      ctx.strokeStyle="#d58cff";ctx.lineWidth=2/developerCameraZoomValue();ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
      ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;ctx.fillStyle="#f2d7ff";ctx.fillText("DEPTH",x+b.w+10,lineY-2/developerCameraZoomValue());
    }
  }
  if(devActiveTab==="terrain"){
    const minTx=Math.max(0,Math.floor(camX/TILE)-1),maxTx=Math.min(WORLD_W-1,Math.ceil((camX+viewW)/TILE)+1);
    const minTy=Math.max(0,Math.floor(camY/TILE)-1),maxTy=Math.min(WORLD_H-1,Math.ceil((camY+viewH)/TILE)+1);
    ctx.font=`${Math.max(8,11/developerCameraZoomValue())}px system-ui`;ctx.textAlign="center";
    for(let ty=minTy;ty<=maxTy;ty++)for(let tx=minTx;tx<=maxTx;tx++){
      if(!terrainIsHealing(world[ty]?.[tx]))continue;
      const x=tx*TILE-camX,y=ty*TILE-camY;
      ctx.fillStyle="rgba(120,244,190,.24)";ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle="rgba(189,255,224,.78)";ctx.lineWidth=2/developerCameraZoomValue();ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
      ctx.strokeStyle="rgba(130,255,205,.40)";ctx.lineWidth=1/developerCameraZoomValue();
      for(let d=-TILE;d<TILE*2;d+=14){ctx.beginPath();ctx.moveTo(x+d,y);ctx.lineTo(x+d+TILE,y+TILE);ctx.stroke();}
      ctx.font=`800 ${Math.max(10,15/developerCameraZoomValue())}px system-ui`;ctx.fillStyle="rgba(240,255,248,.98)";ctx.fillText("+",x+TILE/2,y+TILE/2+5/developerCameraZoomValue());
    }
    ctx.textAlign="start";
  }
  if(devActiveTab==="terrain" && devTerrainHoverTile){
    const {tx,ty}=devTerrainHoverTile;
    const bounds=developerTerrainBrushBounds(tx,ty);
    const x=bounds.x1*TILE-camX,y=bounds.y1*TILE-camY;
    const w=(bounds.x2-bounds.x1+1)*TILE,h=(bounds.y2-bounds.y1+1)*TILE;
    ctx.fillStyle=developerTerrainColor()+"55";
    ctx.strokeStyle="#f6efff";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
    ctx.font=`${Math.max(8,10/developerCameraZoomValue())}px system-ui`;ctx.textAlign="center";ctx.fillStyle="#fff";
    ctx.fillText(developerTerrainType().name,x+w/2,y-5/developerCameraZoomValue());ctx.textAlign="start";
  }
  if(devActiveTab==="spawns"){
    for(const spawn of devMobSpawns){
      const x=spawn.x-camX,y=spawn.y-camY,selected=spawn.id===devSelectedSpawnId;
      ctx.strokeStyle=selected?"#63e6ff":"rgba(99,230,255,.55)";ctx.fillStyle=selected?"rgba(99,230,255,.18)":"rgba(99,230,255,.06)";ctx.lineWidth=(selected?2:1.2)/developerCameraZoomValue();
      ctx.beginPath();ctx.arc(x,y,selected?18:13,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();
      ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;ctx.textAlign="center";ctx.fillStyle=selected?"#dffbff":"rgba(223,251,255,.8)";ctx.fillText(mobTypeScaleLabel(spawn.mobType),x,y-20);ctx.textAlign="start";
    }
  }
  drawDeveloperSelectedEntityOverlay(developerSelectedEntity(),camX,camY);
  if(devSelectedMob && devSelectedMob.alive){
    const x=devSelectedMob.x-camX,y=devSelectedMob.y-camY;
    if(devSizeEditing&&devActiveTab==="scale")drawDeveloperVisualSizeOverlay({kind:"mob",entity:devSelectedMob,key:mobTypeScaleKey(devSelectedMob)},camX,camY);
    const scale=mobVisualScale(devSelectedMob);
    ctx.strokeStyle="#63e6ff";
    ctx.fillStyle="rgba(99,230,255,.10)";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.beginPath();ctx.ellipse(x,y+8,(devSelectedMob.boss?28:20)*scale,(devSelectedMob.boss?13:9)*scale,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(`${mobTypeScaleLabel(mobTypeScaleKey(devSelectedMob))} ${scale.toFixed(2)}×`,x,y-(devSelectedMob.boss?44:34)*scale);
    ctx.textAlign="start";
  }
  drawDeveloperCameraOverlay(camX,camY);
  ctx.restore();
}
