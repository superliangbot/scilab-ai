import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Camera2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("camera-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let aperture = 5;
  let focusDistance = 60; // cm
  let objectDistance = 80; // cm
  let showRays = 1;

  // Scene objects (distances in cm from lens)
  const sceneObjects = [
    { label: "Tree", distance: 150, height: 40, color: "#22c55e", baseColor: "#8B4513" },
    { label: "Person", distance: 80, height: 25, color: "#f97316", baseColor: "#f97316" },
  ];

  // Camera/lens constants
  const sensorWidth = 3.6; // cm (roughly 35mm sensor)

  function getScale(): number {
    return Math.min(width, height) / 200;
  }

  function getLensX(): number {
    return width * 0.55;
  }

  function getLensY(): number {
    return height * 0.5;
  }

  // Thin lens equation: 1/f = 1/do + 1/di => f = do*di/(do+di)
  // Given focusDistance as the distance the lens is focused at,
  // the focal length is derived from the focus setting.
  // Image distance for an object at distance d: di = f*d/(d - f)
  function getFocalLength(): number {
    // The camera is focused at focusDistance, meaning the sensor is placed
    // at the image distance for an object at focusDistance.
    // For a thin lens: 1/f = 1/do + 1/di
    // We treat focusDistance as the object distance that is in perfect focus.
    // A typical camera focal length is much shorter; we'll use a simplified model.
    // f = focusDistance * sensorDist / (focusDistance + sensorDist)
    // For simplicity, use f ~ focusDistance / 10 clamped
    return Math.max(2, focusDistance / 8);
  }

  function getImageDistance(objDist: number): number {
    const f = getFocalLength();
    if (objDist <= f) return Infinity;
    return (f * objDist) / (objDist - f);
  }

  function getSensorDistance(): number {
    // Sensor is placed at the image distance for the focused object
    return getImageDistance(focusDistance);
  }

  // Circle of confusion (blur) for an object not at focus distance
  function getBlurRadius(objDist: number): number {
    const sensorDist = getSensorDistance();
    const imgDist = getImageDistance(objDist);
    if (!isFinite(imgDist) || !isFinite(sensorDist)) return 20;

    // Defocus: difference between where rays converge and where sensor is
    const defocus = Math.abs(imgDist - sensorDist);

    // Circle of confusion diameter is proportional to aperture and defocus
    // CoC = aperture * defocus / imgDist (simplified)
    const coc = (aperture * defocus) / Math.max(imgDist, 1);

    return coc * getScale() * 0.5;
  }

  // Brightness factor based on aperture (larger aperture = more light)
  function getBrightness(): number {
    // Brightness proportional to aperture^2 (area of opening)
    return Math.min(1, (aperture * aperture) / 50);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    aperture = params.aperture ?? 5;
    focusDistance = params.focusDistance ?? 60;
    objectDistance = params.objectDistance ?? 80;
    showRays = Math.round(params.showRays ?? 1);
    time += dt;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#0d0d24");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawOpticalAxis(): void {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, getLensY());
    ctx.lineTo(width, getLensY());
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawSceneObjects(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();

    ctx.save();

    for (const obj of sceneObjects) {
      const objX = lx - obj.distance * scale * 0.6;
      const objH = obj.height * scale * 0.5;

      if (objX < 10) continue;

      if (obj.label === "Tree") {
        // Draw tree trunk
        ctx.fillStyle = obj.baseColor;
        ctx.fillRect(objX - 3, ly - objH * 0.4, 6, objH * 0.4);

        // Draw tree canopy (triangle)
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(objX, ly - objH);
        ctx.lineTo(objX - objH * 0.4, ly - objH * 0.3);
        ctx.lineTo(objX + objH * 0.4, ly - objH * 0.3);
        ctx.closePath();
        ctx.fill();

        // Second layer
        ctx.beginPath();
        ctx.moveTo(objX, ly - objH * 0.8);
        ctx.lineTo(objX - objH * 0.35, ly - objH * 0.15);
        ctx.lineTo(objX + objH * 0.35, ly - objH * 0.15);
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw person (stick figure)
        // Head
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(objX, ly - objH + 4, 4, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(objX, ly - objH + 8);
        ctx.lineTo(objX, ly - objH * 0.3);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(objX - 8, ly - objH * 0.6);
        ctx.lineTo(objX, ly - objH * 0.55);
        ctx.lineTo(objX + 8, ly - objH * 0.6);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(objX - 6, ly);
        ctx.lineTo(objX, ly - objH * 0.3);
        ctx.lineTo(objX + 6, ly);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(obj.label, objX, ly + 14);
      ctx.fillText(`${obj.distance} cm`, objX, ly + 26);
    }

    ctx.restore();
  }

  function drawCameraBody(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const sensorDist = getSensorDistance();

    if (!isFinite(sensorDist)) return;

    const sensorX = lx + Math.min(sensorDist * scale * 0.3, width * 0.3);
    const bodyH = height * 0.3;

    ctx.save();

    // Camera body (box from lens to sensor and beyond)
    ctx.fillStyle = "rgba(40, 40, 60, 0.6)";
    ctx.strokeStyle = "rgba(100, 100, 140, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(lx - 5, ly - bodyH / 2, sensorX - lx + 30, bodyH, 4);
    ctx.fill();
    ctx.stroke();

    // Sensor plane
    const sensorH = bodyH * 0.6;
    ctx.strokeStyle = "rgba(200, 200, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sensorX, ly - sensorH / 2);
    ctx.lineTo(sensorX, ly + sensorH / 2);
    ctx.stroke();

    // Sensor label
    ctx.fillStyle = "rgba(200, 200, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sensor", sensorX, ly + sensorH / 2 + 14);

    ctx.restore();
  }

  function drawLens(): void {
    const lx = getLensX();
    const ly = getLensY();
    const scale = getScale();
    const lensHalfH = aperture * scale * 1.5;

    ctx.save();

    // Lens body - convex shape
    ctx.beginPath();
    ctx.moveTo(lx, ly - lensHalfH);
    ctx.quadraticCurveTo(lx - 10, ly, lx, ly + lensHalfH);
    ctx.quadraticCurveTo(lx + 10, ly, lx, ly - lensHalfH);
    ctx.closePath();

    const lensGrad = ctx.createLinearGradient(lx - 10, ly, lx + 10, ly);
    lensGrad.addColorStop(0, "rgba(100, 180, 255, 0.15)");
    lensGrad.addColorStop(0.5, "rgba(180, 230, 255, 0.3)");
    lensGrad.addColorStop(1, "rgba(100, 180, 255, 0.15)");
    ctx.fillStyle = lensGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(150, 210, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Aperture blades (top and bottom blocking)
    const maxLensH = 10 * scale * 1.5; // Maximum opening
    if (aperture < 10) {
      ctx.fillStyle = "rgba(30, 30, 50, 0.9)";
      // Top blade
      ctx.fillRect(lx - 6, ly - maxLensH, 12, maxLensH - lensHalfH);
      // Bottom blade
      ctx.fillRect(lx - 6, ly + lensHalfH, 12, maxLensH - lensHalfH);

      // Blade edges
      ctx.strokeStyle = "rgba(100, 100, 140, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx - 6, ly - lensHalfH);
      ctx.lineTo(lx + 6, ly - lensHalfH);
      ctx.moveTo(lx - 6, ly + lensHalfH);
      ctx.lineTo(lx + 6, ly + lensHalfH);
      ctx.stroke();
    }

    // Aperture label
    ctx.fillStyle = "rgba(150, 210, 255, 0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Lens", lx, ly - lensHalfH - 14);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`f/${(10 / aperture).toFixed(1)}`, lx, ly - lensHalfH - 4);

    ctx.restore();
  }

  function drawLightRays(): void {
    if (!showRays) return;

    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const lensHalfH = aperture * scale * 1.5;
    const sensorDist = getSensorDistance();
    if (!isFinite(sensorDist)) return;
    const sensorX = lx + Math.min(sensorDist * scale * 0.3, width * 0.3);

    ctx.save();
    ctx.lineWidth = 1;

    // Draw rays from each scene object through aperture to sensor
    for (const obj of sceneObjects) {
      const objX = lx - obj.distance * scale * 0.6;
      const objTopY = ly - obj.height * scale * 0.5;

      if (objX < 10) continue;

      const imgDist = getImageDistance(obj.distance);
      if (!isFinite(imgDist)) continue;

      // Magnification for this object
      const mag = -imgDist / obj.distance;
      const imgH = mag * obj.height;

      // Where the image forms (might not be at sensor)
      const imgFormX = lx + Math.min(imgDist * scale * 0.3, width * 0.3);
      const imgFormY = ly - imgH * scale * 0.5;

      // Number of rays through aperture
      const numRays = 5;
      const alpha = obj.label === "Tree" ? 0.3 : 0.5;

      for (let i = 0; i < numRays; i++) {
        const frac = (i / (numRays - 1)) * 2 - 1; // -1 to 1
        const hitY = ly + frac * lensHalfH * 0.85;

        // Ray color based on object
        const rayColor = obj.label === "Tree"
          ? `rgba(100, 220, 100, ${alpha})`
          : `rgba(255, 180, 80, ${alpha})`;

        ctx.strokeStyle = rayColor;

        // Ray from object tip to lens aperture point
        ctx.beginPath();
        ctx.moveTo(objX, objTopY);
        ctx.lineTo(lx, hitY);
        ctx.stroke();

        // Ray from lens to convergence/sensor
        // Direction toward image formation point from this aperture position
        const dx = imgFormX - lx;
        const dy = imgFormY - hitY;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len > 0) {
          // Extend to sensor plane
          const t = (sensorX - lx) / dx;
          const sensorHitY = hitY + dy * t;

          ctx.beginPath();
          ctx.moveTo(lx, hitY);
          ctx.lineTo(sensorX, sensorHitY);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function drawSensorImage(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const sensorDist = getSensorDistance();
    if (!isFinite(sensorDist)) return;
    const sensorX = lx + Math.min(sensorDist * scale * 0.3, width * 0.3);
    const brightness = getBrightness();

    ctx.save();

    // Draw each object's image on the sensor
    for (const obj of sceneObjects) {
      const imgDist = getImageDistance(obj.distance);
      if (!isFinite(imgDist)) continue;

      const mag = -imgDist / obj.distance;
      const imgH = Math.abs(mag * obj.height) * scale * 0.15;
      const blur = getBlurRadius(obj.distance);

      // Image is inverted - objects above axis appear below on sensor
      const imgY = ly + (mag * obj.height * scale * 0.15);

      // Draw blurred or sharp image on sensor
      const alpha = Math.min(0.9, brightness);

      if (blur < 1.5) {
        // Sharp image
        ctx.fillStyle = obj.label === "Tree"
          ? `rgba(34, 197, 94, ${alpha})`
          : `rgba(249, 115, 22, ${alpha})`;
        ctx.fillRect(sensorX - 2, imgY - imgH / 2, 4, imgH);
      } else {
        // Blurred image (circle of confusion)
        const clampedBlur = Math.min(blur, 20);
        const blurGrad = ctx.createRadialGradient(
          sensorX, imgY, 0,
          sensorX, imgY, clampedBlur + imgH / 2
        );
        const baseColor = obj.label === "Tree" ? "34, 197, 94" : "249, 115, 22";
        blurGrad.addColorStop(0, `rgba(${baseColor}, ${alpha * 0.6})`);
        blurGrad.addColorStop(0.5, `rgba(${baseColor}, ${alpha * 0.3})`);
        blurGrad.addColorStop(1, `rgba(${baseColor}, 0)`);

        ctx.beginPath();
        ctx.ellipse(sensorX, imgY, clampedBlur, clampedBlur + imgH / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = blurGrad;
        ctx.fill();
      }

      // Focus indicator label
      const blurLabel = blur < 1.5 ? "Sharp" : blur < 5 ? "Slight blur" : "Blurred";
      ctx.fillStyle = `rgba(255, 255, 255, 0.5)`;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${obj.label}: ${blurLabel}`, sensorX + 8, imgY + 3);
    }

    ctx.restore();
  }

  function drawFocusDistanceMarker(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const focusX = lx - focusDistance * scale * 0.6;
    const markerY = ly + height * 0.2;

    if (focusX < 10) return;

    ctx.save();

    // Dashed line from focus plane to lens
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(focusX, ly - height * 0.15);
    ctx.lineTo(focusX, ly + height * 0.15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Focus plane label
    ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Focus Plane", focusX, ly - height * 0.15 - 6);

    // Distance arrow
    ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(focusX, markerY);
    ctx.lineTo(lx, markerY);
    ctx.stroke();

    // Arrowheads
    ctx.beginPath();
    ctx.moveTo(focusX, markerY);
    ctx.lineTo(focusX + 6, markerY - 3);
    ctx.moveTo(focusX, markerY);
    ctx.lineTo(focusX + 6, markerY + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx, markerY);
    ctx.lineTo(lx - 6, markerY - 3);
    ctx.moveTo(lx, markerY);
    ctx.lineTo(lx - 6, markerY + 3);
    ctx.stroke();

    ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Focus: ${focusDistance} cm`, (focusX + lx) / 2, markerY - 8);

    ctx.restore();
  }

  function drawDepthOfFieldIndicator(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const f = getFocalLength();

    // Depth of field approximation
    // Hyperfocal distance H = f^2 / (N * c) where N = f-number, c = circle of confusion limit
    const fNumber = Math.max(0.5, 10 / aperture);
    const cocLimit = 0.03; // cm, acceptable circle of confusion
    const H = (f * f) / (fNumber * cocLimit);

    // Near focus limit: Dn = focusDistance * (H - f) / (H + focusDistance - 2*f)
    // Far focus limit:  Df = focusDistance * (H - f) / (H - focusDistance)
    let nearFocus: number;
    let farFocus: number;

    if (focusDistance >= H) {
      nearFocus = H / 2;
      farFocus = Infinity;
    } else {
      nearFocus = (focusDistance * (H - f)) / (H + focusDistance - 2 * f);
      farFocus = (focusDistance * (H - f)) / (H - focusDistance);
      if (farFocus < 0) farFocus = Infinity;
    }

    nearFocus = Math.max(nearFocus, f + 1);

    // Draw DOF zone
    const nearX = lx - nearFocus * scale * 0.6;
    const farX = isFinite(farFocus) ? lx - farFocus * scale * 0.6 : 10;
    const dofY = ly - height * 0.22;

    if (nearX > 10 || farX > 10) {
      ctx.save();

      const leftX = Math.max(farX, 10);
      const rightX = Math.min(nearX, lx - 10);

      if (rightX > leftX) {
        // DOF zone
        ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
        ctx.fillRect(leftX, ly - height * 0.18, rightX - leftX, height * 0.36);

        // DOF borders
        ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(leftX, ly - height * 0.18);
        ctx.lineTo(leftX, ly + height * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, ly - height * 0.18);
        ctx.lineTo(rightX, ly + height * 0.18);
        ctx.stroke();
        ctx.setLineDash([]);

        // DOF label
        ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        const dofRange = isFinite(farFocus)
          ? `${nearFocus.toFixed(0)}-${farFocus.toFixed(0)} cm`
          : `${nearFocus.toFixed(0)} cm to inf`;
        ctx.fillText(`Depth of Field: ${dofRange}`, (leftX + rightX) / 2, dofY - 4);
      }

      ctx.restore();
    }
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 260;
    const panelH = 150;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Camera Exposure & Focus", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    const f = getFocalLength();
    const fNumber = (10 / aperture).toFixed(1);
    const brightness = getBrightness();

    ctx.fillText(`Focal length: ${f.toFixed(1)} cm`, panelX + 10, panelY + 40);
    ctx.fillText(`Aperture: f/${fNumber}  (size: ${aperture})`, panelX + 10, panelY + 56);
    ctx.fillText(`Focus distance: ${focusDistance} cm`, panelX + 10, panelY + 72);
    ctx.fillText(`Brightness: ${(brightness * 100).toFixed(0)}%`, panelX + 10, panelY + 88);

    // Thin lens formula
    ctx.fillStyle = "rgba(200, 200, 255, 0.6)";
    ctx.fillText("1/f = 1/d_o + 1/d_i", panelX + 10, panelY + 108);

    // Exposure explanation
    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    if (aperture > 7) {
      ctx.fillText("Large aperture: Bright, shallow DOF", panelX + 10, panelY + 126);
    } else if (aperture < 3) {
      ctx.fillText("Small aperture: Dark, deep DOF (pinhole)", panelX + 10, panelY + 126);
    } else {
      ctx.fillText("Medium aperture: Balanced exposure & DOF", panelX + 10, panelY + 126);
    }

    // Object blur info
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 142);

    ctx.restore();
  }

  function drawExposureOverlay(): void {
    // Darken the scene based on aperture (small aperture = less light)
    const brightness = getBrightness();
    if (brightness < 0.95) {
      ctx.save();
      const darkness = 1 - brightness;
      ctx.fillStyle = `rgba(0, 0, 10, ${darkness * 0.3})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function drawGroundPlane(): void {
    const ly = getLensY();

    ctx.save();

    // Ground plane
    ctx.strokeStyle = "rgba(100, 200, 100, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(getLensX(), ly);
    ctx.stroke();

    // Ground gradient beneath
    const groundGrad = ctx.createLinearGradient(0, ly, 0, ly + 30);
    groundGrad.addColorStop(0, "rgba(30, 60, 20, 0.3)");
    groundGrad.addColorStop(1, "rgba(30, 60, 20, 0)");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, ly, getLensX(), 30);

    ctx.restore();
  }

  function drawPhysicsAnnotations(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();

    ctx.save();

    // Object distance marker for the "Person" object
    const personDist = sceneObjects[1].distance;
    const personX = lx - personDist * scale * 0.6;

    if (personX > 10) {
      ctx.strokeStyle = "rgba(249, 115, 22, 0.4)";
      ctx.lineWidth = 1;
      const markerY2 = ly + height * 0.26;
      ctx.beginPath();
      ctx.moveTo(personX, markerY2);
      ctx.lineTo(lx, markerY2);
      ctx.stroke();

      ctx.fillStyle = "rgba(249, 115, 22, 0.7)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`d_o = ${personDist} cm`, (personX + lx) / 2, markerY2 - 5);
    }

    // Focal length marker
    const f = getFocalLength();
    const fPointX = lx - f * scale * 0.6;
    if (fPointX > lx - width * 0.3) {
      // Focal point indicator
      ctx.beginPath();
      ctx.arc(fPointX, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
      ctx.fill();

      ctx.fillStyle = "rgba(251, 191, 36, 0.6)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("F", fPointX, ly + 14);
    }

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawOpticalAxis();
    drawGroundPlane();
    drawDepthOfFieldIndicator();
    drawSceneObjects();
    drawFocusDistanceMarker();
    drawCameraBody();
    drawLens();
    drawLightRays();
    drawSensorImage();
    drawPhysicsAnnotations();
    drawExposureOverlay();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No persistent resources
  }

  function getStateDescription(): string {
    const f = getFocalLength();
    const fNumber = (10 / aperture).toFixed(1);
    const brightness = getBrightness();
    const personBlur = getBlurRadius(sceneObjects[1].distance);
    const treeBlur = getBlurRadius(sceneObjects[0].distance);

    return (
      `Camera Exposure & Focus: f=${f.toFixed(1)}cm, aperture=f/${fNumber} (size ${aperture}). ` +
      `Focus distance: ${focusDistance}cm. ` +
      `Brightness: ${(brightness * 100).toFixed(0)}%. ` +
      `Person at ${sceneObjects[1].distance}cm: ${personBlur < 1.5 ? "sharp" : "blurred"} (blur=${personBlur.toFixed(1)}). ` +
      `Tree at ${sceneObjects[0].distance}cm: ${treeBlur < 1.5 ? "sharp" : "blurred"} (blur=${treeBlur.toFixed(1)}). ` +
      `Large aperture = bright but shallow DOF; small aperture = dark but deep DOF (pinhole effect). ` +
      `1/f = 1/d_o + 1/d_i. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default Camera2Factory;
