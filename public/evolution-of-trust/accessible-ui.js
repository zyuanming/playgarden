// SPDX-License-Identifier: GPL-3.0-only
// A readable mobile view of the original DOM. Every action goes through the
// same control handler and gate as the animated scene; no simulation writes.
(function () {
  'use strict';
  var scene = document.getElementById('slideshow');
  var narrative = document.getElementById('mobile-narrative');
  var controls = document.getElementById('mobile-controls');
  var entries = new Map(), disposed = false, mobile = false;
  function visible(node) {
    if (!node.isConnected) return false;
    for (var p=node; p && p!==document.body; p=p.parentElement) {
      var s = getComputedStyle(p);
      if (s.display==='none' || s.visibility==='hidden' || Number(s.opacity)<0.5) return false;
    }
    return true;
  }
  function canAct(node) { return !disposed && !TrustLifecycle.isPaused() && !Scratcher.isTransitioning && visible(node); }
  function plain(node) { return node.textContent.replace(/\s+/g,' ').trim(); }
  function cleanHTML(node) {
    var clone=node.cloneNode(true);
    clone.removeAttribute('style'); clone.removeAttribute('id');
    clone.querySelectorAll('[style],[id]').forEach(function(n){n.removeAttribute('style');n.removeAttribute('id');});
    clone.querySelectorAll('a').forEach(function(n){n.removeAttribute('href');n.removeAttribute('target');});
    return clone.innerHTML;
  }
  function button(text, fn) { var b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b; }
  function make(node) {
    var row=document.createElement('div'), e={node:node,row:row,signature:''};
    row.className='mobile-row'; row.dataset.originalId=node.dataset.trustId || '';
    if(node.matches('.button')) {
      e.kind='button'; e.control=button('',function(){if(canAct(node)&&!node.hasAttribute('deactivated'))node.querySelector('#hitbox').click();});row.appendChild(e.control);
    } else if(node.matches('.slider')) {
      e.kind='slider'; e.label=document.createElement('label');e.control=document.createElement('input');
      var original=node.querySelector('input'); e.control.type='range';e.control.min=original.min;e.control.max=original.max;e.control.step=original.step;
      e.control.dataset.message=original.dataset.message;
      var slider=node.trustSlider;
      e.control.addEventListener('pointerdown',function(){if(canAct(node))slider.beginInput();});
      ['pointerup','pointercancel','lostpointercapture','blur','keyup','change'].forEach(function(type){e.control.addEventListener(type,slider.endInput);});
      e.control.addEventListener('keydown',function(){if(canAct(node))slider.beginInput();});
      e.control.addEventListener('input',function(){if(canAct(node)){slider.beginInput();slider.userValue(Number(e.control.value));}});
      e.label.appendChild(document.createElement('span'));e.label.appendChild(e.control);row.appendChild(e.label);
    } else if(node.matches('.incdec')) {
      e.kind='incdec';e.label=document.createElement('span');row.appendChild(e.label);
      e.down=button('−',function(){if(canAct(node))node.querySelector('[arrow=down]').click();});
      e.up=button('+',function(){if(canAct(node))node.querySelector('[arrow=up]').click();});row.append(e.down,e.up);
    } else if(node.matches('#sandbox_tabs > .hitbox')) {
      e.kind='tab';e.control=button(plain(node),function(){if(canAct(node))node.click();});row.appendChild(e.control);
    } else {e.kind='text';row.classList.add('mobile-copy');}
    (['button','tab'].includes(e.kind)?controls:narrative).appendChild(row);
    return e;
  }
  function sliderLabel(node) {
    var message=node.querySelector('input').dataset.message;
    var pop=node.closest('.sandbox_pop');
    if(pop)return plain(pop.querySelector('.sandbox_pop_label'))+'：'+node.dataset.value+' / 25';
    return ({'rules/turns':'每对玩家的回合数','rules/evolution':'每代淘汰并繁殖的人数','rules/noise':'失误概率'}[message]||'调整数值')+'：'+node.dataset.value;
  }
  function refresh() {
    if(disposed)return;
    var becomingMobile=!mobile&&window.innerWidth<760;
    mobile=window.innerWidth<760;
    document.body.classList.toggle('mobile-view',mobile);
    scene.setAttribute('aria-hidden',String(mobile));
    scene.querySelectorAll('button,input,[tabindex]').forEach(function(node){
      if(mobile){
        if(!node.hasAttribute('data-desktop-tabindex'))node.dataset.desktopTabindex=node.getAttribute('tabindex')===null?'default':node.getAttribute('tabindex');
        node.setAttribute('tabindex','-1');
      }else if(node.hasAttribute('data-desktop-tabindex')){
        if(node.dataset.desktopTabindex==='default')node.removeAttribute('tabindex');else node.setAttribute('tabindex',node.dataset.desktopTabindex);
        delete node.dataset.desktopTabindex;
      }
    });
    if(becomingMobile&&scene.contains(document.activeElement)&&document.activeElement.blur)document.activeElement.blur();
    document.getElementById('mobile-view').hidden=!mobile;
    var scale=Math.min(1,window.innerWidth/960);
    document.getElementById('slideshow_container').style.transform='scale('+scale+')';
    document.getElementById('main').style.height=(540*scale)+'px';
    // A control may be created later by an original gated callback; wait for it.
    var nodes=Array.from(scene.querySelectorAll('.textbox,.label,#scoreboard,.button,.slider,.incdec,#sandbox_tabs > .hitbox'));
    var found=new Set(nodes);
    entries.forEach(function(e,node){if(!found.has(node)){e.row.remove();entries.delete(node);}});
    nodes.forEach(function(node){
      var e=entries.get(node);if(!e){e=make(node);entries.set(node,e);}
      e.row.hidden=!visible(node);
      if(e.kind==='button'){
        e.control.textContent=plain(node.querySelector('#text'));
        e.control.disabled=!canAct(node)||node.hasAttribute('deactivated');
        e.control.setAttribute('data-control',node.dataset.trustId||e.control.textContent);
      }else if(e.kind==='tab'){e.control.disabled=!canAct(node);}
      else if(e.kind==='slider'){
        var label=sliderLabel(node);e.label.firstChild.textContent=label;e.control.setAttribute('aria-label',label.split('：')[0]);
        if(document.activeElement!==e.control)e.control.value=node.querySelector('input').value;
        e.control.disabled=!canAct(node);
      }else if(e.kind==='incdec'){
        var names={R:'双方合作',T:'背叛合作方的收益',S:'合作遇到背叛的收益',P:'双方背叛'};
        e.label.textContent=(names[node.dataset.payoff]||'收益')+'：'+plain(node.querySelector('.incdec_num'));
        e.down.setAttribute('aria-label',(names[node.dataset.payoff]||'收益')+' 减少');e.up.setAttribute('aria-label',(names[node.dataset.payoff]||'收益')+' 增加');
        e.down.disabled=e.up.disabled=!canAct(node);
      }else{
        var text=node.id==='scoreboard'?'本局得分 · 你 '+plain(node.children[0])+' : 对方 '+plain(node.children[1]):cleanHTML(node);
        if(e.signature!==text){e.row.innerHTML=text;e.signature=text;}
      }
    });
    document.body.dataset.slideIndex=window.slideshow?String(slideshow.slideIndex):'-1';
    document.body.dataset.transitioning=String(!!window.Scratcher&&Scratcher.isTransitioning);
  }
  // Stable DOM nodes preserve range dragging, keyboard focus and reader scroll.
  var timer=setInterval(refresh,100);
  window.addEventListener('resize',refresh);
  window.TrustUI={refresh:refresh,dispose:function(){disposed=true;clearInterval(timer);window.removeEventListener('resize',refresh);entries.clear();}};
  refresh();
})();
