import type { Color, MeshBasicMaterial } from "three";

export interface WindowWindUniforms {
  uForestTime: { value: number };
  uForestMotion: { value: number };
  uForestMoon: { value: Color };
  uForestWarm: { value: Color };
}

type WindowShader = Parameters<MeshBasicMaterial["onBeforeCompile"]>[0];

/** 가까운 잎에만 바람을 주고, 먼 산과 창틀은 움직이지 않는다. */
export function windowWindShader(
  shader: WindowShader,
  uniforms: WindowWindUniforms,
) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    `#include <common>
    uniform float uForestTime;
    uniform float uForestMotion;
    uniform vec3 uForestMoon;
    uniform vec3 uForestWarm;`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#ifdef USE_MAP
      vec2 forestUv = vMapUv;
      float forestT = uForestTime * uForestMotion;
      vec3 guide = texture2D(map, forestUv).rgb;
      // 푸른 원경은 고정하고 녹색 전경으로 갈수록 잎의 흔들림을 키운다.
      float nearLeaves = (1.0 - smoothstep(0.32, 0.72, forestUv.y))
        * smoothstep(-0.025, 0.045, guide.g - guide.b);
      float gust = sin(forestT * 0.85 + forestUv.y * 8.0)
        + 0.35 * sin(forestT * 1.7 + forestUv.x * 14.0);
      float flutter = sin(forestT * 3.1 + forestUv.x * 120.0 + forestUv.y * 75.0);
      vec2 breeze = vec2(gust * 0.006 + flutter * 0.0006,
        sin(forestT * 1.2 + forestUv.x * 11.0) * 0.0015);
      vec4 sampledDiffuseColor = texture2D(map,
        clamp(forestUv + breeze * nearLeaves * uForestMotion, vec2(0.001), vec2(0.999)));

      // 골짜기 사이로 천천히 지나가는 아주 얇은 달빛 안개.
      float valley = exp(-pow((forestUv.y - 0.48) * 12.0, 2.0));
      float mist = valley * (0.5 + 0.5 * sin(forestUv.x * 16.0 - forestT * 0.13
        + sin(forestUv.y * 19.0))) * 0.025;
      sampledDiffuseColor.rgb += uForestMoon * mist;

      for (int i = 0; i < 8; i++) {
        float seed = float(i);
        // 빛은 숲 위에서 작은 호를 그리며 떠다니고 천천히 밝아졌다 사라진다.
        vec2 mote = vec2(fract(seed * 0.618 + forestT * 0.006),
          0.12 + fract(seed * 0.317) * 0.47 + sin(forestT * 0.6 + seed * 2.0) * 0.018);
        vec2 delta = (forestUv - mote) * vec2(1.5, 1.0);
        float pulse = pow(0.5 + 0.5 * sin(forestT * 1.1 + seed * 2.4), 2.0);
        float glow = exp(-dot(delta, delta) * 65000.0) * pulse;
        vec3 moteColor = mix(uForestMoon, uForestWarm, step(0.5, fract(seed * 0.37)));
        sampledDiffuseColor.rgb += moteColor * glow * 0.6;

        // 드문 잎 몇 장이 바람에 회전하며 흘러간다.
        if (i < 4) {
          vec2 leaf = vec2(fract(seed * 0.277 + forestT * 0.022),
            0.08 + fract(seed * 0.413 - forestT * 0.011) * 0.55);
          vec2 q = forestUv - leaf;
          float a = forestT * 1.1 + seed * 2.0;
          q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
          float leafShape = 1.0 - smoothstep(0.8, 1.0,
            length(q / vec2(0.004, 0.0018)));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb,
            guide * 0.5 + uForestMoon * 0.025, leafShape * 0.75);
        }
      }
      diffuseColor *= sampledDiffuseColor;
    #endif`,
  );
}

export const windowWindKey = () => "living-valley-v1";
