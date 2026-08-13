import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { treeStage } from "@/lib/forest";
import type { FocusSessionDoc } from "@/lib/schema";

/**
 * A live 3D study forest. Every focus session plants a tree on a spiral plot:
 * short sessions sprout, 50-minute sessions grow, 90+ minute sessions become
 * gold milestone trees, and abandoned sessions stay as wilted stumps. Trees
 * grow in on load and hover highlights show what a session earned.
 */

type StageKey = "wilted" | "sprout" | "tree" | "big-tree" | "milestone";

const STAGE_STYLE: Record<StageKey, { scale: number; color: number }> = {
  wilted: { scale: 0.45, color: 0x9a7b4f },
  sprout: { scale: 0.62, color: 0x83c96f },
  tree: { scale: 1.0, color: 0x3e9b5e },
  "big-tree": { scale: 1.45, color: 0x2f7d4a },
  milestone: { scale: 1.38, color: 0xd9a441 },
};

const STAGE_LABEL: Record<StageKey, string> = {
  wilted: "Wilted (left early)",
  sprout: "Sprout (< 25 min)",
  tree: "Tree (25–50 min)",
  "big-tree": "Big tree (50+ min)",
  milestone: "Milestone (90+ min)",
};

function stageOf(session: FocusSessionDoc & { id: string }): StageKey {
  const stage = treeStage(session);
  if (session.focusMinutes >= 90) return "milestone";
  if (stage === "wilted") return "wilted";
  if (stage === "sprout") return "sprout";
  if (stage === "tree") return "tree";
  return "big-tree";
}

/** Stacked-cone conifer — the silhouette of every tree in the forest. */
function makeFoliageGeometry(): THREE.BufferGeometry {
  const cone = (radius: number, height: number, y: number) => {
    const g = new THREE.ConeGeometry(radius, height, 8);
    g.translate(0, y, 0);
    return g;
  };
  const merged = mergeGeometries([
    cone(0.95, 1.7, 0.85),
    cone(0.72, 1.4, 2.0),
    cone(0.5, 1.2, 3.05),
  ]);
  merged.computeVertexNormals();
  return merged;
}

function makeGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "#7ecf5f");
  g.addColorStop(0.55, "#5cb84c");
  g.addColorStop(1, "#3f8f3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const shade = 40 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${shade},${120 + Math.floor(Math.random() * 50)},${40 + Math.floor(Math.random() * 30)},0.22)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "#4f8fd6");
  g.addColorStop(0.55, "#a7cde8");
  g.addColorStop(1, "#d6ecf5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function ForestScene({
  sessions,
  hovered,
  onHover,
  onTip,
}: {
  sessions: (FocusSessionDoc & { id: string })[];
  hovered: number | null;
  onHover: (id: number | null) => void;
  onTip: (tip: { x: number; y: number } | null) => void;
}) {
  const foliageRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const cameraTarget = useRef(new THREE.Vector3(0, 5.6, 16));

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const layout = useMemo(() => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const spacing = 1.35;
    return sessions.map((session, i) => {
      const stage = stageOf(session);
      const style = STAGE_STYLE[stage];
      const radius = Math.sqrt(i + 1) * spacing;
      const angle = i * golden;
      const jitter = (Math.random() - 0.5) * 0.7;
      return {
        session,
        stage,
        x: Math.cos(angle) * radius + jitter,
        z: Math.sin(angle) * radius + jitter,
        yaw: Math.random() * Math.PI * 2,
        scale: style.scale,
        color: style.color,
        birth: performance.now() + Math.min(i * 28, 1000),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, sessions]);

  const baseColor = useMemo(() => new THREE.Color(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  const updateTreeMatrices = (now: number) => {
    const mesh = foliageRef.current;
    if (!mesh) return;
    for (let i = 0; i < layout.length; i++) {
      const item = layout[i];
      const grow = easeOutCubic(Math.min(1, Math.max(0, (now - item.birth) / 700)));
      const isHovered = i === hovered;
      const s = item.scale * (0.2 + 0.8 * grow) * (isHovered ? 1.22 : 1);
      euler.set(0, item.yaw, 0);
      quat.setFromEuler(euler);
      pos.set(item.x, 0, item.z);
      scl.set(s, s, s);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
      if (trunkRef.current) {
        trunkRef.current.setMatrixAt(i, matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
  };

  useFrame(({ clock, camera, pointer }) => {
    const t = clock.elapsedTime;
    const mesh = foliageRef.current;
    if (!mesh) return;

    if (!reducedMotion && groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.035) * 0.14;
    }

    // Gentle pointer parallax — the camera leans toward where you look.
    if (!reducedMotion) {
      cameraTarget.current.x += (pointer.x * 1.4 - cameraTarget.current.x) * 0.04;
      cameraTarget.current.y += (5.6 - pointer.y * 0.9 - cameraTarget.current.y) * 0.04;
      camera.position.lerp(cameraTarget.current, 0.05);
      camera.lookAt(0, 2.2, 0);
    }

    // Only update the per-tree matrices while trees are still growing in, or
    // when a tree is hovered — otherwise the instanced meshes stay put and the
    // per-frame loop costs nothing.
    if (layout.length === 0) return;
    const lastBirth = layout[layout.length - 1].birth;
    if (hovered === null && performance.now() > lastBirth + 700) return;
    updateTreeMatrices(performance.now());
  });

  const applyColors = (index: number | null) => {
    const mesh = foliageRef.current;
    if (!mesh) return;
    for (let i = 0; i < layout.length; i++) {
      const c = i === index ? 0xffe9a8 : layout[i].color;
      baseColor.setHex(c);
      mesh.setColorAt(i, baseColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const id = e.instanceId ?? null;
    if (id !== hovered) {
      onHover(id);
      applyColors(id);
    }
    onTip({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };

  const handleLeave = () => {
    onHover(null);
    applyColors(null);
    onTip(null);
  };

  // Paint every tree its stage color once the instanced mesh exists (and again
  // whenever the session list changes, so new trees aren't left white).
  useLayoutEffect(() => {
    applyColors(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.length, sessions]);

  // When hover starts/ends after growth has finished, the frame loop is
  // already idle — force one matrix update so the hover scale applies/restores.
  useLayoutEffect(() => {
    if (layout.length === 0) return;
    updateTreeMatrices(performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, layout.length]);

  const groundTex = useMemo(makeGroundTexture, []);
  const skyTex = useMemo(makeSkyTexture, []);
  const foliageGeo = useMemo(makeFoliageGeometry, []);
  const trunkGeo = useMemo(
    () => {
      const g = new THREE.CylinderGeometry(0.14, 0.2, 1.0, 6);
      g.translate(0, 0.5, 0);
      return g;
    },
    []
  );

  return (
    <>
      <fog attach="fog" args={["#c2ddef", 22, 70]} />
        <hemisphereLight args={["#ffffff", "#7cbf6a", 0.95]} />
        <directionalLight position={[12, 18, 8]} intensity={1.25} color="#fff2d0" />
        <ambientLight intensity={0.3} />

        {/* sky dome + sun */}
        <mesh scale={140}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial map={skyTex} side={THREE.BackSide} fog={false} depthWrite={false} />
        </mesh>
        <mesh position={[16, 15, -14]}>
          <sphereGeometry args={[2.4, 24, 24]} />
          <meshBasicMaterial color="#fff3c4" fog={false} />
        </mesh>
        <mesh position={[16, 15, -14]}>
          <sphereGeometry args={[3.6, 24, 24]} />
          <meshBasicMaterial color="#fff3c4" transparent opacity={0.22} fog={false} />
        </mesh>

        {/* ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[42, 48]} />
          <meshStandardMaterial map={groundTex} roughness={1} />
        </mesh>

        {/* trees */}
        <group ref={groupRef}>
          <instancedMesh
            ref={trunkRef}
            args={[trunkGeo, undefined, layout.length]}
          >
            <meshStandardMaterial color="#6b4c2b" roughness={0.95} />
          </instancedMesh>
          <instancedMesh
            ref={foliageRef}
            args={[foliageGeo, undefined, layout.length]}
            onPointerMove={handleMove}
            onPointerOut={handleLeave}
            onPointerMissed={handleLeave}
          >
            <meshStandardMaterial roughness={0.85} />
          </instancedMesh>

          {/* bushes + rocks for depth */}
          <Bushes seed={sessions.length} />
        </group>
    </>
  );
}

function Bushes({ seed }: { seed: number }) {
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(() => {
    const items = Array.from({ length: 16 }, () => {
      const angle = Math.random() * Math.PI * 2 + seed;
      const radius = 5 + Math.random() * 14;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        s: 0.5 + Math.random() * 0.7,
        yaw: Math.random() * Math.PI * 2,
      };
    });
    const rocks = Array.from({ length: 7 }, () => ({
      x: (Math.random() - 0.5) * 24,
      z: (Math.random() - 0.5) * 24,
      s: 0.2 + Math.random() * 0.3,
      yaw: Math.random() * Math.PI * 2,
    }));
    return { items, rocks };
  }, [seed]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Euler(), []);

  useLayoutEffect(() => {
    if (bushRef.current) {
      layout.items.forEach((item, i) => {
        e.set(0, item.yaw, 0);
        q.setFromEuler(e);
        p.set(item.x, 0.25, item.z);
        sc.set(item.s, item.s, item.s);
        m.compose(p, q, sc);
        bushRef.current!.setMatrixAt(i, m);
      });
      bushRef.current.instanceMatrix.needsUpdate = true;
    }
    if (rockRef.current) {
      layout.rocks.forEach((item, i) => {
        e.set(0, item.yaw, 0);
        q.setFromEuler(e);
        p.set(item.x, 0.14, item.z);
        sc.set(item.s, item.s * 0.7, item.s);
        m.compose(p, q, sc);
        rockRef.current!.setMatrixAt(i, m);
      });
      rockRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [layout]);

  return (
    <>
      <instancedMesh ref={bushRef} args={[undefined, undefined, layout.items.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2f7d4a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={rockRef} args={[undefined, undefined, layout.rocks.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8b8b84" roughness={1} />
      </instancedMesh>
    </>
  );
}

export default function ForestCanvas({
  sessions,
}: {
  sessions: (FocusSessionDoc & { id: string })[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const hoveredSession = hovered !== null ? sessions[hovered] : null;

  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl border border-border">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 5.6, 16], fov: 45 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setClearColor("#bcd9ec")}
        style={{ position: "absolute", inset: 0 }}
      >
        <ForestScene
          sessions={sessions}
          hovered={hovered}
          onHover={setHovered}
          onTip={setTip}
        />
      </Canvas>

      <div
        className="pointer-events-none fixed z-50 max-w-[220px] rounded-lg border border-border bg-surface/95 px-3 py-2 text-xs shadow-e2 backdrop-blur"
        style={{
          left: (tip?.x ?? 0) + 12,
          top: (tip?.y ?? 0) + 12,
          display: tip ? "block" : "none",
        }}
      >
        {hoveredSession && hovered !== null && (
          <>
            <p className="truncate font-medium text-text-primary">
              {hoveredSession.subjectName ?? "Focus session"}
            </p>
            <p className="mt-0.5 text-text-secondary">
              {hoveredSession.focusMinutes} min · {hoveredSession.date}
            </p>
            <p className="mt-0.5 text-brand-600 dark:text-brand-500">
              {STAGE_LABEL[stageOf(hoveredSession)]}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
