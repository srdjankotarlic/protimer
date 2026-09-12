'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { BrowserWindow } = require('electron');

// Isolated renderer with deterministic service responses. The main smoke suite
// separately exercises the real LAN listener, QR encoder, OSC and phone commands.
module.exports = async function smokeNetworkUI() {
  const win = new BrowserWindow({ width:1120, height:900, show:false,
    webPreferences:{contextIsolation:true, partition:'network-ui-smoke'} });
  const js = code => win.webContents.executeJavaScript(code);
  const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const check = async (name, code) => {
    assert.equal(await js(`(async()=>{${code}})()`),true,name);
    console.log(name+'=true');
  };
  try {
    await win.loadFile(path.join(__dirname,'..','controller.html'));
    await js(`window.testInfo={running:true,ip:'192.0.2.10',addresses:[{ip:'192.0.2.10',name:'Wi-Fi'},{ip:'192.0.2.20',name:'Ethernet'}],port:7888,oscPort:7889,token:'test-only-key',clients:3};
      window.delay=ms=>new Promise(r=>setTimeout(r,ms));
      window.qrCalls=[]; window.outputCalls=[];
      api.qr=async url=>{qrCalls.push(url);return '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';};
      api.showOutputQr=async payload=>{outputCalls.push(payload);return true;};
      api.hideOutputQr=()=>applyOutputQrState(null);
      window.clipboardWrites=[];
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{clipboardWrites.push(value);}}});
      showNet(testInfo); document.querySelectorAll('#networkPanel details').forEach(d=>d.open=true);`);
    await check('NETWORK_LINK_ROLES_OK', `
      return netUrl==='http://192.0.2.10:7888'&&remoteUrl===netUrl+'/remote?t=test-only-key'&&
        backstageUrl===netUrl+'/backstage'&&apiUrl===netUrl+'/cmd?type=start&t=test-only-key'&&
        $('oscPortLabel').textContent==='7889'&&$('apiHost').textContent==='192.0.2.10'&&
        $('netConnections').textContent.includes(t('connectionHint'))&&
        [...document.querySelectorAll('.qrbtn')].every(b=>b.getAttribute('aria-label').includes(t('scanQr')));`);
    await check('NETWORK_COPY_ALL_LINKS_OK', `
      applyShare({url:'https://timer-test.example',provider:'cloudflare'});
      const duration=S.durationMs,running=S.running;
      for(const [id,linkId] of Object.entries(copyLinkIds)){
        $(id).click(); await delay(5);
        if(clipboardWrites.at(-1)!==networkLink(linkId)||!$('networkFeedback').textContent.startsWith(t('copySuccess')))return false;
      }
      return clipboardWrites.length===6&&S.durationMs===duration&&S.running===running;`);
    await check('NETWORK_COPY_FAILURE_OK', `
      navigator.clipboard.writeText=async()=>{throw new Error('denied');};
      $('btnCopyRemote').click(); await delay(5);
      return $('networkFeedback').textContent===t('copyFailed')&&!$('btnCopyRemote').disabled;`);
    await check('NETWORK_QR_ROLES_OK', `
      for(const id of ['netRemote','netUrl','netBackstage','netPublic','netPublicRemote']){
        const button=document.querySelector('[data-qr="'+id+'"]');button.click();await delay(5);
        const isAudience=!!button.dataset.audienceQr;
        if(qrCalls.at(-1)!==networkLink(id)||qrShownFor!==networkLink(id)||
          !!$('qrBox').querySelector('.audience-qr-action')!==isAudience||
          button.getAttribute('aria-expanded')!=='true'||$('qrBox').previousElementSibling!==button.closest('.network-role'))return false;
        if(isAudience){$('qrBox').querySelector('.audience-qr-action').click();await delay(5);
          if(outputCalls.at(-1).url!==networkLink(id))return false;}
        $('qrBox').querySelector('.qr-close').click();
        if(qrShownFor||button.getAttribute('aria-expanded')!=='false')return false;
      }
      $('btnHideOutputQr').click();return !audienceQrShownFor&&outputCalls.length===3;`);
    await check('NETWORK_QR_STALE_RESPONSE_OK', `
      const original=api.qr;let resolveQr;api.qr=()=>new Promise(r=>resolveQr=r);
      document.querySelector('[data-qr="netRemote"]').click();
      $('networkSel').value='192.0.2.20';$('networkSel').dispatchEvent(new Event('change'));
      resolveQr('<svg></svg>');await delay(5);api.qr=original;
      return !qrShownFor&&$('qrBox').style.display==='none'&&netUrl==='http://192.0.2.20:7888';`);
    await check('NETWORK_QR_FAILURE_OK', `
      const original=api.qr;api.qr=async()=>{throw new Error('encoder error');};
      document.querySelector('[data-qr="netRemote"]').click();await delay(5);api.qr=original;
      return !qrShownFor&&$('networkFeedback').textContent===t('qrFailed');`);
    await check('NETWORK_TOKEN_ROTATION_OK', `
      document.querySelector('[data-qr="netRemote"]').click();await delay(5);
      showNet({...testInfo,token:'new-test-key'});
      return !qrShownFor&&remoteUrl.endsWith('t=new-test-key')&&networkLink('netPublicRemote').endsWith('t=new-test-key');`);
    await check('NETWORK_AUDIENCE_QR_INVALIDATION_OK', `
      applyOutputQrState({url:netUrl+'/'});
      $('networkSel').value='192.0.2.10';$('networkSel').dispatchEvent(new Event('change'));
      if(audienceQrShownFor)return false;
      applyOutputQrState({url:publicUrl+'/'});applyShare({});
      return !audienceQrShownFor;`);
    await check('NETWORK_DIAGNOSTIC_STALE_RESPONSE_OK', `
      let resolveCheck;api.checkLocalNetwork=()=>new Promise(r=>resolveCheck=r);
      $('btnCheckLocal').click();if(!$('btnCheckLocal').disabled)return false;
      showNet({...testInfo,clients:4,token:'new-test-key'});if(!$('btnCheckLocal').disabled)return false;
      $('networkSel').value='192.0.2.20';$('networkSel').dispatchEvent(new Event('change'));
      resolveCheck({ok:true});await delay(5);
      return $('localCheckStatus').textContent===''&&!$('btnCheckLocal').disabled;`);
    await check('NETWORK_DIAGNOSTIC_RESULT_OK', `
      api.checkLocalNetwork=async()=>({ok:true});$('btnCheckLocal').click();await delay(5);
      if($('localCheckStatus').textContent!==t('localCheckOK'))return false;
      api.checkLocalNetwork=async()=>{throw new Error('unreachable');};$('btnCheckLocal').click();await delay(5);
      return $('localCheckStatus').textContent===t('localCheckFailed')&&!$('btnCheckLocal').disabled;`);
    await check('NETWORK_OFFLINE_NO_STALE_LINKS_OK', `
      applyShare({url:'https://timer-test.example',provider:'cloudflare'});
      document.querySelector('[data-qr="netPublic"]').click();await delay(5);showNet({running:false,addresses:[]});
      return !qrShownFor&&!netUrl&&!remoteUrl&&!backstageUrl&&!apiUrl&&$('publicRow').hidden&&$('publicRemoteSection').hidden&&
        Object.keys(copyLinkIds).every(id=>$(id).disabled)&&[...document.querySelectorAll('.qrbtn')].every(b=>b.disabled)&&$('btnCheckLocal').disabled;`);
    await check('NETWORK_ONLINE_CANCEL_RETRY_OK', `
      showNet(testInfo);applyShare({});window.shareMock={};let resolveStart;
      api.shareStart=()=>new Promise(r=>resolveStart=r);api.shareInfo=async()=>shareMock;
      api.shareStop=async()=>{shareMock={};applyShare({});};
      $('btnShare').click();if(!shareStarting||$('btnShare').textContent!==t('cancelSharing'))return false;
      $('btnShare').click();await delay(5);
      api.shareStart=async()=>{shareMock={url:'https://retry.example',provider:'cloudflare'};return shareMock;};
      $('btnShare').click();await delay(5);resolveStart({error:'cancelled'});await delay(5);
      if(publicUrl!=='https://retry.example'||!$('shareError').hidden)return false;
      document.querySelector('[data-qr="netPublicRemote"]').click();await delay(5);
      $('btnShare').click();await delay(5);
      return !publicUrl&&!shareStarting&&!qrShownFor&&$('netPublic').textContent==='—'&&$('publicRemoteSection').hidden;`);
    await check('NETWORK_ONLINE_FAILURE_OK', `
      api.shareStart=async()=>{shareMock={};throw new Error('offline');};$('btnShare').click();await delay(5);
      return !$('shareError').hidden&&!shareStarting&&!$('btnShare').disabled&&!!remoteUrl;`);
    for(const width of [820,1120]){
      win.setSize(width,900);
      for(const language of ['sr','en']){
        await js(`lang='${language}';applyLang();document.querySelectorAll('#networkPanel details').forEach(d=>d.open=true);applyShare({url:'https://a-very-long-tunnel-name-for-layout-test.example',provider:'cloudflare'});`);
        await delay(50);
        await check('NETWORK_REFLOW_'+width+'_'+language.toUpperCase()+'_OK', `
          const card=$('networkPanel'),bounds=card.getBoundingClientRect();
          return card.scrollWidth<=card.clientWidth+1&&[...card.querySelectorAll('button,select,.net-url')].filter(e=>e.getClientRects().length).every(e=>{
            const b=e.getBoundingClientRect();return b.left>=bounds.left-1&&b.right<=bounds.right+1&&e.scrollWidth<=e.clientWidth+1;
          });`);
      }
    }
  } finally { win.destroy(); }
};
