# MiniGFS — Distributed File System Simulator

An immersive, dark-themed interactive web visualization of a Google File System (GFS)-inspired distributed storage engine. Designed as a developer portfolio showcase, it simulates cluster topology, consistent hashing, real-time read/write pipelines, node failure self-recovery, atomic record appends, and live performance metrics with procedural sound effects.

Built with zero heavy runtime dependencies using vanilla HTML5, CSS custom properties, and Canvas 2D.

---

## 1. System Architecture

The simulator models a classic asymmetric distributed storage design consisting of three primary logical entities:

### 1.1 Master Node
*   **Role**: The coordinator of the cluster namespace and metadata manager.
*   **Functionality**:
    *   Maintains the mapping of files to chunk handles.
    *   Tracks chunk locations across chunkservers.
    *   Coordinates chunk replication (3x target) and manages lease ownership for mutations.
    *   Monitors chunkserver health via periodic heartbeat protocols.
*   **Visual Representation**: Highlighted as a large electric blue (`#00D4FF`) hexagon at the top-center. Emits periodic heartbeat pulses along connection lines to every registered chunkserver.

### 1.2 Chunkservers
*   **Role**: Distributed storage engines.
*   **Functionality**:
    *   Store physical file chunks on local disk.
    *   Handle direct read and write requests from clients.
    *   Communicate metadata/heartbeat to the Master.
*   **Visual Representation**: Arranged in a curved arc below the Master, numbered `CS-01` through `CS-16`. Each node displays a dynamic storage utilization bar (showing used vs. 10 TB total).

### 1.3 Client Node
*   **Role**: The initiator of reads and writes.
*   **Functionality**:
    *   Queries the Master for chunk location metadata (control flow).
    *   Interacts directly with Chunkservers to read or pipeline write payloads (data flow), bypassing the Master to prevent network bottlenecks.
*   **Visual Representation**: Positioned on the left as a purple-bordered (`#A855F7`) rectangular terminal.

---

## 2. Core Interactive Scenes

The web interface is divided into distinct, interactive sections:

### Scene 1: System Boot Sequence
Simulates a classic terminal boot-up routine using a raw Javascript typewriter loop:
*   Initializes files, registers Master, discovers chunkservers, sets replication factor, starts heartbeats, and initializes the hash ring.
*   Includes typewriter audio feedback and a rising throughput counter.
*   Fades out to reveal the main dashboard once all services report `[OK]`.

### Scene 2: Live Network Topology Map (Centerpiece)
A real-time, canvas-driven network diagram simulating GFS operations:
*   **Hearts & Pulses**: Faint blue lines show heartbeat control paths. Thick green and amber lines show data pipelines.
*   **Operation 1 — File Write**: Client requests allocation → Master returns target nodes → Client streams data to CS-03 (Primary) → Primary replicates to CS-07 and CS-12 (Replicas) → Confirms 3x replicated status.
*   **Operation 2 — File Read & Prefetch**: Client queries Master → Reads from nearest replica → Parallel streams pre-load subsequent chunks to maximize aggregate throughput (reaching 2.1 GB/s).
*   **Operation 3 — Node Failure & Auto-Recovery**: `CS-07` heartbeat times out (turns red/grey) → Master detects loss → Selects replacement node (`CS-09`) → Remaining replicas copy data to `CS-09` → 3x replication restored.
*   **Interactive Panel**: Buttons to manual-trigger simulations, a slider to dynamically scale active node count (1 to 16), and a replication factor toggle (1x/2x/3x).

### Scene 3: Consistent Hashing Ring
Visualizes GFS data placement, maximizing stability and minimizing rebalancing during cluster scaling:
*   **The Ring**: A gradient ring containing primary chunkserver tokens and virtual nodes (3x multiplier per physical server to ensure uniform load distribution).
*   **Lookup & Routing**: Simulates incoming chunks hashed to a 0-2π ring location, moving clockwise to the nearest chunkserver token.
*   **Dynamic Scaling**: Add or remove nodes to see data redistributed. Shows a comparison log of remapped items (Consistent Hashing ~6% remapped vs. Traditional Modulo Hashing ~94% remapped).

### Scene 4: Performance Metrics Dashboard
A real-time developer monitor showing:
*   **Throughput Graph**: Live line chart showing aggregate read speeds.
*   **Fault Recovery Gauge**: Radial progress indicator showing recovery completes in <500ms (typically 487ms).
*   **Replication Heatmap**: Visualizes storage distribution stability.
*   **Operation Log**: Auto-scrolling terminal showing write, read, append, heartbeat, and replication logs.

### Scene 5: Atomic Record Append
Illustrates GFS's unique atomic data insertion mechanism:
*   Guides through the 4-step pipeline: Client Append → Pipeline Fan-out → Primary Offset Selection → Synchronized Replica ACK.
*   **Failure Scenario Toggle**: Simulates a write failure mid-append. Shows how the Primary issues an ABORT signal, rolls back changes, and prompts a client retry, guaranteeing eventual consistency.

---

## 3. Technology Stack & Implementation

*   **Vite**: Frontend development server for Hot Module Replacement (HMR).
*   **Canvas 2D API**: High-frequency rendering engine for topology network, hashing ring, metrics charts, and background data particles. Achieves 60 FPS.
*   **Vanilla CSS**: Structured design tokens, layout styles, scanline overlay, and responsive layouts.
*   **Web Audio API**: Synthesizes clean retro sound FX procedurally on-the-fly (no network requests for audio assets).

---

## 4. Local Setup

Ensure [Node.js](https://nodejs.org/) is installed.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the local address:
   ```
   http://localhost:5173/
   ```
4. Build production files:
   ```bash
   npm run build
   ```
