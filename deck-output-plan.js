'use strict';
// Validated presentation intent only. This never reads or writes timer clocks.
function livePlan(state, request, displays) {
  if (!request || !['t1', 't2', 'both'].includes(request.view) ||
      !['auto', 'fullscreen', 'window'].includes(request.mode)) return {ok:false,code:'INVALID_LIVE_OUTPUT'};
  if (request.view !== 't1' && !state?.dualTimer) return {ok:false,code:'TIMER_DISABLED',message:'Enable Timer 2 in Control first.'};
  const separate = !!(state?.dualTimer && state.separateOutputs);
  const roles = separate ? request.view === 'both' ? ['primary','secondary'] : [request.view === 't2' ? 'secondary' : 'primary'] : ['primary'];
  const outputs = roles.map(role => {
    const id = role === 'secondary' ? request.secondaryDisplayId : request.displayId;
    const grid = role === 'secondary' ? state.secondary?.gridOn : state?.gridOn;
    return {role,displayId:id,presentation:request.mode === 'auto' ? grid ? 'window' : 'fullscreen' : request.mode};
  });
  if (outputs.some(output => !displays.some(display => display.id === output.displayId)))
    return {ok:false,code:'DISPLAY_NOT_CONNECTED',message:'Select a connected display in Control.'};
  if (outputs.length === 2 && outputs[0].displayId === outputs[1].displayId)
    return {ok:false,code:'SAME_DISPLAY',message:'Choose two different displays, or Together on one screen in Control.'};
  return {ok:true,outputs,close:separate&&request.view!=='both'?[request.view==='t1'?'secondary':'primary']:[]};
}
module.exports = {livePlan};
