import os
import subprocess
import sys

def build_backend():
    print("Building Flask Backend...")
    
    # Path to your main backend file
    main_file = os.path.join("backend", "app.py")
    
    # PyInstaller command
    # --onefile: Create a single EXE
    # --noconsole: Hide the terminal window when running
    # --distpath: Where to put the finished EXE
    # --name: Name of the EXE file
    cmd = [
        "python", "-m", "PyInstaller",
        "--noconsole",
        "--onefile",
        "--distpath", "backend_dist",
        "--name", "clinic_server",
        "--hidden-import", "flask_cors",
        "--hidden-import", "apscheduler",
        main_file
    ]


    
    try:
        subprocess.check_call(cmd)
        print("\nSUCCESS: Backend built in backend_dist/clinic_server.exe")
    except Exception as e:
        print(f"\nERROR: Failed to build backend: {e}")

if __name__ == "__main__":
    build_backend()
