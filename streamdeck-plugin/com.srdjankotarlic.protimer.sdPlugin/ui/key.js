/* Official Property Inspector websocket protocol; this never executes actions. */
'use strict';
const $=id=>document.getElementById(id);
const commands=['empty','startPause','start','pause','resume','startSet','activeTime','setTime','editTarget','reset','bell','adjust','preset','enterTime','countdown','countup','clock','clearSet','blackout','outputA','outputB','selectTimer','message','settings','back','prev','next','loadSelected','fullscreen','mirror'];
for(const command of commands){const option=document.createElement('option');option.value=command;option.textContent=command;$('command').append(option);}
let socket,context,settings={};
function display(){const key=settings.key||{};for(const name of ['command','timerId','target','name','step','unit','color','textSize','pressPolicy'])if(key[name]!==undefined)$(name).value=String(key[name]);const seconds=Math.floor((key.durationMs||300000)/1000);$('duration').value=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');$('linked').checked=!!settings.layoutId;$('layoutId').value=settings.layoutId||'';$('slotId').value=settings.slotId||'';}
window.connectElgatoStreamDeckSocket=function(port,uuid,registerEvent,info,actionInfo){
  if(!/^\d+$/.test(String(port)))return;context=uuid;const action=JSON.parse(actionInfo);settings=action.payload.settings||{};display();
  socket=new WebSocket(`ws://127.0.0.1:${Number(port)}`);socket.onopen=()=>socket.send(JSON.stringify({event:registerEvent,uuid}));
  socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.event==='didReceiveSettings'){settings=message.payload.settings||{};display();}}catch{}};
};
$('form').addEventListener('submit',event=>{event.preventDefault();if(socket?.readyState!==WebSocket.OPEN){$('status').textContent='Elgato connection unavailable.';return;}
  const duration=$('duration').value.match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/);if(!duration){$('status').textContent='Use HH:MM:SS (maximum 99:59:59).';return;}
  const step=Number($('step').value);if(!Number.isSafeInteger(step)||Math.abs(step)>360000){$('status').textContent='Invalid whole-number step.';return;}
  const key={id:settings.key?.id||crypto.randomUUID(),command:$('command').value,timerId:$('timerId').value,target:$('target').value,name:$('name').value.trim(),step,unit:$('unit').value,durationMs:(Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]))*1000,color:$('color').value,textSize:Math.max(12,Math.min(28,Number($('textSize').value)||23)),pressPolicy:$('pressPolicy').value};
  if($('linked').checked&&(!/^[\w-]{1,80}$/.test($('layoutId').value)||!/^[\w-]{1,80}$/.test($('slotId').value))){$('status').textContent='Copy valid layout and slot IDs from Control.';return;}
  const validated=DeckLayout.validateKey(key);if(!validated.ok){$('status').textContent=validated.errors.join(' ');return;}
  settings={instanceId:settings.instanceId||crypto.randomUUID(),key:validated.key,...($('linked').checked?{layoutId:$('layoutId').value,slotId:$('slotId').value}:{})};
  socket.send(JSON.stringify({event:'setSettings',context,payload:settings}));$('status').textContent='Settings sent to Elgato. No timer command was run.';
});
