// Per-vehicle tuning. Every value here is read by the physics controller, so
// new cars can be added just by adding another entry.

export const VEHICLES = {
  sports: {
    name: 'Neon GT',
    // Body
    mass: 1350,             // kg
    inertiaScale: 1.0,      // multiplies the computed yaw inertia
    length: 4.5, width: 2.0, // collision box (m)
    cgToFront: 1.25,        // m, center of gravity to front axle
    cgToRear: 1.35,         // m
    cgHeight: 0.45,         // m, drives weight transfer
    wheelRadius: 0.34,

    // Engine / drivetrain
    driveForce: 9800,       // N at low speed
    topSpeed: 64,           // m/s (~230 km/h)
    reverseForce: 5200,
    reverseTopSpeed: 14,
    engineBraking: 900,     // N when throttle released (in gear)

    // Brakes / resistance
    brakeForce: 15500,      // N
    handbrakeForce: 4200,   // N extra rear drag while handbrake is on
    rollingResistance: 220, // N
    dragCoefficient: 0.38,  // N per (m/s)^2

    // Tires
    gripFront: 1.5,         // friction coefficient (mu)
    gripRear: 1.75,         // > front = stable, slightly understeery like GTA
    corneringStiffnessFront: 90000, // N/rad
    corneringStiffnessRear: 100000,
    handbrakeGripScale: 0.45, // rear grip multiplier while handbrake held
    handbrakeAssist: 0.35,    // fraction of yaw assist kept during handbrake
    powerOversteer: 0.45,     // how much throttle eats rear lateral grip
    gripRecoveryRate: 1.6,    // per second, rear grip recovery after handbrake

    // Steering
    maxSteer: 0.62,           // rad at standstill
    steerSpeedFalloff: 0.08,  // higher = less steering at speed
    steerRate: 4.5,           // input smoothing toward target (per second)
    steerReturnRate: 6.5,

    // Arcade assists (0 = pure sim)
    yawDamping: 0.6,          // resists runaway spins
    stabilityAssist: 0.35,    // pulls yaw toward the driver's intended path
    maxDriftAngle: 1.05,      // rad, body slip angle soft limit

    // Air
    gravityScale: 1.6,
    landingGripLoss: 0.45,    // grip multiplier right after a hard landing
  },
  muscle: {
    name: 'Volt Muscle',
    mass: 1650, inertiaScale: 1.1, length: 4.8, width: 2.05,
    cgToFront: 1.35, cgToRear: 1.45, cgHeight: 0.5, wheelRadius: 0.36,
    driveForce: 11500, topSpeed: 58, reverseForce: 6000, reverseTopSpeed: 13, engineBraking: 1000,
    brakeForce: 16500, handbrakeForce: 4800, rollingResistance: 260, dragCoefficient: 0.45,
    gripFront: 1.35, gripRear: 1.5, corneringStiffnessFront: 95000, corneringStiffnessRear: 95000,
    handbrakeGripScale: 0.4, handbrakeAssist: 0.3, powerOversteer: 0.6, gripRecoveryRate: 1.3,
    maxSteer: 0.58, steerSpeedFalloff: 0.085, steerRate: 4, steerReturnRate: 6,
    yawDamping: 0.5, stabilityAssist: 0.3, maxDriftAngle: 1.15,
    gravityScale: 1.6, landingGripLoss: 0.4,
  },
};

export const DEFAULT_VEHICLE = 'sports';
