"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

// ─── 바닥 ────────────────────────────────────────────────────────────────────

function Floor() {
  return (
    <group>
      {/* 메인 바닥 — 어두운 대리석 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#0a0a18"
          metalness={0.85}
          roughness={0.15}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* 그리드 라인 (X축) */}
      {[-6, -4, -2, 0, 2, 4, 6].map((z) => (
        <mesh key={`z${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, z]}>
          <planeGeometry args={[16, 0.015]} />
          <meshBasicMaterial color="#1e1a3a" transparent opacity={0.6} />
        </mesh>
      ))}
      {[-6, -4, -2, 0, 2, 4, 6].map((x) => (
        <mesh key={`x${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, 0]}>
          <planeGeometry args={[0.015, 16]} />
          <meshBasicMaterial color="#1e1a3a" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* 중앙 발광 원 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[4.8, 5, 64]} />
        <meshBasicMaterial color="#4c1d95" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[2.8, 3, 64]} />
        <meshBasicMaterial color="#6d28d9" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

// ─── 벽 ──────────────────────────────────────────────────────────────────────

function Walls() {
  const wallMat = (
    <meshStandardMaterial color="#08081a" roughness={0.95} metalness={0.1} />
  );

  return (
    <group>
      {/* 뒷벽 */}
      <mesh position={[0, 6, -14]} receiveShadow>
        <boxGeometry args={[28, 12, 0.25]} />
        {wallMat}
      </mesh>
      {/* 앞벽 */}
      <mesh position={[0, 6, 14]} receiveShadow>
        <boxGeometry args={[28, 12, 0.25]} />
        {wallMat}
      </mesh>
      {/* 왼쪽 벽 */}
      <mesh position={[-14, 6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[28, 12, 0.25]} />
        {wallMat}
      </mesh>
      {/* 오른쪽 벽 */}
      <mesh position={[14, 6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[28, 12, 0.25]} />
        {wallMat}
      </mesh>

      {/* 네온 스트립 — 바닥 쪽 (보라) */}
      {[
        { pos: [0, 0.3, -13.8] as [number, number, number], size: [27, 0.06, 0.05] as [number, number, number] },
        { pos: [0, 0.3, 13.8] as [number, number, number],  size: [27, 0.06, 0.05] as [number, number, number] },
        { pos: [-13.8, 0.3, 0] as [number, number, number], size: [0.05, 0.06, 27] as [number, number, number] },
        { pos: [13.8, 0.3, 0] as [number, number, number],  size: [0.05, 0.06, 27] as [number, number, number] },
      ].map(({ pos, size }, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color="#7c3aed"
            emissive="#7c3aed"
            emissiveIntensity={3}
          />
        </mesh>
      ))}

      {/* 네온 스트립 — 중간 (핑크) */}
      {[
        { pos: [0, 3.5, -13.8] as [number, number, number], size: [27, 0.04, 0.05] as [number, number, number] },
        { pos: [-13.8, 3.5, 0] as [number, number, number], size: [0.05, 0.04, 27] as [number, number, number] },
        { pos: [13.8, 3.5, 0] as [number, number, number],  size: [0.05, 0.04, 27] as [number, number, number] },
      ].map(({ pos, size }, i) => (
        <mesh key={`m${i}`} position={pos}>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color="#db2777"
            emissive="#db2777"
            emissiveIntensity={2.5}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── 천장 ────────────────────────────────────────────────────────────────────

function Ceiling() {
  return (
    <group>
      <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#06060f" roughness={1} />
      </mesh>

      {/* 천장 라이트 스트립 */}
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, 11.9, 0]}>
          <boxGeometry args={[0.06, 0.05, 20]} />
          <meshStandardMaterial
            color="#a78bfa"
            emissive="#8b5cf6"
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── 디스코볼 ─────────────────────────────────────────────────────────────────

function DiscoBall() {
  const ballRef = useRef<THREE.Group>(null);
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const light3Ref = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ballRef.current) ballRef.current.rotation.y = t * 0.6;

    const r = 6;
    if (light1Ref.current) {
      light1Ref.current.position.x = Math.sin(t * 0.8) * r;
      light1Ref.current.position.z = Math.cos(t * 0.8) * r;
    }
    if (light2Ref.current) {
      light2Ref.current.position.x = Math.sin(t * 0.8 + Math.PI * 2 / 3) * r;
      light2Ref.current.position.z = Math.cos(t * 0.8 + Math.PI * 2 / 3) * r;
    }
    if (light3Ref.current) {
      light3Ref.current.position.x = Math.sin(t * 0.8 + (Math.PI * 4) / 3) * r;
      light3Ref.current.position.z = Math.cos(t * 0.8 + (Math.PI * 4) / 3) * r;
    }
  });

  return (
    <group position={[0, 9.5, 0]}>
      {/* 연결선 */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.5, 8]} />
        <meshStandardMaterial color="#333" metalness={0.8} />
      </mesh>

      {/* 볼 */}
      <group ref={ballRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.55, 28, 28]} />
          <meshStandardMaterial
            color="#c0c0c0"
            metalness={1}
            roughness={0.02}
            envMapIntensity={3}
          />
        </mesh>
        {/* 볼 위에 작은 거울 조각들 (평면) */}
        {Array.from({ length: 60 }).map((_, i) => {
          const phi = Math.acos(1 - (2 * i) / 60);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          return (
            <mesh
              key={i}
              position={[
                Math.sin(phi) * Math.cos(theta) * 0.57,
                Math.cos(phi) * 0.57,
                Math.sin(phi) * Math.sin(theta) * 0.57,
              ]}
            >
              <planeGeometry args={[0.06, 0.06]} />
              <meshStandardMaterial
                color="#ffffff"
                metalness={1}
                roughness={0}
                emissive="#aaaaff"
                emissiveIntensity={0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* 회전하는 컬러 스팟 라이트 */}
      <pointLight ref={light1Ref} position={[6, 0, 0]} color="#ec4899" intensity={8} distance={18} />
      <pointLight ref={light2Ref} position={[0, 0, 6]} color="#8b5cf6" intensity={8} distance={18} />
      <pointLight ref={light3Ref} position={[-6, 0, -6]} color="#22d3ee" intensity={8} distance={18} />
    </group>
  );
}

// ─── 테이블 ──────────────────────────────────────────────────────────────────

export function Table({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 유리 상판 */}
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.65, 0.65, 0.04, 32]} />
        <meshStandardMaterial
          color="#7c3aed"
          metalness={0.4}
          roughness={0.1}
          transparent
          opacity={0.45}
          envMapIntensity={2}
        />
      </mesh>
      {/* 테두리 링 */}
      <mesh position={[0, 0.78, 0]}>
        <torusGeometry args={[0.65, 0.018, 12, 64]} />
        <meshStandardMaterial
          color="#a78bfa"
          emissive="#7c3aed"
          emissiveIntensity={1.2}
          metalness={0.8}
        />
      </mesh>
      {/* 다리 */}
      <mesh position={[0, 0.39, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.78, 12]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 받침 */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 24]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 테이블 위 발광 효과 */}
      <pointLight position={[0, 1.2, 0]} color="#c4b5fd" intensity={1.5} distance={3} />
    </group>
  );
}

// ─── 라운지 바 ───────────────────────────────────────────────────────────────

function LoungeBar() {
  return (
    <group position={[0, 0, -10.5]}>
      {/* 바 몸통 */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 1.1, 0.9]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.8} />
      </mesh>
      {/* 상판 (발광 에지) */}
      <mesh position={[0, 1.06, 0]}>
        <boxGeometry args={[7.1, 0.06, 1.05]} />
        <meshStandardMaterial
          color="#0f0f1a"
          metalness={0.9}
          roughness={0.05}
          envMapIntensity={2}
        />
      </mesh>
      {/* 상판 테두리 네온 */}
      <mesh position={[0, 1.09, 0.52]}>
        <boxGeometry args={[7, 0.02, 0.02]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={4} />
      </mesh>

      {/* 선반 */}
      <mesh position={[0, 1.9, -0.55]}>
        <boxGeometry args={[6, 0.04, 0.45]} />
        <meshStandardMaterial color="#0f0f1a" metalness={0.8} roughness={0.1} />
      </mesh>

      {/* 병들 */}
      {[
        "#4ade80", "#f87171", "#60a5fa",
        "#fbbf24", "#a78bfa", "#22d3ee",
      ].map((color, i) => (
        <group key={i} position={[-2.5 + i * 1, 2.06, -0.55]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.09, 0.55, 16]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={0.75}
              metalness={0.1}
              roughness={0.2}
            />
          </mesh>
          {/* 병 발광 */}
          <pointLight color={color} intensity={0.6} distance={1.2} />
        </group>
      ))}

      {/* "MINGLE" 네온 사인 */}
      <group position={[0, 2.8, -0.5]}>
        {/* 사인 배경판 */}
        <mesh>
          <boxGeometry args={[3.2, 0.6, 0.04]} />
          <meshStandardMaterial color="#0a0a18" roughness={1} />
        </mesh>
        {/* 발광 테두리 */}
        {[
          { pos: [-1.58, 0, 0.02] as [number,number,number], size: [0.04, 0.6, 0.04] as [number,number,number] },
          { pos: [1.58, 0, 0.02] as [number,number,number],  size: [0.04, 0.6, 0.04] as [number,number,number] },
          { pos: [0, 0.28, 0.02] as [number,number,number],  size: [3.2, 0.04, 0.04] as [number,number,number] },
          { pos: [0, -0.28, 0.02] as [number,number,number], size: [3.2, 0.04, 0.04] as [number,number,number] },
        ].map((s, i) => (
          <mesh key={i} position={s.pos}>
            <boxGeometry args={s.size} />
            <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={3} />
          </mesh>
        ))}
        <pointLight color="#ec4899" intensity={3} distance={4} position={[0, 0, 0.5]} />
      </group>

      {/* 바 조명 */}
      <pointLight position={[0, 1.5, 0]} color="#c4b5fd" intensity={2} distance={6} />
    </group>
  );
}

// ─── 장식 식물 ────────────────────────────────────────────────────────────────

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 화분 */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.45, 16]} />
        <meshStandardMaterial color="#374151" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* 흙 */}
      <mesh position={[0, 0.51, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.04, 16]} />
        <meshStandardMaterial color="#1c1009" roughness={1} />
      </mesh>
      {/* 줄기 */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.6, 8]} />
        <meshStandardMaterial color="#15501a" roughness={0.9} />
      </mesh>
      {/* 잎 뭉치 */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        const r = 0.12;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * r,
              1.15 + (i % 2) * 0.12,
              Math.sin(angle) * r,
            ]}
            rotation={[0.4, angle, 0.2]}
            castShadow
          >
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#166534" : "#15803d"} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── 조명 장식 ───────────────────────────────────────────────────────────────

