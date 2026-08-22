// Production-only World Builder compatibility hooks.
// The full editor lives in builder/game.js and is not shipped to players.
let devModeActive=false;
let devSelectedRemnant=null;
let devRemnantPreview=null;
function drawDeveloperOverlay(){}
function initDeveloperMode(){}
function toggleDeveloperMode(){}

function developerCameraFrame(vw=innerWidth,vh=innerHeight){const zoom=CAMERA_ZOOM,viewW=vw/zoom,viewH=vh/zoom;return {mode:"player",zoom,viewW,viewH,camX:state.x-viewW/2,camY:state.y-viewH/2,centerX:state.x,centerY:state.y};}
function developerCameraZoomValue(){return CAMERA_ZOOM;}
function developerCameraLocksPlayerMovement(){return false;}
function updateDeveloperCamera(){}
