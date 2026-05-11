import os
import subprocess
import time
import webbrowser
import sys

def start_backend():
    print("Starting backend server...")
    backend_path = os.path.join(os.path.dirname(__file__), "backend", "app.py")
    return subprocess.Popen([sys.executable, backend_path])

def launch_app():
    # URL of the application (Vite dev server)
    # If in production, this would be the Flask URL http://localhost:5050
    url = "http://localhost:3000"
    
    print(f"Launching application at {url}...")
    
    # Paths to common browsers on Windows
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    
    if os.path.exists(chrome_path):
        # --app flag opens the URL in a standalone window without browser UI
        subprocess.Popen([chrome_path, f"--app={url}"])
    elif os.path.exists(edge_path):
        subprocess.Popen([edge_path, f"--app={url}"])
    else:
        # Fallback to default browser if neither is found
        webbrowser.open(url)

if __name__ == "__main__":
    # 1. Start Backend
    backend = start_backend()
    
    # 2. Wait a moment for server to initialize
    time.sleep(2)
    
    # 3. Launch the window
    launch_app()
    
    print("\nApplication is running.")
    print("Close the command window to stop the servers.")
    
    try:
        backend.wait()
    except KeyboardInterrupt:
        backend.terminate()
