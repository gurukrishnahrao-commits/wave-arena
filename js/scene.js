// ============================================
// THREE.JS SCENE SETUP
// ============================================

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0612);
  scene.fog = new THREE.Fog(0x0a0612, 15, 35);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.body.appendChild(renderer.domElement);

  setupLights();
  buildArena();

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
}

function setupLights() {
  ambientLight = new THREE.AmbientLight(0x4a3070, 0.6);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xff7ac9, 1.0);
  dirLight.position.set(8, 20, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 60;
  dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -25;
  dirLight.shadow.camera.right = dirLight.shadow.camera.top = 25;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  const centreLight = new THREE.PointLight(0xa23dff, 1.8, 35);
  centreLight.position.set(0, 10, 0);
  scene.add(centreLight);

  const rimLight = new THREE.DirectionalLight(0x3344ff, 0.4);
  rimLight.position.set(-6, 8, -6);
  scene.add(rimLight);

  const bounceLight = new THREE.PointLight(0xff3d6e, 0.6, 20);
  bounceLight.position.set(0, -1, 0);
  scene.add(bounceLight);

  muzzleLight = new THREE.PointLight(0x3dffd2, 0, 8);
  scene.add(muzzleLight);

  combatLight = new THREE.PointLight(0xff3d6e, 0, 15);
  combatLight.position.set(0, 2, 0);
  scene.add(combatLight);
}

function buildArena() {
  const R = CONFIG.ARENA_RADIUS;

  // Shader ground
  const groundGeo = new THREE.CircleGeometry(R, 24);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x180a2e) },
      uGridColor: { value: new THREE.Color(0x6b3fa0) },
      uPulseColor: { value: new THREE.Color(0xff3d6e) },
      uRadius: { value: R },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uGridColor;
      uniform vec3 uPulseColor;
      uniform float uRadius;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vec3 col = uColor;
        float gridScale = 2.0;
        vec2 grid = abs(fract(vPos.xz * gridScale - 0.5) - 0.5) / fwidth(vPos.xz * gridScale);
        float line = min(grid.x, grid.y);
        col = mix(uGridColor * 0.35, col, clamp(line, 0.0, 1.0));
        float cGridScale = 0.5;
        vec2 cgrid = abs(fract(vPos.xz * cGridScale - 0.5) - 0.5) / fwidth(vPos.xz * cGridScale);
        float cline = min(cgrid.x, cgrid.y);
        col = mix(uGridColor * 0.6, col, clamp(cline, 0.0, 1.0));
        float dist = length(vPos.xz);
        float pulse = sin(dist * 1.2 - uTime * 2.5) * 0.5 + 0.5;
        pulse *= pulse * 0.18 * smoothstep(uRadius, 0.0, dist);
        col += uPulseColor * pulse;
        float edgeGlow = pow(max(0.0, 1.0 - dist / uRadius), 3.0) * 0.15;
        col += uGridColor * edgeGlow;
        float vign = smoothstep(0.0, 3.0, uRadius - dist);
        col *= 0.85 + 0.15 * vign;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Grid rings
  for (let r = 4; r <= R; r += 4) {
    const ringGeo = new THREE.RingGeometry(r - 0.05, r, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6b3fa0, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    arenaRingMeshes.push(ring);
  }

  // Arena wall
  const wallGeo = new THREE.CylinderGeometry(R, R, 4, 16, 1, true);
  const wallMat = new THREE.MeshBasicMaterial({ color: 0xff3d6e, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.y = 2;
  scene.add(wallMesh);

  // Outer halo
  const haloGeo = new THREE.CylinderGeometry(R + 0.3, R + 0.3, 4, 16, 1, true);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xff3d6e, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = 2;
  scene.add(halo);

  // Edge ring
  const edgeGeo = new THREE.RingGeometry(R - 0.1, R + 0.1, 16);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff3d6e, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const edgeRing = new THREE.Mesh(edgeGeo, edgeMat);
  edgeRing.rotation.x = -Math.PI / 2;
  edgeRing.position.y = 0.02;
  scene.add(edgeRing);

  // Fog pillars
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const px = Math.cos(angle) * (R - 1.5);
    const pz = Math.sin(angle) * (R - 1.5);
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.8, 5, 6, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0x6b3fa0, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 2.5, pz);
    scene.add(pillar);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}