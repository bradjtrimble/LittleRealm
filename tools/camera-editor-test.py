from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
fail=[]
def ok(cond,label):
    if cond: print('PASS',label)
    else: fail.append(label); print('FAIL',label)
cam=(ROOT/'src/builder/camera-editor.js').read_text()
world=(ROOT/'src/world.js').read_text()
player=(ROOT/'src/player.js').read_text()
loop=(ROOT/'src/loop.js').read_text()
editor=(ROOT/'src/builder/world-editor.js').read_text()
panel=(ROOT/'src/builder/panel-shell.js').read_text()
build=(ROOT/'tools/build.py').read_text()
shim=(ROOT/'src/devmode-shim.js').read_text()

ok('function developerCameraFrame' in cam,'builder camera frame')
ok('state?.x' in cam and 'state?.y' in cam and 'START_X' in cam and 'START_Y' in cam,'camera bootstrap tolerates uninitialized player state')
ok('devCameraMode="player"' in (ROOT/'src/builder/state.js').read_text(),'player camera default')
ok('"player","free","world"' in cam,'player/free/world camera modes')
ok('developerWorldFitZoom' in cam and 'WORLD_W*TILE' in cam and 'WORLD_H*TILE' in cam,'world view fits active zone')
ok('developerCameraKeyDirection' in cam and 'KeyW' in cam and 'ArrowUp' in cam,'free camera keyboard pan')
ok('event.button!==1' in cam and 'developerUpdateCameraPan' in cam,'middle mouse camera pan')
ok('developerHandleCameraWheel' in cam and 'developerCameraZoomBy' in cam,'free camera wheel zoom')
ok('developerMovePlayerToCamera' in cam and 'developerNearestWalkableCameraPoint' in cam,'move player to camera with walkable fallback')
ok('developerCenterCameraOnPlayer' in cam and 'developerCenterCameraOnSelection' in cam,'camera centering shortcuts')
ok('developerPersistCameraForZone' in cam and 'developerRestoreCameraForZone' in cam,'per-zone camera memory')
ok('developerCameraLocksPlayerMovement' in player and 'cameraLocksPlayer' in player,'free camera locks player movement')
ok(loop.find('updateDeveloperCamera(dt)') < loop.find('updateMovement(dt)'),'camera updates before player movement')
ok('const camera=developerCameraFrame(vw,vh)' in world,'world renderer uses builder camera frame')
ok('let hx=state.x-camX,hy=state.y-camY' in world,'player renders at real world position in free camera')
ok('camera.camX+event.clientX/camera.zoom' in editor,'builder pointer mapping follows camera')
ok('data-dev-camera-mode="player"' in panel and 'data-dev-camera-mode="free"' in panel and 'data-dev-camera-mode="world"' in panel,'camera mode toolbar')
ok('id="devMovePlayerToCamera"' in panel,'move player here control')
ok('value="9"' in panel and 'value="15"' in panel and 'value="25"' in panel,'large world-view terrain brushes')
ok('builder/camera-editor.js' in build,'camera editor included in builder bundle')
ok('function developerCameraFrame' in shim and 'function updateDeveloperCamera(){}' in shim,'production camera shim remains player-follow only')

if fail:
    print('\nCamera editor test failed:',', '.join(fail));sys.exit(1)
print('PASS Builder Camera & World View workflow')
