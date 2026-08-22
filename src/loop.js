function frame(now){
  const dt=Math.min(.033,(now-lastFrame)/1000);
  lastFrame=now;
  updateDeveloperCamera(dt);
  updateMovement(dt);
  updateLootPiles(now);
  updateMobs(dt);
  updateOpenCombat(dt);
  updateAudioRuntime(dt);
  if(isHeroMoving) moveAnimTime+=dt;
  drawWorld();
  requestAnimationFrame(frame);
}
