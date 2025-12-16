import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { clearPlyData, getPlyData, shouldSavePlyData } from "./lib/plyCache";
import { deletePlyFile, PlyFile, savePlyFile } from "./lib/plyStorage";

/**
 * 3D Viewer Component for React Native
 * Displays PLY files using Three.js in a WebView
 */

export default function ViewerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plyData, setPlyData] = useState<string | null>(null);
  const [savedFile, setSavedFile] = useState<PlyFile | null>(null);
  const webViewRef = React.useRef<WebView>(null);

  useEffect(() => {
    loadAndSavePly();
  }, []);

  const loadAndSavePly = async () => {
    try {
      const cachedData = getPlyData();
      if (!cachedData) {
        setError("No PLY data available");
        setLoading(false);
        return;
      }

      console.log(`[Viewer] Received PLY: ${cachedData.length} bytes`);
      setPlyData(cachedData);

      // Only save if it's a newly generated model, not from viewing a saved file
      if (shouldSavePlyData()) {
        try {
          const saved = await savePlyFile(cachedData);
          setSavedFile(saved);
          console.log(`[Viewer] Saved to: ${saved.filePath}`);
        } catch (saveErr) {
          console.error("[Viewer] Failed to save PLY file:", saveErr);
          // Continue anyway - we still have data to display
        }
      } else {
        // Just show that it's already saved
        console.log(
          "[Viewer] Viewing existing saved model (no duplicate save)"
        );
      }

      setLoading(false);
    } catch (err) {
      console.error("[Viewer] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const handleBack = () => {
    clearPlyData();
    router.back();
  };

  const handleDelete = async () => {
    if (!savedFile) return;

    Alert.alert("Delete Model", `Delete "${savedFile.fileName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const success = await deletePlyFile(savedFile.fileName);
          if (success) {
            Alert.alert("Deleted", "Model deleted successfully");
            handleBack();
          } else {
            Alert.alert("Error", "Failed to delete model");
          }
        },
      },
    ]);
  };

  const handleViewSaved = () => {
    router.push("/saved-models");
  };

  const handleWebViewLoad = () => {
    console.log("[Viewer] WebView loaded, waiting before sending PLY data...");
    if (webViewRef.current && plyData) {
      console.log(`[Viewer] PLY data exists: ${plyData.length} bytes`);
      setTimeout(() => {
        console.log("[Viewer] Sending PLY message now...");
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "ply", data: plyData })
        );
        console.log("[Viewer] PLY message sent");
      }, 2000);
    } else {
      console.log("[Viewer] ERROR: No plyData to send!");
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log("[Viewer] WebView says:", msg);
    } catch (e) {
      console.error("[Viewer] Error parsing WebView message:", e);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.button} onPress={handleBack}>
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading || !plyData) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1b6ef3" />
        <Text style={styles.loadingText}>Loading 3D Model...</Text>
      </View>
    );
  }

  // Generate HTML for Three.js viewer - simplified to receive data via postMessage
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; }
    body { 
      width: 100%; 
      height: 100vh; 
      background: #000;
      overflow: hidden;
    }
    canvas { display: block; }
    #status {
      position: absolute;
      top: 20px;
      left: 20px;
      color: #0f0;
      font-size: 12px;
      background: rgba(0,0,0,0.8);
      padding: 10px 15px;
      border-radius: 4px;
      font-family: monospace;
      z-index: 100;
    }
    #info {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      color: #888;
      font-size: 11px;
      text-align: center;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="status">Waiting for data...</div>
  <div id="info">Drag: rotate • Scroll: zoom</div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    console.log("[WebView] Page loaded, setting up...");
    
    // Send debug messages back to React Native
    function sendDebug(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg }));
      }
    }
    
    sendDebug("Page loaded");
    
    const status = document.getElementById("status");
    let scene, camera, renderer, mesh;
    
    // Log first 100 lines of PLY file to console
    function logPlyContent(plyBase64) {
      try {
        const binaryString = atob(plyBase64);
        const allLines = binaryString.split('\n');
        const displayLines = allLines.slice(0, 100);
        
        console.log("\n=== PLY File (first 100 lines) ===");
        displayLines.forEach((line, i) => {
          console.log(\`[\${i}] \${line}\`);
        });
        console.log("=== End PLY Content ===");
        
      } catch (err) {
        console.error("Error logging PLY:", err);
      }
    }
    
    
    
    // Wait for THREE to load
    function waitForThree(callback, attempts = 0) {
      if (typeof THREE !== 'undefined') {
        callback();
      } else if (attempts < 50) {
        setTimeout(() => waitForThree(callback, attempts + 1), 100);
      } else {
        log('ERROR: Three.js failed to load');
      }
    }
    
    function log(msg) {
      console.log(msg);
      status.textContent = msg;
    }

    function initThree() {
      const canvas = document.querySelector("canvas") || document.createElement("canvas");
      document.body.appendChild(canvas);
      
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
      camera.position.z = 2;
      
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      
      const light = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(light);
      
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
      dirLight.position.set(10, 10, 10);
      scene.add(dirLight);
      
      log("Three.js ready");
    }

    function decodePLY(base64) {
      log("Decoding PLY...");
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Find header end
      let headerEnd = 0;
      for (let i = 0; i < Math.min(bytes.length, 20000); i++) {
        if (bytes[i] === 10) {
          const chunk = String.fromCharCode(...bytes.slice(Math.max(0, i-11), i));
          if (chunk.includes("end_header")) {
            headerEnd = i + 1;
            break;
          }
        }
      }
      
      if (!headerEnd) throw new Error("No end_header found");
      
      const headerText = new TextDecoder().decode(bytes.slice(0, headerEnd));
      const lines = headerText.split("\\n");
      
      let vertexCount = 0;
      const props = [];
      
      for (const line of lines) {
        if (line.startsWith("element vertex")) {
          vertexCount = parseInt(line.split(" ")[2]);
        } else if (line.startsWith("property")) {
          const parts = line.split(" ");
          props.push({ type: parts[1], name: parts[2] });
        }
      }
      
      if (!vertexCount) throw new Error("No vertices");
      
      log(\`Parsing \${vertexCount} vertices...\`);
      
      const hasColors = props.some(p => p.name === 'red' || p.name === 'green' || p.name === 'blue');
      console.log('[PLY] Has colors:', hasColors, 'Properties:', props.map(p => p.name).join(', '));
      
      const positions = [];
      const colors = [];
      const dataView = new DataView(bytes.buffer, bytes.byteOffset);
      let offset = headerEnd;
      
      for (let i = 0; i < vertexCount; i++) {
        let x = 0, y = 0, z = 0, r = 1, g = 1, b = 1;
        
        for (const prop of props) {
          if (prop.type === "float") {
            const val = dataView.getFloat32(offset, true);
            offset += 4;
            if (prop.name === "x") x = val;
            else if (prop.name === "y") y = val;
            else if (prop.name === "z") z = val;
          } else if (prop.type === "uchar") {
            const val = dataView.getUint8(offset);
            offset += 1;
            if (prop.name === "red") r = val / 255;
            else if (prop.name === "green") g = val / 255;
            else if (prop.name === "blue") b = val / 255;
          } else {
            offset += 1;
          }
        }
        
        positions.push(x, y, z);
        colors.push(r, g, b);
      }
      
      console.log('[PLY] First color:', colors.slice(0, 3), 'Last color:', colors.slice(-3));
      return { positions, colors, vertexCount, hasColors };
    }

    function renderPLY(base64) {
      try {
        if (!scene) initThree();
        
        const { positions, colors, hasColors } = decodePLY(base64);
        
        log("Creating geometry...");
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        
        // Always add color attribute, even if defaulting to white
        const colorData = new Float32Array(colors.length);
        for (let i = 0; i < colors.length; i++) {
          colorData[i] = colors[i];
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colorData, 3));
        
        geometry.center();
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        
        // Material always uses vertex colors
        const material = new THREE.PointsMaterial({
          size: 0.01,
          vertexColors: true,
          sRGBColorSpace: true,
          transparent: false,
          wireframe: false
        });
        
        mesh = new THREE.Points(geometry, material);
        mesh.scale.set(scale, scale, scale);
        scene.add(mesh);
        
        log(\`✓ Ready (\${hasColors ? 'colored' : 'white'} points)\`);
        
        // Better interaction controls
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let autoRotate = true;
        
        document.addEventListener("mousedown", (e) => {
          isDragging = true;
          autoRotate = false;
          previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        document.addEventListener("mousemove", (e) => {
          if (isDragging && mesh) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            // Rotate based on mouse movement
            mesh.rotation.y += deltaX * 0.01;
            mesh.rotation.x += deltaY * 0.01;
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
          }
        });
        
        document.addEventListener("mouseup", () => {
          isDragging = false;
          autoRotate = true;
        });
        
        document.addEventListener("wheel", (e) => {
          e.preventDefault();
          const zoomSpeed = 0.3;
          if (e.deltaY > 0) {
            camera.position.z += zoomSpeed;
          } else {
            camera.position.z -= zoomSpeed;
          }
          camera.position.z = Math.max(0.5, Math.min(15, camera.position.z));
        }, { passive: false });
        
        function animate() {
          requestAnimationFrame(animate);
          
          // Auto-rotate when idle
          if (autoRotate && mesh) {
            mesh.rotation.y += 0.003;
          }
          
          renderer.render(scene, camera);
        }
        animate();
        
        window.addEventListener("resize", () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        });
        
      } catch (e) {
        log("ERROR: " + e.message);
        console.error(e);
      }
    }

    window.addEventListener("message", (event) => {
      try {
        sendDebug("Received message, data length: " + event.data.length);
        const msg = JSON.parse(event.data);
        sendDebug("Parsed message type: " + msg.type);
        if (msg.type === "ply") {
          sendDebug("PLY data size: " + (msg.data ? msg.data.length : "null"));
          renderPLYData(msg.data);
        }
      } catch (e) {
        sendDebug("Error: " + e.toString());
      }
    });

    log("Waiting for data...");
    sendDebug("Setup complete, listening for PLY data");
    
    function renderPLYData(base64) {
      log("Rendering PLY...");
      console.log("[WebView] PLY data received, logging content...");
      
      // Log PLY file content to console for debugging
      logPlyContent(base64);
      
      waitForThree(() => {
        renderPLY(base64);
      });
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        mixedContentMode="always"
        onLoadEnd={handleWebViewLoad}
        onMessage={handleWebViewMessage}
        injectedJavaScript={`
          (function() {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "Injected script running" }));
              
              // Set up message listener
              window.addEventListener("message", (event) => {
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "Message received in injected listener" }));
                  const msg = JSON.parse(event.data);
                  if (msg.type === "ply") {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "PLY message detected, calling renderPLYData..." }));
                    // Call the renderPLYData function defined in the HTML
                    if (typeof window.renderPLYData === 'function') {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "Calling renderPLYData" }));
                      window.renderPLYData(msg.data);
                    } else {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "ERROR: renderPLYData not found" }));
                    }
                  }
                } catch (e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "Injected listener error: " + e.toString() }));
                }
              });
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "Injected message listener setup complete" }));
            } catch (e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: "debug", msg: "Injected script error: " + e.toString() }));
            }
          })();
        `}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("[WebView] Error:", nativeEvent);
          setError("Failed to load 3D viewer");
        }}
      />

      {/* Top-left back button */}
      <Pressable style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      {/* Bottom toolbar with file info and actions */}
      {savedFile && (
        <View style={styles.toolbar}>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName}>{savedFile.fileName}</Text>
            <Text style={styles.fileSize}>
              {(savedFile.fileSize / 1024 / 1024).toFixed(2)} MB •{" "}
              {savedFile.createdDate}
            </Text>
          </View>
          <View style={styles.toolbarButtons}>
            <Pressable
              style={[styles.toolbarButton, styles.secondaryButton]}
              onPress={handleViewSaved}
            >
              <Text style={styles.toolbarButtonText}>📁 Saved</Text>
            </Pressable>
            <Pressable
              style={[styles.toolbarButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Text style={styles.toolbarButtonText}>🗑 Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  webview: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    zIndex: 10,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  toolbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fileInfo: {
    marginBottom: 12,
  },
  fileName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    marginBottom: 4,
  },
  fileSize: {
    color: "#888",
    fontSize: 11,
    fontFamily: "monospace",
  },
  toolbarButtons: {
    flexDirection: "row",
    gap: 10,
  },
  toolbarButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#1a3a4a",
  },
  deleteButton: {
    backgroundColor: "#4a2a2a",
  },
  toolbarButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ff6b6b",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#1b6ef3",
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ccc",
  },
});
