"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Environment,
  Float,
  Text3D,
  Center,
  useTexture,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";

interface PartyVenueProps {
  theme?: "lounge" | "garden" | "rooftop";
}

// 바닥
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[15, 64]} />
      <meshStandardMaterial color="#2a2a3a" metalness={0.3} roughness={0.8} />
    </mesh>
  );
}

// 조명 장식
function LightDecoration() {
  const lightsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (lightsRef.current) {
      lightsRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={lightsRef}>
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 10;
        return (
          <Float key={i} speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <mesh position={[Math.cos(angle) * radius, 4, Math.sin(angle) * radius]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#ff69b4" : "#ffa500"}
                emissive={i % 2 === 0 ? "#ff69b4" : "#ffa500"}
                emissiveIntensity={2}
              />
            </mesh>
            <pointLight
              position={[Math.cos(angle) * radius, 4, Math.sin(angle) * radius]}
              color={i % 2 === 0 ? "#ff69b4" : "#ffa500"}
              intensity={0.5}
              distance={5}
            />
          </Float>
        );
      })}
    </group>
  );
}

// 테이블
export function Table({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 테이블 상판 */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 32]} />
        <meshStandardMaterial color="#8b4513" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* 테이블 다리 */}
      <mesh position={[0, 0.375, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.75, 16]} />
        <meshStandardMaterial color="#5a3d2b" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* 받침대 */}
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.04, 32]} />
        <meshStandardMaterial color="#4a3d2b" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}

// 장식 식물
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 화분 */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.5, 16]} />
        <meshStandardMaterial color="#d4a574" roughness={0.9} />
      </mesh>
      {/* 식물 */}
      {[...Array(5)].map((_, i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 0.1,
              0.7 + Math.random() * 0.3,
              Math.sin(angle) * 0.1,
            ]}
            rotation={[0.3, angle, 0]}
          >
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#228b22" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

// 라운지 바
function LoungeBar() {
  return (
    <group position={[0, 0, -8]}>
      {/* 바 카운터 */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 1, 0.8]} />
        <meshStandardMaterial color="#4a3728" metalness={0.1} roughness={0.9} />
      </mesh>
      {/* 바 상판 */}
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.2, 0.05, 1]} />
        <meshStandardMaterial color="#2d2d2d" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 선반 */}
      <mesh position={[0, 1.8, -0.6]} castShadow>
        <boxGeometry args={[5, 0.05, 0.4]} />
        <meshStandardMaterial color="#3d3d3d" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 병들 */}
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[-2 + i * 0.8, 2, -0.6]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
          <meshStandardMaterial
            color={["#2ecc71", "#e74c3c", "#3498db", "#f1c40f", "#9b59b6", "#1abc9c"][i]}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// 메인 파티 공간
export default function PartyVenue({ theme = "lounge" }: PartyVenueProps) {
  return (
    <group>
      {/* 조명 */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[0, 5, 0]} intensity={0.8} color="#fff5e6" />

      {/* 환경 */}
      <Environment preset="night" />

      {/* 바닥 */}
      <Floor />

      {/* 장식 조명 */}
      <LightDecoration />

      {/* 반짝이 효과 */}
      <Sparkles
        count={100}
        scale={20}
        size={2}
        speed={0.3}
        opacity={0.5}
        color="#ff69b4"
      />

      {/* 바 카운터 */}
      <LoungeBar />

      {/* 장식 식물 */}
      <Plant position={[-6, 0, 4]} />
      <Plant position={[6, 0, 4]} />
      <Plant position={[-6, 0, -4]} />
      <Plant position={[6, 0, -4]} />

      {/* 안개 효과 */}
      <fog attach="fog" args={["#1a1a2e", 10, 30]} />
    </group>
  );
}
