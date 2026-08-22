// v77.4 modular character rig alignment workspace with fullscreen + per-direction row fine-tuning.
if(!document.getElementById("lrCharacterRigStyles")){const style=document.createElement("style");style.id="lrCharacterRigStyles";style.textContent=`
#devPanel .devRigAlignmentCard{padding:12px}
#devPanel .devRigTitleBar{align-items:center}
#devPanel .devRigTitleActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
#devPanel .devRigExpandButton,#devPanel .devRigExitButton{border:1px solid rgba(99,230,255,.25);background:#31505a;color:#eaffff;border-radius:7px;padding:5px 8px;font-size:9px;font-weight:900;letter-spacing:.02em;cursor:pointer}
#devPanel .devRigExpandButton:hover,#devPanel .devRigExitButton:hover{background:#3d6570;border-color:rgba(99,230,255,.48)}
#devPanel .devRigExitButton{display:none;background:#5a4869;border-color:rgba(255,255,255,.18)}
#devPanel .devRigWorkspace{display:grid;grid-template-columns:minmax(220px,1.1fr) minmax(190px,.9fr);gap:12px;align-items:start}
#devPanel .devRigPreviewPane{position:sticky;top:0;z-index:2;min-width:0;padding:9px;background:#17131d;border:1px solid rgba(99,230,255,.14);border-radius:11px;box-shadow:0 8px 22px rgba(0,0,0,.18)}
#devPanel .devRigPreviewHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 1px 7px;color:#eee5f3;font-size:10px}
#devPanel .devRigPreviewHeader b{font-size:10px;text-transform:uppercase;letter-spacing:.045em}#devPanel .devRigPreviewHeader span{color:#9edfea;font-size:9px;white-space:nowrap}
#devPanel .devRigPreview{display:block;width:100%;max-width:460px;height:auto;aspect-ratio:1/1;margin:0 auto;background:#14111b;border:1px solid rgba(255,255,255,.11);border-radius:9px;image-rendering:pixelated}
#devPanel .devRigPreviewDraggable{cursor:grab;touch-action:none}#devPanel .devRigPreviewDraggable:active{cursor:grabbing}
#devPanel .devRigPreviewLegend{display:flex;justify-content:space-between;gap:8px;margin:6px 2px 0;color:#8f8498;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
#devPanel .devRigControls{min-width:0;padding:2px 0}
#devPanel .devRigControlBlock{margin-top:9px;padding:8px;background:#211b27;border:1px solid rgba(255,255,255,.07);border-radius:9px}
#devPanel .devRigControlTitle{color:#d8c1e7;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
#devPanel .devRigDirectionBlock{border-color:rgba(99,230,255,.15);background:linear-gradient(180deg,rgba(49,80,90,.18),#211b27 32%)}
#devPanel .devRigDirectionHelp{margin:4px 0 7px;color:#a99eaf;font-size:8px;line-height:1.35}
#devPanel .devRigDirectionTabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:6px 0 8px}
#devPanel .devRigDirectionTabs button{min-width:0;padding:6px 2px;border:1px solid rgba(255,255,255,.09);border-radius:6px;background:#17131d;color:#a99eaf;font-size:8px;font-weight:800;cursor:pointer}
#devPanel .devRigDirectionTabs button:hover{border-color:rgba(99,230,255,.3);color:#dffbff}
#devPanel .devRigDirectionTabs button.active{background:#31505a;border-color:rgba(99,230,255,.48);color:#eaffff;box-shadow:inset 0 0 0 1px rgba(99,230,255,.08)}
#devPanel .devRigRowOffsetPair input:disabled{opacity:.45;cursor:not-allowed}
#devPanel .devRigFineTuneActions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
#devPanel .devRigFineTuneActions button{padding:6px 5px;font-size:8px;line-height:1.2}
#devPanel .devRigFineTuneActions button:disabled{opacity:.42;cursor:not-allowed}
#devPanel .devRigControlHelp{margin-top:9px;padding:8px 9px;background:rgba(99,230,255,.055);border:1px solid rgba(99,230,255,.13);border-radius:8px;color:#b9aebe;font-size:9px;line-height:1.35}
#devPanel .devRigActions{flex-direction:column}#devPanel .devRigActions button{width:100%}

#devPanel.devRigFullscreenMode{top:0!important;right:0!important;bottom:0!important;left:0!important;width:100vw!important;height:100vh!important;max-width:none!important;border:0!important;border-radius:0!important}
#devPanel.devRigFullscreenMode .assetsLayout .devDetailPane>.devSection{max-height:none!important;overflow:visible!important}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen{position:absolute;inset:0;z-index:500;margin:0;padding:18px 22px 22px;border:0;border-radius:0;background:#121017;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigExpandButton{display:none}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigExitButton{display:inline-flex;align-items:center;justify-content:center;padding:7px 11px;font-size:10px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigTitleBar{margin:0 0 2px;font-size:13px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigTitleBar>b{font-size:14px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigIntro{font-size:11px;margin:2px 0 12px!important}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigWorkspace{min-height:0;height:100%;grid-template-columns:minmax(0,1fr) clamp(320px,26vw,410px);gap:18px;align-items:stretch}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewPane{position:relative;top:auto;display:flex;flex-direction:column;justify-content:center;min-height:0;padding:12px 14px;border-color:rgba(99,230,255,.24);box-shadow:0 12px 36px rgba(0,0,0,.32)}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewHeader{font-size:11px;margin-bottom:8px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewHeader b{font-size:11px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewHeader span{font-size:10px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreview{width:auto;height:auto;max-width:min(100%,calc(100vh - 145px));max-height:calc(100vh - 145px);aspect-ratio:1/1;flex:0 1 auto}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewLegend{font-size:9px;margin-top:8px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls{align-self:center;width:100%;max-height:100%;overflow:auto;padding:2px 4px 2px 0}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls label{font-size:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls input,#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls select{padding:10px;font-size:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlBlock{padding:11px;margin-top:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlTitle{font-size:10px;margin-bottom:6px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigDirectionHelp{font-size:9px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigDirectionTabs{gap:5px;margin:8px 0 10px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigDirectionTabs button{padding:8px 3px;font-size:9px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigFineTuneActions button{padding:8px 5px;font-size:9px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlHelp{font-size:10px;padding:10px;margin-top:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigActions{margin-top:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigActions button{padding:10px}
@media(max-width:720px){#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen{padding:12px}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigWorkspace{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;gap:10px}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreview{max-width:min(100%,calc(100vh - 390px));max-height:calc(100vh - 390px)}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlBlock{margin-top:0}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlHelp{margin-top:0}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigActions{grid-column:1/-1;flex-direction:row;margin-top:0}}
@media(max-width:520px){#devPanel .devRigWorkspace{grid-template-columns:1fr}#devPanel .devRigPreviewPane{top:-2px}#devPanel .devRigPreview{width:min(100%,280px)}#devPanel .devRigControls{padding-top:2px}#devPanel .devRigActions{flex-direction:row}#devPanel .devRigTitleActions{width:100%;justify-content:space-between}#devPanel .devRigDirectionTabs{grid-template-columns:repeat(3,1fr)}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigIntro{display:none}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreview{max-width:min(100%,calc(100vh - 370px));max-height:calc(100vh - 370px)}}
`;document.head.appendChild(style);}
