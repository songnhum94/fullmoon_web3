// Water.js - Realistic Clear Water (flow + refraction + fresnel)
// ไม่ import three โดยตรง ใช้ window.THREE ตามโครงเดิม

class Water {
  constructor(renderer, camera, scene, options = {}) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;

    this.width = options.width || 1024;
    this.height = options.height || 1024;
    this.alpha = options.alpha ?? 0.6;              // ใสขึ้น
    this.waterColor = options.waterColor || 0x0a6261;
    this.sunColor = options.sunColor || 0xffffff;
    this.distortionScale = options.distortionScale || 20.0;
    this.size = options.size || 1.0;
    this.y = options.y || 0;

    // ทิศทาง/ความเร็วของการไหล
    this.flowDir = options.flowDir || new window.THREE.Vector2(1.0, 0.1);
    this.flowSpeed = options.flowSpeed || 0.06;

    this.init();
  }

  init() {
    // render targets
    this.reflectRT = new window.THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: window.THREE.LinearFilter, magFilter: window.THREE.LinearFilter,
      format: window.THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
    });
    this.refractRT = new window.THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: window.THREE.LinearFilter, magFilter: window.THREE.LinearFilter,
      format: window.THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
    });

    const geometry = new window.THREE.PlaneGeometry(4000, 4000, 128, 128);

    this.material = new window.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        alpha: { value: this.alpha },
        waterColor: { value: new window.THREE.Color(this.waterColor) },
        sunColor: { value: new window.THREE.Color(this.sunColor) },
        distortionScale: { value: this.distortionScale },
        size: { value: this.size },
        tReflect: { value: this.reflectRT.texture },
        tRefract: { value: this.refractRT.texture },
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far },
        resolution: { value: new window.THREE.Vector2(this.width, this.height) },
        flowDir: { value: this.flowDir.clone().normalize() },
        flowSpeed: { value: this.flowSpeed },
      },
      vertexShader: `
        uniform float time;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          vUv = uv;

          // คลื่นหลายย่านความถี่ (ดูมีรายละเอียด)
          float w1 = 0.05 * sin(world.x * 0.06 + time * 0.8);
          float w2 = 0.03 * cos(world.z * 0.08 + time * 1.2);
          float w3 = 0.02 * sin((world.x + world.z) * 0.045 + time * 1.6);
          world.y += (w1 + w2 + w3);

          // นอร์มัลอย่างง่ายจากความชัน (เพื่อหักเห/สะท้อน)
          vec3 dx = dFdx(world.xyz);
          vec3 dy = dFdy(world.xyz);
          vNormal = normalize(cross(dx, dy));

          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float time;
        uniform float alpha;
        uniform vec3 waterColor;
        uniform vec3 sunColor;
        uniform sampler2D tReflect;
        uniform sampler2D tRefract;
        uniform vec2 resolution;
        uniform vec2 flowDir;
        uniform float flowSpeed;

        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec2 vUv;

        // ต่ำๆ แทน normal map procedural
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a, b, u.x) + (c - a)*u.y*(1.0-u.x) + (d - b)*u.x*u.y;
        }

        void main(){
          vec2 base = gl_FragCoord.xy / resolution;

          // UV ไหล + noise เพื่อให้ลายน้ำเคลื่อน
          vec2 flow = base + flowDir * time * flowSpeed;
          float n1 = noise(flow * 8.0 + time*0.2);
          float n2 = noise(flow * 16.0 - time*0.15);
          vec2 distort = (vec2(n1, n2) - 0.5) * 0.04;

          vec2 sampUv = flow + distort;

          // สีสะท้อน/หักเห
          vec3 reflectCol = texture2D(tReflect, sampUv).rgb;
          vec3 refractCol = texture2D(tRefract, sampUv + distort*0.5).rgb;

          // Fresnel จากมุมมองกับนอร์มัล
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 3.0);

          // ความใส: ผสมหักเห + สีของน้ำ
          vec3 waterTint = mix(refractCol, waterColor, 0.22);

          // สะท้อนผิวน้ำเน้นด้วย fresnel
          vec3 color = mix(waterTint, reflectCol, fres);

          // ไฮไลต์ specular เล็กน้อย
          float spec = pow(max(dot(reflect(-V, normalize(vNormal)), normalize(vec3(0.2,1.0,0.3))), 0.0), 64.0);
          color += sunColor * spec * 0.25;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true
    });

    this.mesh = new window.THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = this.y;
  }

  setSize(w, h) {
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    this.reflectRT.setSize(this.width, this.height);
    this.refractRT.setSize(this.width, this.height);
    this.material.uniforms.resolution.value.set(this.width, this.height);
  }

  update(t) {
    this.material.uniforms.time.value = t;
    this.material.uniforms.cameraNear.value = this.camera.near;
    this.material.uniforms.cameraFar.value = this.camera.far;
  }

  render() {
    const reflectCam = this.camera.clone();
    reflectCam.position.y *= -1;
    reflectCam.lookAt(0, 0, 0);

    const prev = this.renderer.getRenderTarget();
    this.mesh.visible = false;

    this.renderer.setRenderTarget(this.reflectRT);
    this.renderer.render(this.scene, reflectCam);

    this.renderer.setRenderTarget(this.refractRT);
    this.renderer.render(this.scene, this.camera);

    this.mesh.visible = true;
    this.renderer.setRenderTarget(prev);
  }
}

export { Water };
