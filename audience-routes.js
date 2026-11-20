// Local output assignments shared by Control and the Electron main process.
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./timer-tools'));
  else root.AudienceRoutes=factory(root.TimerTools);
})(globalThis,function(TimerTools){
  const views=Object.freeze(['t1','t2','both']);
  const backgrounds=Object.freeze({standard:null,luma:'#000000',green:'#00ff00',blue:'#0000ff'});
  function assignment(value){
    if(!value||!Number.isSafeInteger(value.displayId)||typeof value.label!=='string'||!value.label||
      value.label.length>250||!views.includes(value.view)||typeof value.background!=='string'||!Object.hasOwn(backgrounds,value.background)||
      !['fullscreen','window'].includes(value.presentation)) return null;
    const {displayId,label,view,background,presentation}=value;
    return {displayId,label,view,background,presentation};
  }
  function displayFor(route,displays){
    return displays.find(display=>display.id===route.displayId&&display.label===route.label);
  }
  function plan(values,displays,state,occupied){
    if(!Array.isArray(values)||!values.length||values.length>64) return {ok:false,code:'NO_ROUTES'};
    const routes=values.map(assignment);
    if(routes.includes(null)||new Set(routes.map(route=>route.displayId)).size!==routes.length)
      return {ok:false,code:'INVALID_ROUTES'};
    for(const route of routes){
      const target=displayFor(route,displays);
      if(!target) return {ok:false,code:'DISPLAY_NOT_CONNECTED',label:route.label};
      if(occupied.has(target.id)) return {ok:false,code:'STANDARD_OUTPUT_OPEN',label:route.label};
      if(route.view!=='t1'&&!state?.dualTimer) return {ok:false,code:'TIMER_DISABLED',label:route.label};
    }
    return {ok:true,routes};
  }
  function project(state,route){
    const keyColor=backgrounds[route.background];
    const enabled=state.dualTimer||route.view==='t1';
    // Keep the authoritative timers and project each output independently of
    // the legacy LIVE selection, including when separate outputs are enabled.
    const projected=TimerTools.audienceState({...state,separateOutputs:false,liveTimerView:route.view});
    return {...projected,liveHidden:!enabled,fitWindow:false,
      gridOn:route.presentation==='window'&&(route.view==='t2'?state.secondary?.gridOn:state.gridOn),
      transparent:false,outputKeyColor:keyColor,
      ...(keyColor&&{bgColor:keyColor,fgColor:'#ffffff',text:'',textOnly:false,message:null,
        showProgress:false,showNowNext:false,blackoutMode:'foreground'})};
  }
  return {views,backgrounds,assignment,displayFor,plan,project};
});
