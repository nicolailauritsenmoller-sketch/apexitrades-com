import model from "@/assets/liveness/face_landmarker.task.asset.json";

/** Dynamically imported only after the user opens their camera. */
export async function createFaceMovementDetector() {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm");
  return FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: model.url, delegate: "CPU" },
    runningMode: "VIDEO", numFaces: 2, outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.7, minFacePresenceConfidence: 0.7, minTrackingConfidence: 0.7,
  });
}