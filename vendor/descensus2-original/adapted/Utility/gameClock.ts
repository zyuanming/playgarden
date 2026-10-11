// Playgarden GPL-3.0-only: active physics time, frozen by menus, pause and visibility.
let elapsed = 0;
export default { now: () => elapsed, advance: (delta: number) => { elapsed += delta; }, reset: () => { elapsed = 0; } };
