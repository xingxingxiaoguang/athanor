// Internal Canvas-order 2x3 helpers; public boundaries validate their operands.
export const transformPoint = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
export const transformVector = (m, p) => [m[0] * p[0] + m[2] * p[1], m[1] * p[0] + m[3] * p[1]];
