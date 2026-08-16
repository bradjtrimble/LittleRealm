const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
for(const required of [
  'function questIsTracked','function trackedQuests','function setQuestTracked',
  'data-track-quest','questTrackerEntry','questTrackerObjective','getNpcQuestMarkerInfo',
  'kind:"talk"','tracked:true'
]) if(!bundle.includes(required)) throw new Error('missing quest tracking runtime: '+required);
for(const required of ['.questTrackToggle','.questTrackerEntry','.questObjectiveRow.complete'])
  if(!css.includes(required)) throw new Error('missing quest tracking CSS: '+required);
console.log('PASS multi-quest tracker + talk objective markers');
