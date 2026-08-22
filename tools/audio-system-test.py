#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text())
pack=json.loads((ROOT/'content/zones/starter-realm/world-pack.json').read_text())
audio=(ROOT/'src/audio.js').read_text(); panel=(ROOT/'src/builder/audio-editor.js').read_text(); importer=(ROOT/'src/builder/audio-importer.js').read_text(); terrain=(ROOT/'src/builder/terrain-editor.js').read_text(); mob=(ROOT/'src/builder/mob-editor.js').read_text(); interactions=(ROOT/'src/world-interactions.js').read_text(); builder=(ROOT/'src/builder/panel-shell.js').read_text(); html=(ROOT/'index.html').read_text(); build=(ROOT/'tools/build.py').read_text(); sw=(ROOT/'service-worker.js').read_text()
checks={
 'audio runtime module':'"audio.js"' in build and 'function playAudioClip' in audio,
 'four mix buses':all(x in audio for x in ['music','ambience','sfx','ui','LR_AUDIO_DEFAULT_PREFS']),
 'player audio settings':all(x in html for x in ['audioMaster','audioMusic','audioAmbience','audioSfx','audioUi','audioMute']),
 'shared audio content':all(k in shared for k in ['audioClips','audioSets','audioEvents']),
 'batch audio import':'multiple accept="audio/' in panel and 'developerImportAudioFiles' in importer,
 'audio library preview':'developerAudioPreview' in panel and 'devAudioList' in panel,
 'sound sets':'devAudioSets' in panel and 'clipIds' in panel,
 'terrain footsteps':'footstepSet' in terrain and 'updateFootstepAudio' in audio and 'playAudioSet' in audio,
 'zone music ambience':all(k in pack.get('zoneSettings',{}) for k in ['musicId','musicVolume','ambienceId','ambienceVolume']) and 'applyZoneAudioFromCurrentSettings' in audio,
 'mob audio':all(x in mob for x in ['devMobAudioAggro','devMobAudioAttack','devMobAudioHit','devMobAudioDeath']),
 'interaction sound':'soundId' in interactions and 'devInteractionSound' in (ROOT/'src/builder/panel-refresh.js').read_text(),
 'positional emitters':'updateWorldAudioEmitters' in audio and 'soundEmitter' in audio,
 'runtime cache on demand':'assets/audio/' not in sw,
}
for label,ok in checks.items():
    print(('PASS' if ok else 'FAIL'),label)
    if not ok: errors.append(label)
if shared.get('schemaVersion')!=12 or pack.get('schemaVersion')!=12: errors.append('audio project schema is not v12')
for tid,t in shared.get('terrains',{}).items():
    if 'footstepSet' not in t: errors.append(f'{tid} missing footstepSet field')
for mid,m in shared.get('mobs',{}).items():
    if 'audio' not in m: errors.append(f'{mid} missing audio block')
if errors:
    print('Audio system check failed:'); [print('  - '+e) for e in errors]; raise SystemExit(1)
print('PASS v76 data-driven audio + terrain footsteps')
