// Local output assignments shared by Control and the Electron main process.
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./timer-tools'));
  else root.AudienceRoutes=factory(root.TimerTools);
})(globalThis,function(TimerTools){
  const views=Object.freeze(Object.keys(TimerTools.groups));
  const backgrounds=Object.freeze({standard:null,luma:'#000000',green:'#00ff00',blue:'#0000ff'});
  function assignment(value){
    if(!value||!Number.isSafeInteger(value.displayId)||typeof value.label!=='string'||!value.label||
      value.label.length>250||!views.includes(value.view)||typeof value.background!=='string'||!Object.hasOwn(backgrounds,value.background)||
      !['fullscreen','window'].includes(value.presentation)||
      (value.split!==undefined&&!['columns','rows'].includes(value.split))) return null;
    const {displayId,label,view,background,presentation}=value;
    return {displayId,label,view,background,presentation,...(value.split&&{split:value.split})};
  }
  function displayFor(route,displays){
    return displays.find(display=>display.id===route.displayId&&display.label===route.label);
  }
  function available(state,view){
    return views.includes(view)&&TimerTools.groups[view].every(id=>TimerTools.timerEnabled(state,id));
  }
  function placementTimer(state,route){
    const id=TimerTools.groups[route.view].find(id=>TimerTools.timerEnabled(state,id));
    return TimerTools.timerFor(state,id)||state;
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
      if(!available(state,route.view)) return {ok:false,code:'TIMER_DISABLED',label:route.label};
    }
    return {ok:true,routes};
  }
  function project(state,route){
    const keyColor=backgrounds[route.background];
    const projected=TimerTools.projectTimers({...state,separateOutputs:false,
      freeAudience:!route.split&&state.freeAudience,dualSplit:route.split||state.dualSplit},TimerTools.groups[route.view]);
    return {...projected,fitWindow:false,
      gridOn:route.presentation==='window'&&placementTimer(state,route).gridOn,
      transparent:false,outputKeyColor:keyColor,
      ...(keyColor&&{bgColor:keyColor,fgColor:'#ffffff',text:'',textOnly:false,message:null,
        showProgress:false,showNowNext:false,blackoutMode:'foreground'})};
  }
  return {views,backgrounds,assignment,displayFor,available,placementTimer,plan,project};
});
