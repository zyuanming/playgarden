// Original: Copyright (c) 2021 Quinten Clause, MIT.
// Playgarden static registry/lifecycle changes: GPL-3.0-only.
import draws_arrowdown from './draws/arrowdown.js';
import draws_arrowleft from './draws/arrowleft.js';
import draws_arrowright from './draws/arrowright.js';
import draws_arrowup from './draws/arrowup.js';
import draws_bgcut from './draws/bgcut.js';
import draws_blackhole from './draws/blackhole.js';
import draws_blanksquare from './draws/blanksquare.js';
import draws_fillrect from './draws/fillrect.js';
import draws_maintitle from './draws/maintitle.js';
import draws_neutronstar from './draws/neutronstar.js';
import draws_progress from './draws/progress.js';
import draws_text from './draws/text.js';
import draws_tunnel from './draws/tunnel.js';
import draws_xsquare from './draws/xsquare.js';
import transforms_mask from './transforms/mask.js';
import transforms_position from './transforms/position.js';
const draws={arrowdown:draws_arrowdown,arrowleft:draws_arrowleft,arrowright:draws_arrowright,arrowup:draws_arrowup,bgcut:draws_bgcut,blackhole:draws_blackhole,blanksquare:draws_blanksquare,fillrect:draws_fillrect,maintitle:draws_maintitle,neutronstar:draws_neutronstar,progress:draws_progress,text:draws_text,tunnel:draws_tunnel,xsquare:draws_xsquare};
const transforms={mask:transforms_mask,position:transforms_position};

let process = (entities, ids, ctx, time, delta) => {
    ids.forEach(id => {
        let entity = entities[id];
        ctx.save();
        ctx.scale(
            entities.game.canvas.zoom,
            entities.game.canvas.zoom
        );
        Object.keys(entity).forEach(component => {
            if (transforms[component] !== undefined) {
                transforms[component].transform(entities, entity, ctx, time, delta);
            }
        });
        Object.keys(entity).forEach(component => {
            if (draws[component] !== undefined) {
                draws[component].draw(entities, entity, ctx, time, delta);
            }
        });
        ctx.restore();
    });
};

export default Object.freeze({
    process
});
