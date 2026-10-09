// SPDX-License-Identifier: GPL-3.0-only
// No remote renderer. The upstream-matching, pinned Three.js r128 powers the scene.
export function createPlaygardenRenderer(THREE){
 try{
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  window.PG_RENDERER='webgl';return renderer;
 }catch(error){
  // Simulation, topology editing and campaign conditions do not depend on WebGL.
  window.PG_RENDERER='diagram';window.PG_RENDERER_REASON=String(error?.message||error);
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  return {domElement:canvas,shadowMap:{enabled:false},setSize(w,h){canvas.width=w;canvas.height=h;},render(){},dispose(){}};
 }
}
