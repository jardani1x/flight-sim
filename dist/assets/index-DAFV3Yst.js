(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const n of a.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function e(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(s){if(s.ep)return;s.ep=!0;const a=e(s);fetch(s.href,a)}})();const b={terrainProvider:"default",imageryProvider:"bing",enable3DTiles:!1};class x{viewer=null;aircraftEntity=null;cameraMode={type:"cockpit"};aircraftPosition={x:0,y:0,z:0};aircraftOrientation={x:0,y:0,z:0,w:1};async initialize(t,e={}){const i={...b,...e},s=window.Cesium;if(!s)throw new Error("Cesium not loaded. Add Cesium CDN script to HTML.");i.ionToken&&(s.Ion.defaultAccessToken=i.ionToken),this.viewer=new s.Viewer(t,{baseLayerPicker:!1,geocoder:!1,homeButton:!1,sceneModePicker:!1,selectionIndicator:!1,timeline:!1,animation:!1,navigationHelpButton:!1,fullscreenButton:!1,vrButton:!1,infoBox:!1,shouldAnimate:!0})}setAircraftModel(t){if(!this.viewer)return;const e=window.Cesium;this.aircraftEntity=this.viewer.entities.add({position:e.Cartesian3.ZERO,model:{uri:t,scale:1,minimumPixelSize:64,maximumScale:5e4}})}updateAircraft(t,e){if(!this.viewer||!this.aircraftEntity)return;const i=window.Cesium,s=i.Cartesian3.fromElements(t.x,t.y,t.z),a=this.quaternionToHeadingPitchRoll(e);this.aircraftEntity.position=s,this.aircraftEntity.orientation=i.Transforms.headingPitchRollQuaternion(s,new i.HeadingPitchRoll(a.heading,a.pitch,a.roll)),this.aircraftPosition=t,this.aircraftOrientation=e}quaternionToHeadingPitchRoll(t){const e=2*(t.w*t.x+t.y*t.z),i=1-2*(t.x*t.x+t.y*t.y),s=Math.atan2(e,i),a=2*(t.w*t.y-t.z*t.x),n=Math.abs(a)>=1?Math.sign(a)*Math.PI/2:Math.asin(a),o=2*(t.w*t.z+t.x*t.y),c=1-2*(t.y*t.y+t.z*t.z);return{heading:Math.atan2(o,c),pitch:n,roll:s}}setCameraMode(t){this.cameraMode=t}flyTo(t,e,i){if(!this.viewer)return;const s=window.Cesium;this.viewer.camera.flyTo({destination:s.Cartesian3.fromDegrees(t,e,i),duration:2})}getViewer(){return this.viewer}destroy(){this.viewer&&(this.viewer.destroy(),this.viewer=null)}}const y={low:{name:"low",maxTriangles:5e4,maxTextureSize:512,modelScale:.8},medium:{name:"medium",maxTriangles:15e4,maxTextureSize:1024,modelScale:1},high:{name:"high",maxTriangles:5e5,maxTextureSize:4096,modelScale:1}};class T{modelUrl;scale;currentTier;position={x:0,y:0,z:0};orientation={x:0,y:0,z:0,w:1};constructor(t={}){this.modelUrl=t.url||"",this.scale=t.scale||1,this.currentTier=y.high}async load(t){if(!this.modelUrl){console.log("No aircraft model URL - using placeholder");return}}update(t,e){this.position=t,this.orientation=e}setTier(t){this.currentTier=y[t],this.scale=this.currentTier.modelScale}isLoaded(){return!0}destroy(){}}const S={enableKeyboard:!0,enableMouse:!0,enableGamepad:!0,enableTouch:!0,enableGyro:!0};class M{config;controls={throttle:0,aileron:0,elevator:0,rudder:0,flaps:0,brakes:0,gear:0};keys=new Set;mousePosition={x:0,y:0};mouseDelta={x:0,y:0};mouseButtons=new Set;gamepad=null;touchPoints=new Map;virtualJoystickLeft={x:0,y:0,active:!1};virtualJoystickRight={x:0,y:0,active:!1};gyro={available:!1,alpha:0,beta:0,gamma:0,calibrated:!1,calibrationOffset:{alpha:0,beta:0,gamma:0}};onControlChange=null;constructor(t={}){this.config={...S,...t},this.setupEventListeners()}setupEventListeners(){this.config.enableKeyboard&&(window.addEventListener("keydown",this.handleKeyDown),window.addEventListener("keyup",this.handleKeyUp)),this.config.enableMouse&&(window.addEventListener("mousemove",this.handleMouseMove),window.addEventListener("mousedown",this.handleMouseDown),window.addEventListener("mouseup",this.handleMouseUp)),this.config.enableGamepad&&(window.addEventListener("gamepadconnected",this.handleGamepadConnected),window.addEventListener("gamepaddisconnected",this.handleGamepadDisconnected)),this.config.enableTouch&&(window.addEventListener("touchstart",this.handleTouchStart),window.addEventListener("touchmove",this.handleTouchMove),window.addEventListener("touchend",this.handleTouchEnd)),this.config.enableGyro&&this.initGyro()}handleKeyDown=t=>{this.keys.add(t.code),this.updateKeyboardControls()};handleKeyUp=t=>{this.keys.delete(t.code),this.updateKeyboardControls()};handleMouseMove=t=>{this.mouseDelta.x=t.clientX-this.mousePosition.x,this.mouseDelta.y=t.clientY-this.mousePosition.y,this.mousePosition={x:t.clientX,y:t.clientY}};handleMouseDown=t=>{this.mouseButtons.add(t.button)};handleMouseUp=t=>{this.mouseButtons.delete(t.button)};handleGamepadConnected=t=>{this.gamepad={connected:!0,axes:Array.from(t.gamepad.axes),buttons:t.gamepad.buttons.map(e=>e.pressed),id:t.gamepad.id},console.log("Gamepad connected:",this.gamepad.id)};handleGamepadDisconnected=()=>{this.gamepad=null};handleTouchStart=t=>{for(let e=0;e<t.changedTouches.length;e++){const i=t.changedTouches[e];this.touchPoints.set(i.identifier,{x:i.clientX,y:i.clientY})}this.updateTouchControls()};handleTouchMove=t=>{for(let e=0;e<t.changedTouches.length;e++){const i=t.changedTouches[e],s=this.touchPoints.get(i.identifier);if(s){const a=i.clientX-s.x,n=i.clientY-s.y;i.clientX<window.innerWidth/2?this.virtualJoystickLeft={x:Math.max(-1,Math.min(1,a/50)),y:Math.max(-1,Math.min(1,n/50)),active:!0}:this.virtualJoystickRight={x:Math.max(-1,Math.min(1,a/50)),y:Math.max(-1,Math.min(1,n/50)),active:!0}}}this.updateTouchControls()};handleTouchEnd=t=>{for(let e=0;e<t.changedTouches.length;e++){const i=t.changedTouches[e];this.touchPoints.delete(i.identifier),i.clientX<window.innerWidth/2?(this.virtualJoystickLeft.active=!1,this.virtualJoystickLeft.x=0,this.virtualJoystickLeft.y=0):(this.virtualJoystickRight.active=!1,this.virtualJoystickRight.x=0,this.virtualJoystickRight.y=0)}this.updateTouchControls()};async initGyro(){try{if(typeof DeviceOrientationEvent.requestPermission=="function"&&await DeviceOrientationEvent.requestPermission()!=="granted"){console.warn("Gyro permission denied");return}window.addEventListener("deviceorientation",this.handleGyro),this.gyro.available=!0}catch(t){console.warn("Gyro not available:",t)}}handleGyro=t=>{this.gyro.calibrated||(this.gyro.calibrationOffset={alpha:t.alpha||0,beta:t.beta||0,gamma:t.gamma||0},this.gyro.calibrated=!0),this.gyro.alpha=(t.alpha||0)-this.gyro.calibrationOffset.alpha,this.gyro.beta=(t.beta||0)-this.gyro.calibrationOffset.beta,this.gyro.gamma=(t.gamma||0)-this.gyro.calibrationOffset.gamma};updateKeyboardControls(){let t=0,e=0,i=0,s=0;this.keys.has("KeyW")&&(t=1),this.keys.has("KeyS")&&(t=-1),this.keys.has("KeyA")&&(e=-1),this.keys.has("KeyD")&&(e=1),this.keys.has("ArrowUp")&&(i=1),this.keys.has("ArrowDown")&&(i=-1),this.keys.has("ArrowLeft")&&(s=-1),this.keys.has("ArrowRight")&&(s=1);const a=this.keys.has("KeyF")?1:0,n=this.keys.has("KeyB")?1:0,o=this.keys.has("KeyG")?1:0;this.controls={throttle:t,aileron:e,elevator:i,rudder:s,flaps:a,brakes:n,gear:o},this.notifyChange()}updateGamepadControls(){if(!this.gamepad||!this.config.enableGamepad)return;const e=navigator.getGamepads()[0];e&&(this.controls.aileron=e.axes[0]||0,this.controls.elevator=e.axes[1]||0,this.controls.throttle=(e.axes[2]+1)/2,this.controls.rudder=e.axes[3]||0,e.buttons[0]?.pressed&&(this.controls.flaps=1),e.buttons[1]?.pressed&&(this.controls.brakes=1),e.buttons[2]?.pressed&&(this.controls.gear=1))}updateTouchControls(){this.config.enableTouch&&(this.virtualJoystickLeft.active&&(this.controls.throttle=-this.virtualJoystickLeft.y,this.controls.rudder=this.virtualJoystickLeft.x),this.virtualJoystickRight.active&&(this.controls.aileron=this.virtualJoystickRight.x,this.controls.elevator=-this.virtualJoystickRight.y))}updateGyroControls(){!this.gyro.available||!this.config.enableGyro||!this.gyro.calibrated||(this.controls.elevator=Math.max(-1,Math.min(1,this.gyro.beta/30)),this.controls.aileron=Math.max(-1,Math.min(1,this.gyro.gamma/30)))}getControls(){return this.updateGamepadControls(),this.updateGyroControls(),{...this.controls}}onChange(t){this.onControlChange=t}calibrateGyro(){this.gyro.calibrated=!1}isGyroAvailable(){return this.gyro.available}getGamepadState(){return this.gamepad}notifyChange(){this.onControlChange&&this.onControlChange(this.controls)}destroy(){window.removeEventListener("keydown",this.handleKeyDown),window.removeEventListener("keyup",this.handleKeyUp),window.removeEventListener("mousemove",this.handleMouseMove),window.removeEventListener("mousedown",this.handleMouseDown),window.removeEventListener("mouseup",this.handleMouseUp),window.removeEventListener("gamepadconnected",this.handleGamepadConnected),window.removeEventListener("gamepaddisconnected",this.handleGamepadDisconnected),window.removeEventListener("touchstart",this.handleTouchStart),window.removeEventListener("touchmove",this.handleTouchMove),window.removeEventListener("touchend",this.handleTouchEnd),window.removeEventListener("deviceorientation",this.handleGyro)}}const C={showHUD:!0,showPFD:!0,showDebug:!0,hudPosition:"top-left"};class E{container;config;hud=null;pfd=null;debug=null;settings=null;lastFrameTime=0;frameCount=0;fpsUpdateTime=0;currentFPS=60;onTierChange=null;constructor(t,e={}){this.container=t,this.config={...C,...e},this.createUIElements()}createUIElements(){this.config.showHUD&&(this.hud=document.createElement("div"),this.hud.className="flight-hud",this.hud.innerHTML=`
        <div class="hud-item airspeed">
          <span class="label">IAS</span>
          <span class="value">---</span>
          <span class="unit">kts</span>
        </div>
        <div class="hud-item altitude">
          <span class="label">ALT</span>
          <span class="value">---</span>
          <span class="unit">ft</span>
        </div>
        <div class="hud-item vsi">
          <span class="label">V/S</span>
          <span class="value">---</span>
          <span class="unit">fpm</span>
        </div>
        <div class="hud-item heading">
          <span class="label">HDG</span>
          <span class="value">---</span>
          <span class="unit">°</span>
        </div>
      `,this.container.appendChild(this.hud)),this.config.showPFD&&(this.pfd=document.createElement("div"),this.pfd.className="flight-pfd",this.pfd.innerHTML=`
        <canvas class="pfd-canvas" width="300" height="300"></canvas>
      `,this.container.appendChild(this.pfd)),this.config.showDebug&&(this.debug=document.createElement("div"),this.debug.className="flight-debug",this.debug.innerHTML=`
        <div class="debug-item fps">FPS: --</div>
        <div class="debug-item frame-time">Frame: --ms</div>
        <div class="debug-item physics-time">Physics: --ms</div>
        <div class="debug-item tiles">Tiles: 0</div>
        <div class="debug-item memory">Memory: --MB</div>
      `,this.container.appendChild(this.debug)),this.settings=document.createElement("div"),this.settings.className="flight-settings",this.settings.innerHTML=`
      <div class="settings-title">Settings</div>
      <div class="settings-tier">
        <label>Quality:</label>
        <select class="tier-select">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high" selected>High</option>
        </select>
      </div>
      <div class="settings-controls">
        <button class="calibrate-gyro">Calibrate Gyro</button>
      </div>
    `,this.container.appendChild(this.settings),this.setupEventListeners()}setupEventListeners(){this.settings?.querySelector(".tier-select")?.addEventListener("change",i=>{const s=i.target.value;this.onTierChange&&this.onTierChange(s)}),this.settings?.querySelector(".calibrate-gyro")?.addEventListener("click",()=>{window.dispatchEvent(new CustomEvent("gyro-calibrate"))})}updateFlightState(t){if(!this.hud)return;const e=t.airspeed*1.94384,i=t.altitude*3.28084,s=0,a=(t.heading*180/Math.PI+360)%360;this.updateHudValue(".airspeed .value",e.toFixed(0)),this.updateHudValue(".altitude .value",i.toFixed(0)),this.updateHudValue(".vsi .value",s.toFixed(0)),this.updateHudValue(".heading .value",a.toFixed(0)),this.updatePFD(t)}updateHudValue(t,e){const i=this.hud?.querySelector(t);i&&(i.textContent=e)}updatePFD(t){const e=this.pfd?.querySelector(".pfd-canvas");if(!e)return;const i=e.getContext("2d");if(!i)return;const s=e.width,a=e.height,n=s/2,o=a/2;i.fillStyle="#1a1a1a",i.fillRect(0,0,s,a),i.strokeStyle="#00ff00",i.lineWidth=1;const c=t.pitch*180/Math.PI,u=t.roll*180/Math.PI;for(let l=-90;l<=90;l+=10){const h=(c-l)*3;if(Math.abs(h)<100){const d=Math.abs(l)===0?60:40;i.beginPath(),i.moveTo(n-d,o-h),i.lineTo(n+d,o-h),i.stroke(),i.fillStyle="#00ff00",i.font="10px monospace",i.fillText(l.toString(),n+d+5,o-h+3)}}i.save(),i.translate(n,30),i.rotate(-u*Math.PI/180),i.beginPath(),i.moveTo(0,0),i.lineTo(-10,-15),i.lineTo(10,-15),i.closePath(),i.fillStyle="#00ff00",i.fill(),i.restore();const m=(t.heading*180/Math.PI+360)%360;i.fillStyle="#00ff00",i.font="12px monospace",i.textAlign="center",i.fillText(`HDG ${m.toFixed(0)}°`,n,a-20);const f=t.airspeed*1.94384;i.fillText(`${f.toFixed(0)} kts`,30,o);const p=t.altitude*3.28084;i.fillText(`${p.toFixed(0)} ft`,s-30,o)}updatePerformance(t){this.debug&&(this.updateDebugValue(".fps",`FPS: ${t.fps.toFixed(0)}`),this.updateDebugValue(".frame-time",`Frame: ${t.frameTime.toFixed(1)}ms`),this.updateDebugValue(".physics-time",`Physics: ${t.physicsTime.toFixed(1)}ms`),this.updateDebugValue(".tiles",`Tiles: ${t.tilesLoaded}`),this.updateDebugValue(".memory",`Memory: ${t.memoryEstimate.toFixed(0)}MB`))}updateDebugValue(t,e){const i=this.debug?.querySelector(t);i&&(i.textContent=e)}tick(){const t=performance.now();this.frameCount++,t-this.fpsUpdateTime>=1e3&&(this.currentFPS=this.frameCount*1e3/(t-this.fpsUpdateTime),this.frameCount=0,this.fpsUpdateTime=t,this.debug&&this.updatePerformance({fps:this.currentFPS,frameTime:1e3/this.currentFPS,physicsTime:0,tilesLoaded:0,memoryEstimate:0})),this.lastFrameTime=t}onTierChangeCallback(t){this.onTierChange=t}setVisible(t){[this.hud,this.pfd,this.debug,this.settings].forEach(i=>{i&&(i.style.display=t?"block":"none")})}destroy(){[this.hud,this.pfd,this.debug,this.settings].forEach(e=>{e&&e.parentNode&&e.parentNode.removeChild(e)})}}const P=`
.flight-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: 'Courier New', monospace;
  color: #00ff00;
  background: rgba(0, 0, 0, 0.5);
  padding: 15px;
  border-radius: 8px;
}

.hud-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hud-item .label {
  font-size: 12px;
  opacity: 0.7;
  width: 30px;
}

.hud-item .value {
  font-size: 24px;
  font-weight: bold;
  width: 60px;
  text-align: right;
}

.hud-item .unit {
  font-size: 10px;
  opacity: 0.7;
}

.flight-pfd {
  position: absolute;
  bottom: 20px;
  right: 20px;
}

.pfd-canvas {
  border-radius: 50%;
  border: 2px solid #00ff00;
}

.flight-debug {
  position: absolute;
  top: 20px;
  right: 20px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #ffff00;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
}

.debug-item {
  margin-bottom: 4px;
}

.flight-settings {
  position: absolute;
  bottom: 20px;
  left: 20px;
  font-family: sans-serif;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
}

.settings-title {
  font-weight: bold;
  margin-bottom: 10px;
}

.settings-tier {
  margin-bottom: 10px;
}

.settings-tier label {
  margin-right: 8px;
}

.tier-select {
  background: #333;
  color: white;
  border: 1px solid #555;
  padding: 4px 8px;
  border-radius: 4px;
}

.calibrate-gyro {
  background: #444;
  color: white;
  border: 1px solid #666;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.calibrate-gyro:hover {
  background: #555;
}
`;class k{accumulator=0;state;config;callbacks=[];lastTime=0;running=!1;animationFrameId=null;constructor(t={}){this.config={fixedTimeStep:1/60,maxSubSteps:3,timeScale:1,paused:!1,...t},this.state=this.createInitialState()}createInitialState(){return{position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0},deltaTime:0,totalTime:0}}subscribe(t){this.callbacks.push(t)}unsubscribe(t){this.callbacks=this.callbacks.filter(e=>e!==t)}start(){this.running||(this.running=!0,this.lastTime=performance.now(),this.loop())}stop(){this.running=!1,this.animationFrameId!==null&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null)}pause(){this.config.paused=!0}resume(){this.config.paused=!1,this.lastTime=performance.now()}step(){this.config.paused||this.update(this.config.fixedTimeStep)}setTimeScale(t){this.config.timeScale=Math.max(0,Math.min(10,t))}getState(){return{...this.state}}setState(t){Object.assign(this.state,t)}loop=()=>{if(!this.running)return;const t=performance.now(),e=(t-this.lastTime)/1e3;this.lastTime=t;const i=Math.min(e,.25);if(!this.config.paused){this.accumulator+=i*this.config.timeScale;let s=0;for(;this.accumulator>=this.config.fixedTimeStep&&s<this.config.maxSubSteps;)this.update(this.config.fixedTimeStep),this.accumulator-=this.config.fixedTimeStep,s++}this.animationFrameId=requestAnimationFrame(this.loop)};update(t){this.state.deltaTime=t,this.state.totalTime+=t;for(const e of this.callbacks)e(this.state,t)}}const L={name:"Airbus A380",wingspan:79.75,length:72.72,mass:276800,maxThrust:4*356e3,stallSpeed:100,serviceCeiling:13100};function F(r,t=0){return{aircraft:L,initialPosition:r,initialHeading:t}}const g=6378137,D=1/298.257223563,v=g*(1-D),w=1-v*v/(g*g);function G(r){const{longitude:t,latitude:e,height:i}=r,s=Math.sin(e),a=Math.cos(e),n=g/Math.sqrt(1-w*s*s),o=(n+i)*a*Math.cos(t),c=(n+i)*a*Math.sin(t),u=(n*(1-w)+i)*s;return{x:o,y:c,z:u}}const I={cesiumIonToken:void 0,initialPosition:{latitude:1.3644,longitude:103.9915,altitude:1e3},initialHeading:90,performanceTier:"high"};class z{container;config;world;aircraft;input;ui;physics;fdmState;fdmStep=null;running=!1;constructor(t,e={}){this.container=t,this.config={...I,...e},this.world=new x,this.aircraft=new T({scale:1,minimumPixelSize:128}),this.input=new M,this.ui=new E(t,{showHUD:!0,showPFD:!0,showDebug:!0}),this.physics=new k({fixedTimeStep:1/60,maxSubSteps:3});const i=G({longitude:this.config.initialPosition.longitude*Math.PI/180,latitude:this.config.initialPosition.latitude*Math.PI/180,height:this.config.initialPosition.altitude});F(i,this.config.initialHeading*Math.PI/180),this.fdmStep=null,this.fdmState={position:i,velocity:{x:0,y:0,z:0},orientation:{x:0,y:0,z:Math.sin(this.config.initialHeading/2),w:Math.cos(this.config.initialHeading/2)},angularVelocity:{x:0,y:0,z:0},airspeed:0,altitude:this.config.initialPosition.altitude,heading:this.config.initialHeading*Math.PI/180,pitch:0,roll:0}}async initialize(){this.injectStyles(),await this.world.initialize(this.container,{ionToken:this.config.cesiumIonToken,terrainProvider:"default",imageryProvider:"bing",enable3DTiles:!0}),this.world.setCameraMode({type:"cockpit"}),this.physics.subscribe(this.updatePhysics),this.ui.onTierChangeCallback(t=>{this.setPerformanceTier(t)}),window.addEventListener("gyro-calibrate",()=>{this.input.calibrateGyro()}),console.log("Flight Simulator initialized")}start(){this.running||(this.running=!0,this.physics.start(),console.log("Simulator started"))}stop(){this.running=!1,this.physics.stop()}setCameraMode(t){const e={type:t};t==="chase"&&(e.distance=50),this.world.setCameraMode(e)}setPerformanceTier(t){this.aircraft.setTier(t),this.world.setTerrainQuality(t==="low"?"low":t==="medium"?"medium":"high")}async loadAircraft(t){await this.aircraft.load(this.world.getViewer().models)}updatePhysics=(t,e)=>{const i=this.input.getControls();this.fdmStep?this.fdmState=this.fdmStep(i,e):this.updateSimplePhysics(i,e),this.world.updateAircraft(this.fdmState.position,this.fdmState.orientation),this.ui.updateFlightState(this.fdmState),this.ui.tick()};updateSimplePhysics(t,e){this.fdmState.heading+=t.rudder*.5*e,this.fdmState.roll=t.aileron*.5,this.fdmState.pitch=t.elevator*.3;const a=this.fdmState.heading,n=this.fdmState.pitch;this.fdmState.velocity.x=Math.cos(a)*Math.cos(n)*50,this.fdmState.velocity.y=Math.sin(a)*Math.cos(n)*50,this.fdmState.velocity.z=-Math.sin(n)*50,this.fdmState.position.x+=this.fdmState.velocity.x*e,this.fdmState.position.y+=this.fdmState.velocity.y*e,this.fdmState.position.z+=this.fdmState.velocity.z*e,this.fdmState.altitude=this.fdmState.position.z,this.fdmState.airspeed=50;const o=this.fdmState.roll,c=this.fdmState.pitch,u=this.fdmState.heading,m=Math.cos(o/2),f=Math.sin(o/2),p=Math.cos(c/2),l=Math.sin(c/2),h=Math.cos(u/2),d=Math.sin(u/2);this.fdmState.orientation={x:f*p*h-m*l*d,y:m*l*h+f*p*d,z:m*p*d-f*l*h,w:m*p*h+f*l*d}}injectStyles(){const t=document.createElement("style");t.textContent=P,document.head.appendChild(t)}destroy(){this.stop(),this.world.destroy(),this.aircraft.destroy(),this.input.destroy(),this.ui.destroy()}}document.addEventListener("DOMContentLoaded",async()=>{const r=document.getElementById("flight-sim");if(!r){console.error("Flight simulator container not found");return}const t=window.__CESIUM_ION_TOKEN__;t||console.warn("Cesium ion token not provided. Set window.__CESIUM_ION_TOKEN__");const e=new z(r,{cesiumIonToken:t,performanceTier:"high"});await e.initialize(),e.start(),window.flightSim=e});
//# sourceMappingURL=index-DAFV3Yst.js.map
