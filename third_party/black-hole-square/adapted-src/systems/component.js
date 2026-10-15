// Original: Copyright (c) 2021 Quinten Clause, MIT.
// Playgarden static registry/lifecycle changes: GPL-3.0-only.
import arrowdown from '../components/arrowdown.json';
import arrowleft from '../components/arrowleft.json';
import arrowright from '../components/arrowright.json';
import arrowup from '../components/arrowup.json';
import bgcut from '../components/bgcut.json';
import blackhole from '../components/blackhole.json';
import blanksquare from '../components/blanksquare.json';
import canvas from '../components/canvas.json';
import fillrect from '../components/fillrect.json';
import home from '../components/home.json';
import levels from '../components/levels.json';
import maintitle from '../components/maintitle.json';
import mask from '../components/mask.json';
import neutronstar from '../components/neutronstar.json';
import pointer from '../components/pointer.json';
import position from '../components/position.json';
import progress from '../components/progress.json';
import puzzle from '../components/puzzle.json';
import size from '../components/size.json';
import state from '../components/state.json';
import statemachine from '../components/statemachine.json';
import text from '../components/text.json';
import tunnel from '../components/tunnel.json';
import xsquare from '../components/xsquare.json';
const components={arrowdown,arrowleft,arrowright,arrowup,bgcut,blackhole,blanksquare,canvas,fillrect,home,levels,maintitle,mask,neutronstar,pointer,position,progress,puzzle,size,state,statemachine,text,tunnel,xsquare};

let add = (entity, component) => {
    entity[component] = JSON.parse(
        JSON.stringify(
            components[component]
        )
    );
    return entity;
};

export default Object.freeze({
    add
});
