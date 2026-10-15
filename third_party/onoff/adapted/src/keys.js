// SPDX-License-Identifier: GPL-3.0-only
export const DOWN = new Set()
export const upKey = () => DOWN.has('jump')
export const leftKey = () => DOWN.has('left')
export const rightKey = () => DOWN.has('right')
export const clearKeys = () => DOWN.clear()
