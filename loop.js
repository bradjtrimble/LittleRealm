function frame(now){
  const dt=Math.min(.033,(now-lastFrame)/1000);
  lastFrame=now;
  updateMovement(dt);
  updateMobs(dt);
  updateOpenCombat(dt);
  if(isHeroMoving) moveAnimTime+=dt;
  drawWorld();
  requestAnimationFrame(frame);
}
