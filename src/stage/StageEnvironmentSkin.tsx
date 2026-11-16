/**
 * Ephemeral 3D Stage Environment Skin Loader (.glb / .gltf).
 * Renders a user-dropped 3D set mesh in-memory on top of the blueprint stage
 * without modifying YAML choreography scores or persisting binary assets.
 */

import React, { Component, Suspense, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface StageEnvironmentSkinProps {
  url: string;
  visible?: boolean;
  onError?: (error: Error) => void;
}

export function preloadStageEnvironmentSkin(url: string): void {
  useGLTF.preload(url);
}

export function clearStageEnvironmentSkinCache(url: string): void {
  useGLTF.clear(url);
}

interface SkinErrorBoundaryProps {
  url: string;
  onError?: (error: Error) => void;
  children: React.ReactNode;
}

interface SkinErrorBoundaryState {
  hasError: boolean;
  prevUrl: string;
}

class SkinErrorBoundary extends Component<
  SkinErrorBoundaryProps,
  SkinErrorBoundaryState
> {
  constructor(props: SkinErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      prevUrl: props.url,
    };
  }

  static getDerivedStateFromError(): Partial<SkinErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: SkinErrorBoundaryProps,
    state: SkinErrorBoundaryState
  ): Partial<SkinErrorBoundaryState> | null {
    if (props.url !== state.prevUrl) {
      return { hasError: false, prevUrl: props.url };
    }
    return null;
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Provides zero-network procedural studio IBL via Three.js RoomEnvironment
 * so PBR metallic/roughness materials inside dropped .glb sets render cleanly.
 */
const StageSkinEnvironmentLighting: React.FC = () => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const previousEnv = scene.environment;
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const renderTarget = pmrem.fromScene(roomEnv, 0.04);

    scene.environment = renderTarget.texture;
    invalidate();

    return () => {
      scene.environment = previousEnv;
      renderTarget.dispose();
      roomEnv.dispose();
      pmrem.dispose();
      invalidate();
    };
  }, [gl, scene, invalidate]);

  return null;
};

const StageSkinMesh: React.FC<{ url: string; visible: boolean }> = ({
  url,
  visible,
}) => {
  const gltf = useGLTF(url);
  const invalidate = useThree((state) => state.invalidate);

  // Clone per R3F Canvas so Diorama, Stage Cam Monitor & Offscreen Export render concurrently
  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useLayoutEffect(() => {
    invalidate();
  }, [clonedScene, visible, invalidate]);

  return (
    <group visible={visible} position={[0, -0.002, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
};

export const StageEnvironmentSkin: React.FC<StageEnvironmentSkinProps> = ({
  url,
  visible = true,
  onError,
}) => {
  return (
    <SkinErrorBoundary url={url} onError={onError}>
      <Suspense fallback={null}>
        {visible && <StageSkinEnvironmentLighting />}
        <StageSkinMesh url={url} visible={visible} />
      </Suspense>
    </SkinErrorBoundary>
  );
};
