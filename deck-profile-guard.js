'use strict';
// The SDK does not reveal arbitrary active profile names. A return request is
// permitted only for the unchanged own action lifecycle following our manual
// switch. Any subsequent page/profile/USB change revokes this conservative lease.
function createProfileGuard({now=()=>Date.now()}={}) {
  let pending=null,lease=null;
  const stamp=(inventory,id)=>JSON.stringify((inventory.actions||[]).filter(a=>a.deviceId===id).map(a=>a.context).sort());
  return {
    request(inventory,deviceId,sessionId){lease=null;pending={deviceId,sessionId,before:stamp(inventory,deviceId),version:inventory.visibilityVersion,until:now()+30000,accepted:false};},
    acknowledge(ok){if(!ok)pending=null;else if(pending)pending.accepted=true;},
    reset(){pending=null;lease=null;},
    observe(inventory,sessionId,connected){
      if(!connected){pending=null;lease=null;return false;}
      if(lease&&(sessionId!==lease.sessionId||inventory.visibilityVersion!==lease.version||stamp(inventory,lease.deviceId)!==lease.contexts))lease=null;
      if(pending&&(now()>pending.until||sessionId!==pending.sessionId))pending=null;
      if(pending?.accepted&&Number.isSafeInteger(inventory.visibilityVersion)&&inventory.visibilityVersion>pending.version&&
          (inventory.actions||[]).filter(a=>a.deviceId===pending.deviceId).length===32&&stamp(inventory,pending.deviceId)!==pending.before){
        lease={deviceId:pending.deviceId,sessionId,version:inventory.visibilityVersion,contexts:stamp(inventory,pending.deviceId)};pending=null;
      }
      return !!lease;
    }
  };
}
module.exports={createProfileGuard};
