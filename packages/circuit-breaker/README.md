# Circuit Breaker / Health Gate Cube v0.1

Standalone native failure-isolation primitive.

## Contract

States:

`CLOSED -> OPEN -> HALF_OPEN -> CLOSED`

Failures classified by `isFailure(error)` count toward the opening threshold. After the deterministic cooldown expires, the breaker enters `HALF_OPEN` and admits at most `halfOpenMaxProbes` concurrent probes. Required successful probes close the circuit; a classified probe failure reopens it.

The cube is lifecycle-closable independently from the circuit state. `close()` stops new work; it does not rewrite the circuit state machine.

## No runtime dependencies

The cube uses ECMAScript/Node.js primitives only.
