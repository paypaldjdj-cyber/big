import requests

BASE = "http://localhost:5050/api"

def test_get_patient():
    # First get patients to find an ID
    res = requests.get(f"{BASE}/patients/")
    patients = res.json()
    if not patients:
        print("No patients found")
        return
    
    pid = patients[0]['id']
    print(f"Testing patient ID: {pid}")
    
    res = requests.get(f"{BASE}/patients/{pid}")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:200]}...")

if __name__ == "__main__":
    test_get_patient()
