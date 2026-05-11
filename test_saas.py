import urllib.request, json

BASE = "http://localhost:5050/api"

def req(method, path, data=None, headers={}):
    h = {"Content-Type": "application/json"}
    h.update(headers)
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r)
        return json.loads(resp.read().decode()), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode()), e.code

print("="*50)
print("SaaS System Test")
print("="*50)

# 1. Create Clinic A
print("\n[1] Create Clinic A...")
res, status = req("POST", "/settings/clinics", {
    "clinic_name": "Clinic Alpha",
    "doctor_name": "Dr. Ahmed",
    "activation_key": "ACT-ALPHA-TEST-2025",
    "expiry_date": "2026-12-31",
    "has_secretary": 0
})
print("    Result:", res, status)

# 2. Create Clinic B  
print("\n[2] Create Clinic B...")
res, status = req("POST", "/settings/clinics", {
    "clinic_name": "Clinic Beta",
    "doctor_name": "Dr. Ali",
    "activation_key": "ACT-BETA-TEST-2025",
    "expiry_date": "2026-12-31",
    "has_secretary": 0
})
print("    Result:", res, status)

# 3. Login as Clinic A
print("\n[3] Doctor A Login with code...")
res, status = req("POST", "/auth/login", {"username": None, "password": "ACT-ALPHA-TEST-2025"})
print("    Result:", res, status)
clinic_a_id = res.get("clinic_id")

# 4. Login as Clinic B
print("\n[4] Doctor B Login with code...")
res, status = req("POST", "/auth/login", {"username": None, "password": "ACT-BETA-TEST-2025"})
print("    Result:", res, status)
clinic_b_id = res.get("clinic_id")

# 5. Add patient to Clinic A
print("\n[5] Add patient to Clinic A (ID={})...".format(clinic_a_id))
res, status = req("POST", "/patients/", 
    {"first_name": "Ahmed", "last_name": "AlWafa", "phone": "0501111111"},
    {"X-Clinic-ID": str(clinic_a_id)})
print("    Result:", res, status)

# 6. Get Clinic A patients
print("\n[6] Patients in Clinic A...")
res, status = req("GET", "/patients/", headers={"X-Clinic-ID": str(clinic_a_id)})
names_a = [p["first_name"] for p in res]
print("    Count:", len(res), "Names:", names_a)

# 7. Get Clinic B patients (must be EMPTY)
print("\n[7] Patients in Clinic B (must be 0)...")
res, status = req("GET", "/patients/", headers={"X-Clinic-ID": str(clinic_b_id)})
names_b = [p["first_name"] for p in res]
print("    Count:", len(res), "Names:", names_b)

print("\n" + "="*50)
if len(names_b) == 0 and len(names_a) == 1:
    print("SUCCESS: Data isolation is working perfectly!")
    print("  Clinic A has 1 patient, Clinic B has 0 patients.")
else:
    print("FAIL: Isolation not working correctly!")
print("="*50)
