"use client";

import React, { useEffect, useRef } from "react";
import type { Mesh, WebGLRenderer } from "three";

export function BasketballArena({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let disposed = false;

    (async () => {
      const THREE = await import("three");

      if (disposed) return;

      const W = canvas.clientWidth || 480;
      const H = canvas.clientHeight || 360;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(W, H, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();

      const aspect = W / H;
      const d = 14;
      const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 200);
      camera.position.set(20, 20, 20);
      camera.lookAt(0, 0, 0);

      // ── Lights ──────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));

      const sun = new THREE.DirectionalLight(0xfff8f0, 1.1);
      sun.position.set(15, 25, 10);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 100;
      sun.shadow.camera.left = -25;
      sun.shadow.camera.right = 25;
      sun.shadow.camera.top = 25;
      sun.shadow.camera.bottom = -25;
      scene.add(sun);

      const fill = new THREE.DirectionalLight(0xb0d4ff, 0.35);
      fill.position.set(-10, 10, -5);
      scene.add(fill);

      // ── Helpers ─────────────────────────────────────────────────────────────
      function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({ color }),
        );
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
      }

      // ── Platform ─────────────────────────────────────────────────────────────
      box(22, 0.6, 14, 0x1a1a1a, 0, -0.3, 0);

      // Orange band
      box(22, 0.5, 0.4, 0xff8c00, 0, 0.25, 7.2);
      box(22, 0.5, 0.4, 0xff8c00, 0, 0.25, -7.2);
      box(0.4, 0.5, 14, 0xff8c00, 11.1, 0.25, 0);
      box(0.4, 0.5, 14, 0xff8c00, -11.1, 0.25, 0);

      // ── Court ────────────────────────────────────────────────────────────────
      box(14, 0.15, 8.5, 0xd4780a, 0, 0.375, 0);

      const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

      // Center line
      const cl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 8.5), lineMat);
      cl.position.set(0, 0.46, 0);
      scene.add(cl);

      // Center circle
      const cc = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 4, 32), lineMat);
      cc.rotation.x = Math.PI / 2;
      cc.position.set(0, 0.46, 0);
      scene.add(cc);

      // Keys
      for (const sx of [-1, 1]) {
        const kx = sx * 5;
        const km = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 3.2), lineMat);
        km.position.set(kx, 0.46, 0);
        scene.add(km);

        const kt = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.02, 0.07), lineMat);
        kt.position.set(sx * 6.2, 0.46, 0);
        scene.add(kt);

        for (const sz of [-1, 1]) {
          const kb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 1.6), lineMat);
          kb.position.set(kx, 0.46, sz * 1.6);
          scene.add(kb);
        }

        // 3pt arc
        const arc = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.055, 4, 32, Math.PI), lineMat);
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = sx === -1 ? Math.PI / 2 : -Math.PI / 2;
        arc.position.set(sx * 6.8, 0.46, 0);
        scene.add(arc);
      }

      // ── Bleachers ────────────────────────────────────────────────────────────
      const tierColors = [0xcc4400, 0xaa3300, 0x882800, 0x662200];
      for (let i = 0; i < 4; i++) {
        box(22 - i * 0.6, 0.55, 1.1, tierColors[i], 0, 0.6 + i * 0.55, 4.9 + i * 1.1);
        box(22 - i * 0.6, 0.55, 1.1, tierColors[i], 0, 0.6 + i * 0.55, -4.9 - i * 1.1);
        box(1.1, 0.55, 8.5 + i * 0.6, tierColors[i], -7.8 - i * 1.1, 0.6 + i * 0.55, 0);
        box(1.1, 0.55, 8.5 + i * 0.6, tierColors[i], 7.8 + i * 1.1, 0.6 + i * 0.55, 0);
      }

      // ── Seats (top tier) ────────────────────────────────────────────────────
      const seatCols = [0xff6600, 0xe65100, 0xff8c00, 0xcc4400];
      for (let i = -4; i <= 4; i++) {
        box(0.9, 0.35, 0.8, seatCols[Math.abs(i) % 4], i * 2.1, 2.95, 9.5);
        box(0.9, 0.35, 0.8, seatCols[(Math.abs(i) + 2) % 4], i * 2.1, 2.95, -9.5);
      }
      for (let i = -2; i <= 2; i++) {
        box(0.8, 0.35, 0.9, seatCols[Math.abs(i) % 4], -12.3, 2.95, i * 1.8);
        box(0.8, 0.35, 0.9, seatCols[(Math.abs(i) + 1) % 4], 12.3, 2.95, i * 1.8);
      }

      // ── Pillars ──────────────────────────────────────────────────────────────
      for (const pz of [8.8, -8.8]) {
        for (const px of [-9, -5, -1, 3, 7, 9]) {
          box(0.9, 3.2, 0.9, 0x2e7d32, px, 1.85, pz);
          box(1.1, 0.35, 1.1, 0x4caf50, px, 3.55, pz);
        }
      }
      for (const px of [-11.5, 11.5]) {
        for (const pz of [-6, -3, 0, 3, 6]) {
          box(0.9, 3.2, 0.9, 0x2e7d32, px, 1.85, pz);
          box(1.1, 0.35, 1.1, 0x4caf50, px, 3.55, pz);
        }
      }

      // ── Walls ────────────────────────────────────────────────────────────────
      box(22, 2.8, 0.35, 0x388e3c, 0, 1.6, 9.2);
      box(22, 2.8, 0.35, 0x1b5e20, 0, 1.6, -9.2);
      box(0.35, 2.8, 18, 0x2e7d32, 11.7, 1.6, 0);
      box(0.35, 2.8, 18, 0x1a4a1a, -11.7, 1.6, 0);

      // ── Roof ─────────────────────────────────────────────────────────────────
      const roofMat = new THREE.MeshLambertMaterial({ color: 0xc8c8c8 });
      const backRoof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 6), roofMat);
      backRoof.rotation.x = -0.25;
      backRoof.position.set(0, 5.5, -7.5);
      backRoof.castShadow = true;
      scene.add(backRoof);

      const frontRoof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 6), roofMat);
      frontRoof.rotation.x = 0.25;
      frontRoof.position.set(0, 5.5, 7.5);
      frontRoof.castShadow = true;
      scene.add(frontRoof);

      const roofLineMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
      for (let i = -8; i <= 8; i += 2) {
        const rl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 6.1), roofLineMat);
        rl.rotation.x = -0.25;
        rl.position.set(i, 5.52, -7.5);
        scene.add(rl);
        const rl2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 6.1), roofLineMat);
        rl2.rotation.x = 0.25;
        rl2.position.set(i, 5.52, 7.5);
        scene.add(rl2);
      }

      // ── Hoops ────────────────────────────────────────────────────────────────
      const bbMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
      const rimMat = new THREE.MeshLambertMaterial({ color: 0xff4500 });
      const netMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

      for (const sx of [-1, 1]) {
        const bx = sx * 6.8;
        box(0.12, 2.5, 0.12, 0x888888, bx, 1.7, 0);

        const bb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.6), bbMat);
        bb.position.set(sx * 6.75, 2.6, 0);
        scene.add(bb);

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 24), rimMat);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(sx * 6.25, 2.1, 0);
        scene.add(rim);

        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const nl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.03), netMat);
          nl.position.set(sx * 6.25 + Math.sin(a) * 0.28, 1.78, Math.cos(a) * 0.28);
          scene.add(nl);
        }
      }

      // ── Court lights ─────────────────────────────────────────────────────────
      const lightBoxMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
      const lightGlowMat = new THREE.MeshLambertMaterial({ color: 0xffee88 });
      for (const [lx, ly, lz] of [
        [-8, 4.8, -7], [-4, 4.8, -7], [4, 4.8, -7], [8, 4.8, -7],
        [-8, 4.8, 7], [-4, 4.8, 7], [4, 4.8, 7], [8, 4.8, 7],
      ] as [number, number, number][]) {
        const lb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.5), lightBoxMat);
        lb.position.set(lx, ly, lz);
        scene.add(lb);
        const lg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.4), lightGlowMat);
        lg.position.set(lx, ly - 0.14, lz);
        scene.add(lg);
      }

      // ── Scoreboard ───────────────────────────────────────────────────────────
      box(3.2, 1.6, 0.15, 0x111111, 0, 6.2, 0);
      box(2.8, 1.1, 0.08, 0x001100, 0, 6.25, 0.09);
      box(1.1, 0.7, 0.05, 0x002200, -0.8, 6.3, 0.13);
      box(1.1, 0.7, 0.05, 0x002200, 0.8, 6.3, 0.13);

      const cableMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), cableMat);
      c1.position.set(-1.2, 7.3, 0);
      scene.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), cableMat);
      c2.position.set(1.2, 7.3, 0);
      scene.add(c2);

      // ── Wall decorations ─────────────────────────────────────────────────────
      const wallDeco: [number, number, number][] = [
        [-10, 3.9, 8.5], [-7, 3.9, 8.5], [-4, 3.9, 8.5], [-1, 3.9, 8.5],
        [2, 3.9, 8.5], [5, 3.9, 8.5], [8, 3.9, 8.5],
        [-10, 3.9, -8.5], [-7, 3.9, -8.5], [-4, 3.9, -8.5], [-1, 3.9, -8.5],
        [2, 3.9, -8.5], [5, 3.9, -8.5], [8, 3.9, -8.5],
        [11.5, 3.9, -6], [11.5, 3.9, -3], [11.5, 3.9, 0], [11.5, 3.9, 3], [11.5, 3.9, 6],
        [-11.5, 3.9, -6], [-11.5, 3.9, -3], [-11.5, 3.9, 0], [-11.5, 3.9, 3], [-11.5, 3.9, 6],
      ];
      for (const [cx, cy, cz] of wallDeco) {
        box(1.0, 0.9, 1.0, 0x4caf50, cx, cy, cz);
        box(1.1, 0.2, 1.1, 0x81c784, cx, cy + 0.55, cz);
      }

      // ── Basketball (floating) ────────────────────────────────────────────────
      const ballMat = new THREE.MeshLambertMaterial({ color: 0xe85500 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), ballMat);
      ball.position.set(2, 8, 2);
      ball.castShadow = true;
      scene.add(ball);

      const seamMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
      const seams: Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.03, 4, 32), seamMat);
        if (i === 1) s.rotation.y = Math.PI / 2;
        if (i === 2) s.rotation.x = Math.PI / 2;
        s.position.copy(ball.position);
        scene.add(s);
        seams.push(s);
      }

      // ── Animate ──────────────────────────────────────────────────────────────
      let t = 0;
      function animate() {
        animId = requestAnimationFrame(animate);
        t += 0.015;
        ball.position.y = 8 + Math.sin(t) * 0.4;
        ball.rotation.y = t * 0.8;
        for (const s of seams) {
          s.position.copy(ball.position);
          s.rotation.y = t * 0.8;
        }
        renderer.render(scene, camera);
      }
      animate();

      // Store renderer for cleanup
      (canvas as HTMLCanvasElement & { __threeRenderer?: WebGLRenderer }).__threeRenderer = renderer;
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      const r = (canvas as HTMLCanvasElement & { __threeRenderer?: WebGLRenderer }).__threeRenderer;
      r?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}
