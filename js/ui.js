// UI and Interaction Logic

export function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.addEventListener('mousedown', dragMouseDown, false);

    function dragMouseDown(e) {
        e.stopPropagation();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.addEventListener('mouseup', closeDragElement, false);
        document.addEventListener('mousemove', elementDrag, false);
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.bottom = "auto";
        el.style.right = "auto";
    }

    function closeDragElement() {
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }
}

export function setupVR(viewer, state) {
    const vrToggle = document.getElementById('vr-toggle');
    vrToggle.addEventListener('click', async () => {
        if (viewer.scene.useWebVR) {
            viewer.scene.useWebVR = false;
            vrToggle.textContent = 'Enter VR';
            document.getElementById('vr-indicator').style.display = 'none';
        } else {
            try {
                if (navigator.xr) {
                    const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (isSupported) {
                        viewer.scene.useWebVR = true;
                        vrToggle.textContent = 'Exit VR';
                        document.getElementById('vr-indicator').style.display = 'block';
                        
                        viewer.scene.postRender.addEventListener(function handler() {
                            if (!viewer.scene.useWebVR) {
                                vrToggle.textContent = 'Enter VR';
                                document.getElementById('vr-indicator').style.display = 'none';
                                viewer.scene.postRender.removeEventListener(handler);
                                return;
                            }

                            // XR Input Interaction (Pinch/Grip)
                            const session = viewer.scene.frameState.context._pBuffer ? null : viewer.scene.frameState.context; // Simplified check
                            // In real WebXR we would access the session from the viewer or navigator
                            // Here we use a safe-guard for the capstone logic:
                            if (navigator.xr && viewer.scene.useWebVR) {
                                // Since we don't have a reference to the active session object directly 
                                // without digging into Cesium internals, we'll implement a simulation check
                                // or assume the logic provided is for the custom loop.
                            }
                        });
                    } else {
                        alert("Your browser supports WebXR, but immersive VR is not available.");
                    }
                } else {
                    alert("WebXR is not supported in this browser.");
                }
            } catch (e) {
                console.error("WebXR Error:", e);
                alert("Failed to start VR: " + e.message);
            }
        }
    });

    // Handle XR session interaction logic separately if session is accessible
    viewer.scene.preRender.addEventListener(() => {
        if (viewer.scene.useWebVR) {
            // Note: In Cesium, the XR session is managed internally. 
            // This is a placeholder for the logic to integrate with the knobs.
            // In a full implementation, you'd listen for inputSource events.
        }
    });
}

export function fixInjectedWarning(makeDraggable) {
    const divs = document.getElementsByTagName('div');
    for (let div of divs) {
        if (div.textContent.includes("This page is not loaded over HTTPS") && (div.style.backgroundColor === "red" || div.style.background === "red")) {
            div.id = "https-warning";
            div.style.cursor = "move";
            div.style.width = "400px";
            div.style.left = "calc(50% - 200px)";
            div.style.borderRadius = "8px";
            div.style.bottom = "20px";
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = "&times;";
            closeBtn.className = "close-btn";
            closeBtn.onclick = function(e) { 
                e.stopPropagation();
                div.style.display = 'none'; 
            };
            div.prepend(closeBtn);
            
            makeDraggable(div, div);
            break;
        }
    }
}
