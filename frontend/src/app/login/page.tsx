"use client";
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Head from "next/head";

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const initSpherePacking = async () => {
      if (!canvasRef.current) return;
      
      try {
        // Dynamically import to avoid Next.js SSR issues with window/three.js
        // @ts-ignore
        const module = await import("threejs-components/build/backgrounds/spheres1.min.js");
        const Spheres1Background = module.default;
        
        // Prevent initializing twice in Strict Mode if it already initialized
        if (!active) return;

        const bg = Spheres1Background(canvasRef.current, {
          count: 300,
          minSize: 0.3,
          maxSize: 1,
          gravity: 0.5
        });
        
        bgRef.current = bg;
      } catch (err) {
        console.error("Failed to load threejs-components:", err);
      }
    };

    initSpherePacking();

    return () => {
      active = false;
      // If the component unmounts, try to gracefully stop the threejs loop and clear WebGL context
      if (canvasRef.current) {
        const gl = canvasRef.current.getContext('webgl2') || canvasRef.current.getContext('webgl');
        if (gl) {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
      }
      bgRef.current = null;
    };
  }, []);

  const toggleGravity = () => {
    if (bgRef.current) {
      bgRef.current.spheres.config.gravity = bgRef.current.spheres.config.gravity === 0 ? 1 : 0;
    }
  };

  const randomColors = () => {
    if (bgRef.current) {
      bgRef.current.spheres.setColors([
        0xffffff * Math.random(), 
        0xffffff * Math.random(), 
        0xffffff * Math.random()
      ]);
    }
  };

  return (
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&display=swap" rel="stylesheet" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Overrides to ensure the full screen effect matches the exact CSS provided */
        #login-app {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(0,0,0,0.5) 200%);
          font-family: "Montserrat", sans-serif;
          z-index: 9999;
          margin: 0;
          padding: 0;
        }

        #login-app .hero {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        #login-app h1, #login-app h2 {
          margin: 0;
          padding: 0;
          color: black;
          text-transform: uppercase;
          text-shadow: 0 0 20px rgba(255, 255, 255, 1);
          line-height: 100%;
          user-select: none;
        }

        #login-app h1 {
          position: relative;
          z-index: 2;
          font-size: 100px;
          font-weight: 700;
        }

        #login-app h2 {
          font-size: 80px;
          font-weight: 500;
        }

        #webgl-canvas {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          overflow: hidden;
          z-index: 1;
          width: 100%;
          height: 100%;
          pointer-events: auto;
        }

        #login-app .buttons {
          position: absolute;
          width: 100%;
          bottom: 40px;
          z-index: 2;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
        }

        #login-app button, #login-app a {
          color: black;
          font-family: "Montserrat", sans-serif;
          font-size: 14px;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 6px;
          border: 1px solid grey;
          padding: 10px 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        #login-app button:hover, #login-app a:hover {
          background: rgba(255, 255, 255, 1);
          transform: translateY(-2px);
        }

        #login-app .enter-btn {
          font-weight: bold;
          border: 1px solid #6d28d9;
          color: #6d28d9;
          background: rgba(255, 255, 255, 0.9);
        }
        #login-app .enter-btn:hover {
          background: #6d28d9;
          color: white;
        }
      `}} />
      <div id="login-app">
        <div className="hero">
          <h1>Recover AI</h1>
          <h2>Dashboard</h2>
        </div>
        <div className="buttons">
          <button type="button" onClick={toggleGravity}>Toggle gravity</button>
          <button type="button" onClick={randomColors}>Random colors</button>
          <Link href="/" className="enter-btn">Enter Dashboard &rarr;</Link>
        </div>
        <canvas id="webgl-canvas" ref={canvasRef}></canvas>
      </div>
    </>
  );
}
