export const terrainVertexShader = /* glsl */ `
  uniform float uMaxHeight;
  uniform float uTerrainRadius;
  attribute float instanceGlow;
  varying vec3 vInstanceColor;
  varying vec3 vNormalView;
  varying float vElevation;
  varying float vGlow;
  varying float vTopFace;
  varying float vLocalY;
  varying vec2 vFaceUv;
  varying float vFieldFade;

  void main() {
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    vInstanceColor = instanceColor;
    vNormalView = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vElevation = clamp(length(instanceMatrix[1].xyz) / uMaxHeight, 0.0, 1.0);
    vGlow = instanceGlow;
    vTopFace = step(0.5, normal.y);
    vLocalY = position.y + 0.5;
    vFaceUv = uv;
    vFieldFade = 1.0 - smoothstep(0.7, 1.02, length(instanceMatrix[3].xz) / uTerrainRadius);
    gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
  }
`;

export const terrainFragmentShader = /* glsl */ `
  uniform float uGlow;
  uniform vec3 uAccent;
  uniform vec3 uHot;
  varying vec3 vInstanceColor;
  varying vec3 vNormalView;
  varying float vElevation;
  varying float vGlow;
  varying float vTopFace;
  varying float vLocalY;
  varying vec2 vFaceUv;
  varying float vFieldFade;

  void main() {
    vec3 lightDirection = normalize(vec3(-0.32, 0.82, 0.48));
    float diffuse = max(dot(vNormalView, lightDirection), 0.0);
    float heightGlow = smoothstep(0.18, 0.94, vElevation);
    float rippleGlow = smoothstep(0.02, 1.2, vGlow);
    float hotMix = smoothstep(0.45, 1.35, vGlow + vElevation * 0.46);
    vec3 glowColor = mix(uAccent, uHot, hotMix);
    vec3 surface = mix(vInstanceColor, glowColor, 0.018 + heightGlow * 0.08 + rippleGlow * 0.08);

    float topEdgeX = 1.0 - smoothstep(0.015, 0.075, vFaceUv.x) + smoothstep(0.925, 0.985, vFaceUv.x);
    float topEdgeY = 1.0 - smoothstep(0.015, 0.075, vFaceUv.y) + smoothstep(0.925, 0.985, vFaceUv.y);
    float topEdge = min(1.0, topEdgeX + topEdgeY) * vTopFace;
    float sideTopRim = pow(clamp(vLocalY, 0.0, 1.0), 10.0) * (1.0 - vTopFace);

    float emissionStrength =
      0.006 +
      heightGlow * 0.045 +
      vGlow * (0.44 + vTopFace * 0.54 + sideTopRim * 0.28) +
      topEdge * (0.08 + rippleGlow * 0.34) +
      sideTopRim * heightGlow * 0.1;
    vec3 emission = glowColor * emissionStrength * uGlow * mix(0.42, 1.0, vFieldFade);
    float edgeLight = pow(1.0 - abs(vNormalView.z), 2.0) * 0.075;
    vec3 color = surface * (0.16 + diffuse * 0.48 + edgeLight + vTopFace * 0.04) + emission;
    color *= mix(0.18, 1.0, vFieldFade);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
