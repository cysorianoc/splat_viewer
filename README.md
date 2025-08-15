# Gaussian Splat Viewer

A web-based viewer for **3D Gaussian Splatting (.ply)** files, built with **React**, **Three.js**, and **WebGL**.  
This application allows for interactive exploration of complex point cloud data with advanced rendering controls — right in your browser.

![Application Screenshot](https://github.com/cysorianoc/splat_viewer/blob/main/Capture%20d%E2%80%99%C3%A9cran%202025-08-15%20115809.png)


[See the app](https://splatviewer.netlify.app/)


---

## ✨ Features

- ** Rendering**: Utilizes custom WebGL shaders to render millions of points efficiently.  
- **Local File Loading**: Load `.ply` files directly from your local disk with a progress indicator.  
- **Multiple Render Modes**:  
  - **Splat Mode**: Renders full 3D Gaussian splats, respecting scale and rotation for a photorealistic look.  
  - **Original Colors Mode**: Displays points using their embedded color data.  
  - **Elevation Colormap Mode**: Visualizes the model's structure by mapping point elevation to a *Viridis* color gradient.  

- **Interactive Controls**:  
  - **3D Orbit Camera**: Intuitive orbit, pan, and zoom via `OrbitControls`.  
  - **Transformations**: Translate, rotate, and scale the model in real-time.  
  - **Appearance**: Adjust point/splat size, opacity, and background color.  
  - **3D Cropping**: Isolate regions of interest with a 3D bounding box.  
  - **Scene Helpers**: Toggleable axes and grid for better spatial orientation.  
  - **Performance Monitoring**: Real-time FPS and total point count display.  
