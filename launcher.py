"""
launcher.py
يُحوَّل هذا الملف إلى .exe عبر PyInstaller.
يشغّل Flask في الخلفية ثم يفتح المتصفح تلقائياً.
"""
import sys, os, threading, time, webbrowser, subprocess

def resource(rel):
    """يعمل سواء كان تشغيلاً مباشراً أو من داخل .exe"""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)

def run_flask():
    # تشغيل app.py من مجلد backend
    backend = resource("backend")
    subprocess.Popen(
        [sys.executable, os.path.join(backend, "app.py")],
        cwd=backend,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

def open_browser():
    time.sleep(2)          # ننتظر Flask يستعد
    webbrowser.open("http://127.0.0.1:3000")

if __name__ == "__main__":
    threading.Thread(target=run_flask,    daemon=True).start()
    threading.Thread(target=open_browser, daemon=True).start()

    # إبقاء العملية الرئيسية حية
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