function LightRing() {
  const ringRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
  });

  return (
    <group ref={ringRef} position={[0, 7.5, 0]}>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const r = 8;
        const color = i % 2 === 0 ? "#ec4899" : "#8b5cf6";
        return (
          <Float key={i} speed={1.5 + i * 0.2} rotationIntensity={0.2} floatIntensity={0.4}>
            <group position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
              <mesh>
                <sphereGeometry args={[0.15, 12, 12]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={2.5}
                />
              </mesh>
              <pointLight color={color} intensity={1.5} distance={5} />
            </group>
          </Float>
        );
      })}
    </group>
  );
}

// ─── 메인 파티 공간 ──────────────────────────────────────────────────────────

export default function PartyVenue() {
  return (
    <group>
      {/* 조명 */}
      <ambientLight intensity={0.18} color="#1a0a3a" />
      <directionalLight
        position={[8, 10, 5]}
        intensity={0.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#c4b5fd"
      />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#e0d0ff" />

      {/* 환경 맵 */}
      <Environment preset="night" />

      {/* 공간 구성 */}
      <Floor />
      <Walls />
      <Ceiling />
      <DiscoBall />

      {/* 장식 조명 링 */}
      <LightRing />

      {/* 반짝이 이펙트 */}
      <Sparkles count={120} scale={18} size={1.8} speed={0.2} opacity={0.55} color="#c4b5fd" />
      <Sparkles count={60}  scale={10} size={1.2} speed={0.15} opacity={0.35} color="#f9a8d4" position={[0, 2, 0]} />

      {/* 바 카운터 */}
      <LoungeBar />

      {/* 장식 식물 */}
      <Plant position={[-10, 0, 6]} />
      <Plant position={[10, 0, 6]} />
      <Plant position={[-10, 0, -6]} />
      <Plant position={[10, 0, -6]} />

      {/* 안개 */}
      <fog attach="fog" args={["#060612", 12, 32]} />
    </group>
  );
}
